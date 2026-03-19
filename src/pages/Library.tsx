import React, { useRef, useState } from 'react'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import CoverImage from '../components/CoverImage'
import { useAuth } from '../providers/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'

export default function Library(){
  const { songs, uploadSong, removeSong } = useData()
  const { user } = useAuth()
  const { play, addToQueue } = usePlayer()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const onUpload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) { setMsg('请选择一个音频文件'); return }
    if (isSupabaseConfigured() && !user) { setMsg('请先登录后再上传'); return }
    setBusy(true); setMsg('正在上传...')
    try {
      await uploadSong(f, { title: title || f.name, artist, album })
      setMsg('上传成功')
    } catch (e: any) {
      setMsg(e?.message || '上传失败，请稍后重试')
    } finally {
      setBusy(false)
    }
    fileRef.current!.value = ''
    setTitle(''); setArtist(''); setAlbum('')
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">音乐库</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input className="search-input" placeholder="标题" value={title} onChange={e => setTitle(e.target.value)} />
        <input className="search-input" placeholder="歌手" value={artist} onChange={e => setArtist(e.target.value)} />
        <input className="search-input" placeholder="专辑" value={album} onChange={e => setAlbum(e.target.value)} />
        <input ref={fileRef} type="file" accept="audio/*" />
        <Button variant="primary" onClick={onUpload} disabled={busy}>{busy ? '上传中...' : '上传'}</Button>
      </div>
      {msg && <div className="text-xs text-muted">{msg}</div>}
      {!isSupabaseConfigured() && <div className="text-xs text-muted">未配置 Supabase，上传仅在本地内存中展示，刷新后不会保留</div>}
      <div className="card-grid">
        {songs.map(s => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <div className="flex flex-wrap gap-1 items-center">
              {(s.tags || []).map((t, i) => (<span key={i} className="text-xs user-chip">{t}</span>))}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => play(toTrack(s))}>播放</Button>
              <Button onClick={() => addToQueue(toTrack(s))}>加入队列</Button>
              <Button onClick={() => removeSong(s.id)}>删除</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
