import React from 'react'
import { useData } from '../providers/DataProvider'
import { useAuth } from '../providers/AuthProvider'

type Item = { id: number; file: File; name: string; status: 'pending'|'uploading'|'done'|'error'; message?: string }

export default function BatchUpload(){
  const { uploadSong } = useData()
  const { user } = useAuth()
  const [items, setItems] = React.useState<Item[]>([])
  const [running, setRunning] = React.useState(false)
  const [log, setLog] = React.useState<string>('')
  const [dragging, setDragging] = React.useState(false)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const arr: Item[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f.type.startsWith('audio/')) continue
      arr.push({ id: Date.now() + i, file: f, name: f.name, status: 'pending' })
    }
    setItems(prev => [...prev, ...arr])
  }

  const sanitize = (s: string) => s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim()
  const parseMeta = (name: string) => {
    const base = name.replace(/\.[^.]+$/, '')
    const parts = base.split('-').map(x => x.trim())
    if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join('-') }
    return { title: base }
  }

  const start = async () => {
    if (!user) { setLog('请先登录'); return }
    if (running) return
    setRunning(true); setLog('开始上传')
    const queue = [...items]
    const concurrency = 3
    let idx = 0
    const runOne = async (it: Item) => {
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: 'uploading', message: '' } : x))
      try {
        const meta = parseMeta(it.file.name)
        await uploadSong(it.file, { title: sanitize(meta.title), artist: meta.artist ? sanitize(meta.artist) : undefined })
        setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: 'done' } : x))
      } catch (e: any) {
        setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: 'error', message: e?.message || '上传失败' } : x))
      }
    }
    const runners: Promise<void>[] = []
    while (idx < queue.length) {
      const chunk = queue.slice(idx, idx + concurrency)
      idx += concurrency
      runners.push(Promise.all(chunk.map(runOne)).then(() => {}))
    }
    await Promise.all(runners)
    setRunning(false); setLog('全部完成')
  }

  const clearAll = () => { setItems([]); setLog('') }

  // 拖拽事件处理
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const statusLabel = (s: Item['status']) =>
    s === 'pending' ? '待上传' : s === 'uploading' ? '上传中' : s === 'done' ? '完成' : '失败'

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">批量上传</h2>
      {/* 拖拽区域 */}
      <div
        className="card"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: dragging ? '2px dashed var(--accent)' : '2px dashed transparent',
          transition: 'border-color 0.2s',
          minHeight: 80,
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <label style={{ cursor: 'pointer' }}>
            <input type="file" multiple accept="audio/*" onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
            <span className="btn">选择音频文件</span>
          </label>
          <div className="text-xs text-muted">{dragging ? '松开以添加文件' : '可将音频文件拖拽至此区域'}</div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="btn" onClick={start} disabled={running || items.length === 0}>
              {running ? '上传中...' : '开始上传'}
            </button>
            <button className="btn" onClick={clearAll} disabled={running}>清空</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="text-xs text-muted mb-2">待上传文件（{items.length}）</div>
        <div className="grid" style={{gridTemplateColumns: '1fr 120px 200px', gap: 8}}>
          {items.map(it => (
            <React.Fragment key={it.id}>
              <div className="truncate">{it.name}</div>
              <div className="text-xs" style={{color: it.status === 'done' ? 'var(--accent)' : it.status === 'error' ? '#ff4d4f' : undefined}}>
                {statusLabel(it.status)}
              </div>
              <div className="text-xs text-muted truncate">{it.message || ''}</div>
            </React.Fragment>
          ))}
          {items.length === 0 && <div className="text-xs text-muted">暂无文件，请选择或拖拽音频</div>}
        </div>
      </div>
      {log && <div className="text-xs" style={{ padding: '6px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-sub)' }}>{log}</div>}
    </div>
  )
}
