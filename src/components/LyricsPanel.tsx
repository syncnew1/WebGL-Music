import React from 'react'
import { prepare, layout } from '@chenglou/pretext'
import { usePlayer } from '../providers/PlayerProvider'
import { useData } from '../providers/DataProvider'

type LyricLine = { t: number; l: string; k: string }

export default function LyricsPanel({ open, onClose, inline = false }: { open: boolean; onClose: () => void; inline?: boolean }) {
  const { current, progress, duration, seek, play, isPlaying } = usePlayer() as any
  const { songs, updateLyrics } = useData() as any
  const [text, setText] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [lines, setLines] = React.useState<LyricLine[]>([])
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const editorWrapRef = React.useRef<HTMLDivElement | null>(null)
  const [editorWidth, setEditorWidth] = React.useState(0)
  const [estimatedLineCount, setEstimatedLineCount] = React.useState(0)
  const [estimatedHeight, setEstimatedHeight] = React.useState(0)

  React.useEffect(() => {
    const curId = (current as any)?.id
    const found = songs?.find((s: any) => s.id === curId)
    setText(found?.lyrics || '')
    setEditing(false)
  }, [songs, (current as any)?.id])

  React.useEffect(() => {
    const arr: LyricLine[] = []
    const raw = (text || '').split(/\r?\n/)
    for (const ln of raw) {
      const m = [...ln.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      const payload = ln.replace(/\[[^\]]+\]/g, '').trim()
      if (m.length === 0 && payload) {
        arr.push({ t: Number.POSITIVE_INFINITY, l: payload, k: `${arr.length}-${payload}` })
        continue
      }
      for (const mm of m) {
        const mmn = parseInt(mm[1] || '0', 10)
        const s = parseInt(mm[2] || '0', 10)
        const fracRaw = mm[3] || ''
        const frac = fracRaw ? parseInt(fracRaw, 10) / (fracRaw.length === 3 ? 1000 : fracRaw.length === 2 ? 100 : 10) : 0
        const time = mmn * 60 + s + (Number.isFinite(frac) ? frac : 0)
        if (payload) arr.push({ t: time, l: payload, k: `${time}-${payload}-${arr.length}` })
      }
    }
    arr.sort((a, b) => a.t - b.t)
    setLines(arr)
  }, [text])

  React.useEffect(() => {
    if (editorWidth <= 0) {
      setEstimatedLineCount(0)
      setEstimatedHeight(0)
      return
    }
    try {
      const prepared = prepare(text || '', '14px Poppins', { whiteSpace: 'pre-wrap' })
      const result = layout(prepared, Math.max(0, editorWidth - 16), 22)
      setEstimatedLineCount(result.lineCount)
      setEstimatedHeight(result.height)
    } catch {
      setEstimatedLineCount(0)
      setEstimatedHeight(0)
    }
  }, [text, editorWidth])

  React.useEffect(() => {
    if (!editorWrapRef.current) return
    const el = editorWrapRef.current
    const update = () => setEditorWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const synced = React.useMemo(() => lines.filter(x => Number.isFinite(x.t)), [lines])
  const unsynced = React.useMemo(() => lines.filter(x => !Number.isFinite(x.t)), [lines])

  const idx = React.useMemo(() => {
    if (!isFinite(progress) || synced.length === 0) return -1
    for (let i = synced.length - 1; i >= 0; i--) {
      if (progress >= synced[i].t - 0.01) return i
    }
    return -1
  }, [progress, synced])

  React.useEffect(() => {
    if (!listRef.current || idx < 0) return
    const el = listRef.current.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [idx])

  if (!open && !inline) return null

  const onSeekLine = (t: number) => {
    if (!Number.isFinite(t)) return
    seek(Math.max(0, t))
    if (!isPlaying) play()
  }

  const empty = !text
  const hasSynced = synced.length > 0

  const lineVisual = (lineIndex: number) => {
    const d = idx < 0 ? 99 : Math.abs(lineIndex - idx)
    const active = lineIndex === idx
    if (idx < 0) {
      return { opacity: 0.72, scale: 1, blur: 0, color: 'rgba(255,255,255,0.78)', weight: 520 }
    }
    return {
      opacity: active ? 1 : d === 1 ? 0.62 : d === 2 ? 0.34 : 0.18,
      scale: active ? 1.03 : d === 1 ? 0.985 : 0.96,
      blur: active ? 0 : d === 1 ? 0.2 : 0.8,
      color: active ? '#ffffff' : 'rgba(255,255,255,0.72)',
      weight: active ? 760 : d === 1 ? 560 : 500,
    }
  }

  const body = (
    <div
      className={inline ? 'w-full h-full' : 'w-full sm:w-[720px] border border-white/10 p-4 rounded-2xl'}
      style={{
        background: 'linear-gradient(180deg, rgba(16,20,34,0.98) 0%, rgba(9,13,24,0.98) 100%)',
        backdropFilter: 'blur(26px) saturate(125%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.45)',
      }}
    >
      {!inline && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold">歌词</div>
            <div className="text-xs text-muted mt-0.5">{current?.title || '未选择曲目'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setEditing(v => !v)}>{editing ? '完成' : '编辑'}</button>
            <button className="btn" onClick={onClose}>关闭</button>
          </div>
        </div>
      )}

      {inline && (
        <div
          className="flex items-center justify-between px-4 py-4 border-b"
          style={{
            borderColor: 'var(--border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div className="min-w-0">
            <div className="page-kicker" style={{ marginBottom: 6 }}>Lyrics Focus</div>
            <div className="text-sm font-semibold truncate">{current?.title || '未选择曲目'}</div>
            <div className="text-xs text-muted">{current?.artist || '歌词面板'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setEditing(v => !v)}>{editing ? '完成' : '编辑'}</button>
          </div>
        </div>
      )}

      {empty && <div className="text-xs text-muted mb-3 px-4 pt-3">被你发现啦！我们仍在努力获取这首歌的歌词。</div>}

      {!editing && (
        <div
          ref={listRef}
          className={inline ? 'h-[calc(100%-76px)] overflow-auto px-4 py-8 space-y-2 hide-scrollbar' : 'max-h-72 overflow-auto px-4 py-8 space-y-2 hide-scrollbar'}
          style={{
            background: 'radial-gradient(80% 60% at 50% 50%, rgba(49,194,124,0.10) 0%, rgba(0,0,0,0) 72%), linear-gradient(180deg, #111522 0%, #0a0d16 100%)',
            borderRadius: 18,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)',
          }}
        >
          {!hasSynced && unsynced.length === 0 && <div className="text-xs text-muted">暂无歌词</div>}

          {hasSynced && synced.map((x, i) => {
            const active = i === idx
            const v = lineVisual(i)
            return (
              <button
                key={x.k}
                data-idx={i}
                onClick={() => onSeekLine(x.t)}
                className="w-full text-center px-3 py-3 rounded-xl transition-all duration-300 cursor-pointer"
                style={{
                  color: v.color,
                  fontWeight: v.weight as any,
                  transform: `scale(${v.scale})`,
                  opacity: v.opacity,
                  filter: `blur(${v.blur}px)`,
                  background: active ? 'radial-gradient(120% 80% at 50% 50%, rgba(49,194,124,0.16) 0%, rgba(78,110,242,0.08) 58%, rgba(255,255,255,0.0) 100%)' : 'transparent',
                  letterSpacing: active ? '0.01em' : '0.005em',
                  textShadow: active ? '0 0 16px rgba(255,255,255,0.40), 0 0 36px rgba(49,194,124,0.18)' : 'none',
                }}
                title={`跳转到 ${Math.floor(x.t / 60).toString().padStart(2, '0')}:${Math.floor(x.t % 60).toString().padStart(2, '0')}`}
              >
                <div style={{ fontSize: active ? 27 : 22, lineHeight: active ? 1.22 : 1.28 }}>{x.l}</div>
              </button>
            )
          })}

          {!hasSynced && unsynced.map((x) => (
            <div key={x.k} className="text-center px-3 py-2" style={{ fontSize: 21, lineHeight: 1.35, color: 'rgba(255,255,255,0.82)' }}>{x.l}</div>
          ))}
        </div>
      )}

      {editing && (
        <>
          <div ref={editorWrapRef} className="px-1">
            <textarea
              id="lyrics-editor"
              className="w-full h-44 rounded-lg border border-borderc bg-[#101521] text-text p-3"
              placeholder="支持LRC格式时间标签，如 [00:12.34]这一句歌词"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>
          <div className="mt-1 text-xs text-muted px-1">预估：约 {estimatedLineCount} 行 · 约 {Math.round(estimatedHeight)}px 高度</div>
          <div className="mt-2 flex items-center gap-2 px-1">
            <button
              className="btn"
              onClick={() => {
                const mm = Math.floor(progress / 60)
                const ss = Math.floor(progress % 60)
                const cs = Math.floor((progress - Math.floor(progress)) * 100)
                const tag = `[${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}]`
                const el = document.getElementById('lyrics-editor') as HTMLTextAreaElement | null
                if (!el) return
                const start = el.selectionStart || 0
                const end = el.selectionEnd || start
                const nt = text.slice(0, start) + tag + text.slice(end)
                setText(nt)
                setTimeout(() => {
                  el.selectionStart = el.selectionEnd = start + tag.length
                  el.focus()
                }, 0)
              }}
            >
              插入当前时间标签
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (!(current as any)?.id) return
                setSaving(true)
                try {
                  await updateLyrics((current as any).id, text)
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? '保存中...' : '保存歌词'}
            </button>
            <div className="text-xs text-muted ml-auto">{duration ? `当前 ${Math.floor(progress)}/${Math.floor(duration)}s` : ''}</div>
          </div>
        </>
      )}
    </div>
  )

  if (inline) return body
  return <div className="fixed inset-0 bg-black/50 flex justify-center items-end">{body}</div>
}
