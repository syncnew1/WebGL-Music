import React, { useState } from 'react'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'
import CoverImage from '../components/CoverImage'
import { useAuth } from '../providers/AuthProvider'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function Playlists() {
  const { playlists, songs, createPlaylist, removePlaylist, musicSource, fetchNeteasePlaylists, fetchNeteasePlaylistTracks } = useData() as any
  const { play, setQueue } = usePlayer()
  const { user } = useAuth() as any
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [msg, setMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [neteasePlaylists, setNeteasePlaylists] = useState<any[]>([])

  React.useEffect(() => {
    if (musicSource !== 'netease') {
      setNeteasePlaylists([])
      return
    }
    fetchNeteasePlaylists().then(setNeteasePlaylists).catch(() => setNeteasePlaylists([]))
  }, [musicSource])

  const onCreate = async () => {
    if (!name.trim()) return
    if (isSupabaseConfigured() && !user) return setMsg('请先登录后再创建歌单')

    setCreating(true)
    try {
      await createPlaylist({ name: name.trim(), description: desc, is_public: isPublic })
      setName('')
      setDesc('')
      setIsPublic(false)
      setMsg('歌单创建成功')
      setCreateOpen(false)
    } catch (e: any) {
      setMsg(e?.message || '创建歌单失败')
    } finally {
      setCreating(false)
    }
  }

  const [playingId, setPlayingId] = useState<string | null>(null)

  const onDelete = async (pl: any) => {
    if (!confirm(`确认删除歌单「${pl.name}」吗？`)) return
    try {
      await removePlaylist(pl.id)
      setMsg('歌单已删除')
    } catch (e: any) {
      setMsg(e?.message || '删除失败')
    }
  }

  const handlePlayPlaylist = async (pl: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setPlayingId(pl.id)
    try {
      let tracks: any[] = []
      if (musicSource === 'netease') {
        const fetched = await fetchNeteasePlaylistTracks(pl.id)
        tracks = fetched.map((s: any) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          url: s.url,
          storage_path: s.storage_path,
        }))
      } else {
        tracks = (pl.songs || [])
          .map((sid: string) => songs.find((s: any) => s.id === sid))
          .filter(Boolean)
          .map((s: any) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            url: s.url,
            storage_path: s.storage_path,
          }))
      }
      if (tracks.length > 0) {
        setQueue(tracks)
        play(tracks[0])
      }
    } catch (err) {
      console.error('播放歌单失败:', err)
    } finally {
      setPlayingId(null)
    }
  }

  return (
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Playlists</div>
              <h2 className="page-title">歌单宇宙</h2>
              <p className="page-subtitle">把收藏、主题和情绪整理成独立歌单，让封面拼贴、入口操作与管理流程保持统一视觉秩序。</p>
            </div>
            <div className={`status-chip ${(musicSource === 'netease' ? neteasePlaylists.length : playlists.length) > 0 ? 'status-chip--accent' : ''}`}>共 {musicSource === 'netease' ? neteasePlaylists.length : playlists.length} 个歌单</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {musicSource === 'cloud' && <Button variant="primary" onClick={() => setCreateOpen(true)}>创建歌单</Button>}
            {musicSource === 'netease' && <div className="status-chip">网易云歌单为只读</div>}
            {msg && <div className="status-chip">{msg}</div>}
          </div>
        </div>
      </section>

      <div className="card-grid">
        {(musicSource === 'netease' ? neteasePlaylists : playlists).map((pl: any) => {
          const latestSongIds = [...(pl.songs || [])].slice(-4).reverse()
          const latestSongs = latestSongIds.map((sid: string) => songs.find((s: any) => s.id === sid)).filter(Boolean)

          return (
            <Card key={pl.id}>
              <div className="card-cover" style={{ overflow: 'hidden' }}>
                {musicSource === 'netease' && pl.cover_url ? (
                  <CoverImage url={pl.cover_url} className="w-full h-full" />
                ) : latestSongs.length > 0 ? (
                  <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2 }}>
                    {latestSongs.map((s: any, i: number) => (
                      <div key={`${pl.id}-${s.id}-${i}`} style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 4 }}>
                        <CoverImage path={s.cover_storage_path} url={s.cover_url} className="w-full h-full" />
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - latestSongs.length) }).map((_, i) => (
                      <div key={`${pl.id}-empty-${i}`} style={{ background: 'var(--surface-3)', borderRadius: 4 }} />
                    ))}
                  </div>
                ) : pl.name === '已点赞歌曲' ? (
                  <div className="w-full h-full rounded-lg" style={{ background: 'linear-gradient(135deg,#6a5af9,#8a7cfb)' }}>
                    <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded-lg bg-white" style={{ maskImage: 'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)', WebkitMaskImage: 'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)' }} /></div>
                  </div>
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))' }} />
                )}
              </div>
              <div className="font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
              <div className="text-xs text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.description || '暂无描述'}</div>
              {musicSource === 'netease' && typeof pl.trackCount === 'number' && <div className="text-xs text-muted">共 {pl.trackCount} 首</div>}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="primary" onClick={(e: React.MouseEvent) => handlePlayPlaylist(pl, e)} disabled={playingId === pl.id}>
                  {playingId === pl.id ? '加载中...' : '▶ 播放'}
                </Button>
                <Link className="btn" to={`/playlists/${pl.id}`}>查看详情</Link>
                {musicSource === 'cloud' && pl.name !== '已点赞歌曲' && !!user && pl.owner_id === user.id && <Button onClick={() => onDelete(pl)}>删除</Button>}
              </div>
            </Card>
          )
        })}
      </div>

      {createOpen && (
        <div className="modal-mask" onClick={() => !creating && setCreateOpen(false)}>
          <div className="modal-card sm:w-[520px]" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">创建歌单</div>
              <Button onClick={() => setCreateOpen(false)} disabled={creating}>关闭</Button>
            </div>
            <div className="grid gap-2">
              <input className="search-input" placeholder="歌单名称" value={name} onChange={e => setName(e.target.value)} />
              <input className="search-input" placeholder="描述" value={desc} onChange={e => setDesc(e.target.value)} />
              <label className="text-xs text-muted flex items-center gap-2"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />公共歌单</label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" onClick={onCreate} disabled={creating}>{creating ? '创建中...' : '确认创建'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
