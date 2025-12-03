import React from 'react'
import { usePlayer } from '../providers/PlayerProvider'
import { useData } from '../providers/DataProvider'

export default function LyricsPanel({ open, onClose, inline = false }: { open: boolean; onClose: () => void; inline?: boolean }){
  const { current, progress } = usePlayer() as any
  const { songs, updateLyrics } = useData() as any
  const [text, setText] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [lines, setLines] = React.useState<{ t: number; l: string }[]>([])
  const listRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const curId = (current as any)?.id
    const found = songs?.find((s:any)=>s.id===curId)
    setText((found?.lyrics) || '')
    setEditing(false)
  }, [songs, (current as any)?.id])
  React.useEffect(() => {
    const arr: { t: number; l: string }[] = []
    const raw = (text || '').split(/\r?\n/)
    for (const ln of raw){
      const m = [...ln.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      const payload = ln.replace(/\[[^\]]+\]/g, '').trim()
      if (m.length === 0 && payload){ arr.push({ t: Number.POSITIVE_INFINITY, l: payload }); continue }
      for (const mm of m){
        const mmn = parseInt(mm[1]||'0',10)
        const s = parseInt(mm[2]||'0',10)
        const ms = parseInt(mm[3]||'0',10)
        const time = mmn*60 + s + (isNaN(ms)?0:ms/1000)
        if (payload) arr.push({ t: time, l: payload })
      }
    }
    arr.sort((a,b)=>a.t-b.t)
    setLines(arr)
  }, [text])
  const idx = React.useMemo(() => {
    if (!isFinite(progress)) return -1
    for (let i=lines.length-1;i>=0;i--){ if (progress >= lines[i].t - 0.01) return i }
    return -1
  }, [progress, lines])
  React.useEffect(() => {
    if (!listRef.current) return
    const children = listRef.current.querySelectorAll('[data-idx]')
    const el = children[idx] as HTMLElement | undefined
    if (el) el.scrollIntoView({ block: 'center' })
  }, [idx])
  if (!open && !inline) return null
  const empty = !text
  const body = (
      <div className="w-full sm:w-[720px] bg-surface border-t border-borderc p-4 rounded-t-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">歌词</div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setEditing(v=>!v)}>{editing ? '完成' : '编辑'}</button>
            <button className="btn" onClick={onClose}>关闭</button>
          </div>
        </div>
        {empty && <div className="text-xs text-muted mb-3">被你发现啦！我们仍在努力获取这首歌的歌词</div>}
        {!editing && (
          <div ref={listRef} className="max-h-64 overflow-auto px-1 py-2 space-y-2">
            {lines.length === 0 ? (
              <div className="text-xs text-muted">暂无歌词</div>
            ) : (isFinite(lines[0].t) ? (
              lines.filter(x=>isFinite(x.t)).map((x,i) => (
                <div key={i} data-idx={i} className={`text-sm ${i===idx ? 'text-accent font-semibold' : 'text-text'}`}>{x.l}</div>
              ))
            ) : (
              lines.map((x,i) => (
                <div key={i} className="text-sm text-text">{x.l}</div>
              ))
            ))}
          </div>
        )}
        {editing && (
          <>
            <textarea id="lyrics-editor" className="w-full h-40 rounded-lg border border-borderc bg-[#151515] text-text p-2" placeholder="支持LRC格式时间标签，如 [00:12.34]这一句歌词" value={text} onChange={e=>setText(e.target.value)} />
            <div className="mt-2 flex items-center gap-2">
              <button className="btn" onClick={() => {
                const mm = Math.floor(progress/60)
                const ss = Math.floor(progress%60)
                const cs = Math.floor((progress - Math.floor(progress)) * 100)
                const tag = `[${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}.${cs.toString().padStart(2,'0')}]`
                const el = document.getElementById('lyrics-editor') as HTMLTextAreaElement | null
                if (!el) return
                const start = el.selectionStart || 0
                const end = el.selectionEnd || start
                const nt = text.slice(0, start) + tag + text.slice(end)
                setText(nt)
                setTimeout(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus() }, 0)
              }}>插入当前时间标签</button>
              <button className="btn" onClick={async () => {
                if (!(current as any)?.id) return
                setSaving(true)
                try { await updateLyrics((current as any).id, text) } finally { setSaving(false) }
              }}>{saving ? '保存中...' : '保存歌词'}</button>
            </div>
          </>
        )}
      </div>
  )
  if (inline) return body
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-end">{body}</div>
  )
}