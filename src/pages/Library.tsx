import React, { useMemo, useRef, useState } from 'react'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import CoverImage from '../components/CoverImage'
import { useAuth } from '../providers/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'

type FillOpt = { cover: boolean; lyrics: boolean }

export default function Library() {
  const { songs, uploadSong, removeSong, autoFillSongMeta } = useData() as any
  const { user } = useAuth()
  const { play, addToQueue } = usePlayer()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fillOpts, setFillOpts] = useState<Record<string, FillOpt>>({})
  const [batchBusy, setBatchBusy] = useState(false)

  const songIds = useMemo(() => songs.map((s: any) => s.id), [songs])

  const shortName = (s: any) => {
    const n = (s.title || '').trim() || '未命名'
    return n.length > 18 ? `${n.slice(0, 18)}…` : n
  }

  const ensureOpt = (id: string): FillOpt => fillOpts[id] || { cover: true, lyrics: true }

  const togglePick = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    setSelectedIds(prev => (prev.size === songIds.length ? new Set() : new Set(songIds)))
  }

  const setSongOpt = (id: string, patch: Partial<FillOpt>) => {
    setFillOpts(prev => ({ ...prev, [id]: { ...ensureOpt(id), ...patch } }))
  }

  const runBatchFill = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return setMsg('请先选择至少一首歌曲')
    setBatchBusy(true)
    let ok = 0
    let fail = 0
    try {
      for (const id of ids) {
        try {
          await autoFillSongMeta(id, ensureOpt(id))
          ok++
        } catch {
          fail++
        }
      }
      setMsg(`补全完成：成功 ${ok} 首，失败 ${fail} 首`)
      setFillOpen(false)
    } finally {
      setBatchBusy(false)
    }
  }

  const onUpload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) return setMsg('请选择一个音频文件')
    if (isSupabaseConfigured() && !user) return setMsg('请先登录后再上传')

    setBusy(true)
    setMsg('正在上传...')
    try {
      await uploadSong(f, { title: title || f.name, artist, album })
      setMsg('上传成功')
      setUploadOpen(false)
      setTitle('')
      setArtist('')
      setAlbum('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      setMsg(e?.message || '上传失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">音乐库</h2>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setUploadOpen(true)}>上传音乐</Button>
        <Button onClick={() => setFillOpen(true)}>补全封面/歌词</Button>
      </div>

      {msg && <div className="text-xs text-muted">{msg}</div>}
      {!isSupabaseConfigured() && <div className="text-xs text-muted">未配置 Supabase，上传仅在本地内存中展示，刷新后不会保留</div>}

      <div className="card-grid">
        {songs.map((s: any) => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <div className="flex flex-wrap gap-1 items-center">
              {(s.tags || []).map((t: string, i: number) => (<span key={i} className="text-xs user-chip">{t}</span>))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => play(toTrack(s))}>播放</Button>
              <Button onClick={() => addToQueue(toTrack(s))}>加入队列</Button>
              <Button onClick={() => removeSong(s.id)}>删除</Button>
            </div>
          </Card>
        ))}
      </div>

      {uploadOpen && (
        <div className="modal-mask" onClick={() => !busy && setUploadOpen(false)}>
          <div className="modal-card sm:w-[640px]" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">上传音乐</div>
              <Button onClick={() => setUploadOpen(false)} disabled={busy}>关闭</Button>
            </div>
            <div className="grid gap-2">
              <input className="search-input" placeholder="标题" value={title} onChange={e => setTitle(e.target.value)} />
              <input className="search-input" placeholder="歌手" value={artist} onChange={e => setArtist(e.target.value)} />
              <input className="search-input" placeholder="专辑" value={album} onChange={e => setAlbum(e.target.value)} />
              <label style={{ cursor: 'pointer' }}><span className="btn">选择音频文件</span><input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} /></label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" onClick={onUpload} disabled={busy}>{busy ? '上传中...' : '开始上传'}</Button>
            </div>
          </div>
        </div>
      )}

      {fillOpen && (
        <div className="modal-mask" onClick={() => !batchBusy && setFillOpen(false)}>
          <div className="modal-card sm:w-[760px]" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">补全封面/歌词</div>
              <Button onClick={() => setFillOpen(false)} disabled={batchBusy}>关闭</Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Button onClick={toggleAll}>{selectedIds.size === songIds.length ? '取消全选' : '全选'}</Button>
              <div className="text-xs text-muted">已选 {selectedIds.size} / {songIds.length}</div>
              <Button variant="primary" onClick={runBatchFill} disabled={batchBusy}>{batchBusy ? '补全中...' : '开始补全选中歌曲'}</Button>
            </div>
            <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
              {songs.map((s: any) => {
                const opt = ensureOpt(s.id)
                const picked = selectedIds.has(s.id)
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg" style={{ padding: '8px 10px', border: '1px solid var(--border)' }}>
                    <label className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <input type="checkbox" checked={picked} onChange={() => togglePick(s.id)} />
                      <span className="text-sm" title={s.title}>{shortName(s)}</span>
                    </label>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={opt.cover} onChange={e => setSongOpt(s.id, { cover: e.target.checked })} />封面</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={opt.lyrics} onChange={e => setSongOpt(s.id, { lyrics: e.target.checked })} />歌词</label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
