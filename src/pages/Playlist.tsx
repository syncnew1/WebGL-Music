import React from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import CoverImage from '../components/CoverImage'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../providers/AuthProvider'

export default function Playlist() {
  const { id } = useParams()
  const { user } = useAuth() as any
  const { playlists, songs, addToPlaylist, removeFromPlaylist, fetchNeteasePlaylistTracks } = useData() as any

  const pl = playlists.find((p: any) => p.id === id)
  const isNeteasePlaylist = !!id && id.startsWith('netease-pl-')
  const [shareLink, setShareLink] = React.useState<string>('')
  const [copied, setCopied] = React.useState(false)
  const [neteaseTracks, setNeteaseTracks] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!isNeteasePlaylist || !id) {
      setNeteaseTracks([])
      return
    }
    fetchNeteasePlaylistTracks(id).then(setNeteaseTracks).catch(() => setNeteaseTracks([]))
  }, [id, isNeteasePlaylist, fetchNeteasePlaylistTracks])

  if (!pl && !isNeteasePlaylist) return <div className="status-chip status-chip--danger">歌单不存在</div>

  const viewPl: any = isNeteasePlaylist
    ? { id, name: '网易云歌单', description: '来自网易云账号', is_public: false, owner_id: null }
    : pl

  const songObjs = isNeteasePlaylist
    ? neteaseTracks
    : (viewPl.songs || []).map((sid: string) => songs.find((s: any) => s.id === sid)).filter(Boolean)

  const candidateSongs = isNeteasePlaylist
    ? []
    : songs.filter((s: any) => !(viewPl.songs || []).includes(s.id))

  const canEdit = !isNeteasePlaylist && !!user && (((viewPl as any).owner_id && (viewPl as any).owner_id === user.id) || !(viewPl as any).owner_id)

  const makePublic = async (v: boolean) => {
    if (!canEdit || viewPl.name === '已点赞歌曲') return
    if (supabase && viewPl) {
      await supabase.from('playlists').update({ is_public: v }).eq('id', viewPl.id)
    }
  }

  const hashToken = async (token: string) => {
    const enc = new TextEncoder().encode(token)
    const digest = await crypto.subtle.digest('SHA-256', enc)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const createShare = async () => {
    if (!supabase || !viewPl || isNeteasePlaylist) return
    const token = crypto.randomUUID()
    const token_hash = await hashToken(token)
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('share_tokens').insert({ resource_type: 'playlist', resource_id: viewPl.id, token_hash, expires_at })
    setShareLink(`${location.origin}/playlists/${viewPl.id}?token=${token}`)
  }

  return (
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Playlist Detail</div>
              <h2 className="page-title">{viewPl.name}</h2>
              <p className="page-subtitle">{viewPl.description || '这是一张用于沉浸式播放与收藏管理的歌单。'}</p>
            </div>
            <div className={`status-chip ${isNeteasePlaylist ? 'status-chip--accent' : (viewPl.is_public ? 'status-chip--accent' : '')}`}>
              {isNeteasePlaylist ? '网易云歌单' : (viewPl.is_public ? '公开歌单' : '私有歌单')}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && viewPl.name !== '已点赞歌曲' && (
              <label className="status-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={viewPl.is_public} onChange={e => makePublic(e.target.checked)} />公开
              </label>
            )}
            {canEdit && <Button onClick={createShare}>生成私密分享链接</Button>}
            {isNeteasePlaylist && <div className="status-chip">网易云歌单只读</div>}
            {shareLink && canEdit && (
              <Button onClick={async () => {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(shareLink)
                  } else {
                    const ta = document.createElement('textarea')
                    ta.value = shareLink
                    document.body.appendChild(ta)
                    ta.select()
                    document.execCommand('copy')
                    document.body.removeChild(ta)
                  }
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                } catch {}
              }}>复制链接</Button>
            )}
            {copied && <div className="status-chip status-chip--accent">已复制链接</div>}
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">歌曲数量</div><div className="stat-value">{songObjs.length}</div></div>
        <div className="stat-card"><div className="stat-label">候选添加</div><div className="stat-value">{candidateSongs.length}</div></div>
        <div className="stat-card"><div className="stat-label">分享状态</div><div className="stat-value" style={{ fontSize: 18 }}>{shareLink ? '已生成' : '未生成'}</div></div>
      </div>

      <div className="page-heading">
        <div className="page-kicker">Tracks</div>
        <h3 className="page-title" style={{ fontSize: 24 }}>歌单歌曲</h3>
      </div>
      <div className="card-grid">
        {songObjs.map((s: any) => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            {canEdit && <Button onClick={() => removeFromPlaylist(viewPl.id, s.id)}>移除</Button>}
          </Card>
        ))}
        {songObjs.length === 0 && <div className="status-chip">歌单里还没有歌曲</div>}
      </div>

      {!isNeteasePlaylist && (
        <>
          <div className="page-heading">
            <div className="page-kicker">Add More</div>
            <h3 className="page-title" style={{ fontSize: 24 }}>添加到歌单</h3>
          </div>
          <div className="card-grid">
            {candidateSongs.map((s: any) => (
              <Card key={s.id}>
                <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-muted">{s.artist ?? ''}</div>
                {canEdit && <Button onClick={() => addToPlaylist(viewPl.id, s.id)}>添加</Button>}
              </Card>
            ))}
            {candidateSongs.length === 0 && <div className="status-chip">没有可添加的新歌曲</div>}
          </div>
        </>
      )}
    </div>
  )
}
