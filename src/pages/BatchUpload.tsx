import React from 'react'
import { useData } from '../providers/DataProvider'
import { useAuth } from '../providers/AuthProvider'

type Item = { id: number; file: File; name: string; status: 'pending'|'uploading'|'done'|'error'; message?: string }

export default function BatchUpload(){
  const { uploadSong } = useData() as any
  const { user } = useAuth() as any
  const [items, setItems] = React.useState<Item[]>([])
  const [running, setRunning] = React.useState(false)
  const [log, setLog] = React.useState<string>('')

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const arr: Item[] = []
    for (let i=0;i<files.length;i++){
      const f = files[i]
      arr.push({ id: Date.now()+i, file: f, name: f.name, status: 'pending' })
    }
    setItems(prev => [...prev, ...arr])
  }

  const sanitize = (s: string) => s.normalize('NFKD').replace(/[^\x00-\x7F]/g,'').replace(/\s+/g,' ').trim()
  const parseMeta = (name: string) => {
    const base = name.replace(/\.[^.]+$/, '')
    const parts = base.split('-').map(x=>x.trim())
    if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join('-') }
    return { title: base }
  }

  const start = async () => {
    if (!user){ setLog('请先登录'); return }
    if (running) return
    setRunning(true)
    setLog('开始上传')
    const queue = [...items]
    const concurrency = 3
    let idx = 0
    const runOne = async (it: Item) => {
      setItems(prev => prev.map(x => x.id===it.id ? { ...x, status: 'uploading', message: '' } : x))
      try {
        const meta = parseMeta(it.file.name)
        await uploadSong(it.file, { title: sanitize(meta.title), artist: meta.artist ? sanitize(meta.artist) : undefined })
        setItems(prev => prev.map(x => x.id===it.id ? { ...x, status: 'done' } : x))
      } catch (e:any) {
        setItems(prev => prev.map(x => x.id===it.id ? { ...x, status: 'error', message: e?.message || '上传失败' } : x))
      }
    }
    const runners: Promise<void>[] = []
    while (idx < queue.length){
      const chunk = queue.slice(idx, idx+concurrency)
      idx += concurrency
      runners.push(Promise.all(chunk.map(runOne)).then(()=>{}))
    }
    await Promise.all(runners)
    setRunning(false)
    setLog('全部完成')
  }

  const clearAll = () => { setItems([]); setLog('') }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">批量上传</h2>
      <div className="card">
        <div className="flex items-center gap-3">
          <input type="file" multiple accept="audio/*" onChange={e=>addFiles(e.target.files)} />
          <div className="text-xs text-muted">支持拖拽至此区域</div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={start} disabled={running || items.length===0}>{running ? '上传中...' : '开始上传'}</button>
            <button className="btn" onClick={clearAll} disabled={running}>清空</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="text-xs text-muted mb-2">待上传文件（{items.length}）</div>
        <div className="grid" style={{gridTemplateColumns:'1fr 120px 200px', gap:8}}>
          {items.map(it => (
            <React.Fragment key={it.id}>
              <div className="truncate">{it.name}</div>
              <div className="text-xs">{it.status==='pending' ? '待上传' : it.status==='uploading' ? '上传中' : it.status==='done' ? '完成' : '失败'}</div>
              <div className="text-xs text-muted truncate">{it.message || ''}</div>
            </React.Fragment>
          ))}
          {items.length===0 && <div className="text-xs text-muted">暂无文件</div>}
        </div>
      </div>
      {log && <div className="text-xs" style={{padding:'6px 8px', background:'#2a2a2a', borderRadius:8}}>{log}</div>}
    </div>
  )
}