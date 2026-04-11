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
  const { user, profile } = useAuth()
  const canFill = !!user && (
    user?.id === '18d821ab-b967-4d21-849f-1e88c7785683' ||
    (user?.email || '') === '2031134102@qq.com'
  )
  const { play, addToQueue } = usePlayer()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [msg, setMsg] = useState('')
  const showMsg = msg && (!(msg.startsWith('补全') && !canFill)) ? msg : ''
  const [busy, setBusy] = useState(false)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)
  const [fillMsg, setFillMsg] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fillOpts, setFillOpts] = useState<Record<string, FillOpt>>({})
  const [batchBusy, setBatchBusy] = useState(false)
  const [fillProgress, setFillProgress] = useState({ total: 0, done: 0 })
  const [coverOverride, setCoverOverride] = useState(false)
  const [lyricsOverride, setLyricsOverride] = useState(false)
  const batchCancelRef = useRef(false)

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
    if (!canFill) {
      const tip = '仅 test01 账号允许补全封面/歌词'
      setMsg(tip)
      setFillMsg(tip)
      return
    }
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      const tip = '请先选择至少一首歌曲'
      setMsg(tip)
      setFillMsg(tip)
      return
    }
    const songMap = new Map(songs.map((s: any) => [s.id, s]))
    const needsAny = ids.some(id => {
      const s = songMap.get(id)
      if (!s) return false
      const hasCover = !!s.cover_url || !!s.cover_storage_path
      const hasLyrics = !!(s.lyrics && s.lyrics.trim().length > 0)
      return (!hasCover && !coverOverride) || (!hasLyrics && !lyricsOverride) || coverOverride || lyricsOverride
    })
    if (!needsAny) {
      const tip = '所选歌曲已包含封面/歌词，无需补全'
      setMsg(tip)
      setFillMsg(tip)
      return
    }
    const opts = (id: string) => {
      const s = songMap.get(id)
      const hasCover = !!s?.cover_url || !!s?.cover_storage_path
      const hasLyrics = !!(s?.lyrics && s?.lyrics.trim().length > 0)
      return {
        ...ensureOpt(id),
        cover: coverOverride ? true : !hasCover,
        lyrics: lyricsOverride ? true : !hasLyrics,
      }
    }

    setBatchBusy(true)
    batchCancelRef.current = false
    setFillProgress({ total: ids.length, done: 0 })
    setFillMsg('正在补全...')
    const concurrency = 3
    let ok = 0
    let fail = 0
    const failed: { id: string; title: string; reason: string }[] = []
    const queue = [...ids]

    const runOne = async () => {
      while (queue.length > 0 && !batchCancelRef.current) {
        const id = queue.shift()!
        const song = songs.find((s: any) => s.id === id)
        const title = song?.title || id
        try {
          const res = await autoFillSongMeta(id, opts(id))
          if (res?.cover || res?.lyrics) ok++
          else {
            fail++
            failed.push({ id, title, reason: '未获取到歌词或封面' })
          }
        } catch (e: any) {
          fail++
          failed.push({ id, title, reason: e?.message || '补全失败' })
        } finally {
          setFillProgress(p => ({ ...p, done: Math.min(p.total, p.done + 1) }))
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, runOne))
      const summary = `补全完成：成功 ${ok} 首，失败 ${fail} 首`
      setMsg(summary)
      setFillMsg(summary)
      if (failed.length > 0) {
        console.warn('补全失败列表', failed)
      }
      if (fail === 0 && !batchCancelRef.current) setFillOpen(false)
      if (!batchCancelRef.current) setSelectedIds(new Set())
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
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Library</div>
              <h2 className="page-title">音乐库</h2>
              <p className="page-subtitle">统一管理上传歌曲、批量补全元信息，并让资源入口与卡片区保持同一视觉语法。</p>
            </div>
            <div className={`status-chip ${isSupabaseConfigured() ? 'status-chip--accent' : ''}`}>{isSupabaseConfigured() ? '云端同步已启用' : '本地模式'}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setUploadOpen(true)}>上传音乐</Button>
            {canFill && <Button onClick={() => setFillOpen(true)}>补全封面/歌词</Button>}
            {showMsg && <div className="status-chip">{showMsg}</div>}
          </div>
        </div>
      </section>

      <div className="card-grid">
        {songs.map((s: any) => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <div className="flex flex-wrap gap-1 items-center">
              {(s.tags || []).map((t: string, i: number) => (<span key={i} className="status-chip">{t}</span>))}
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
              <Button onClick={toggleAll} disabled={batchBusy}>{selectedIds.size === songIds.length ? '取消全选' : '全选'}</Button>
              <div className="status-chip">已选 {selectedIds.size} / {songIds.length}</div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={coverOverride} onChange={e => setCoverOverride(e.target.checked)} />覆盖封面</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={lyricsOverride} onChange={e => setLyricsOverride(e.target.checked)} />覆盖歌词</label>
              </div>
              <Button variant="primary" onClick={runBatchFill} disabled={batchBusy}>{batchBusy ? '补全中...' : '开始补全选中歌曲'}</Button>
              {batchBusy && <Button onClick={() => { batchCancelRef.current = true; setFillMsg('已终止补全'); }} variant="ghost">终止</Button>}
              {fillMsg && <div className="status-chip">{fillMsg}</div>}
            </div>
            {batchBusy && fillProgress.total > 0 && (
              <div className="mb-3">
                <div className="text-xs text-muted mb-1">进度 {fillProgress.done} / {fillProgress.total}</div>
                <div className="h-2 rounded-full" style={{ background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round((fillProgress.done / fillProgress.total) * 100)}%`,
                      background: 'linear-gradient(90deg, var(--accent), #6ab7ff)',
                      transition: 'width 220ms ease',
                    }}
                  />
                </div>
              </div>
            )}
            <div className="grid gap-2 max-h-[420px] overflow-auto pr-1">
              {songs.map((s: any) => {
                const opt = ensureOpt(s.id)
                const picked = selectedIds.has(s.id)
                return (
                  <div key={s.id} className="panel-shell panel-shell--soft flex items-center justify-between" style={{ padding: '10px 12px', minWidth: 0 }}>
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
