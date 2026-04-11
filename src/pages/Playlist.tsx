import React from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import CoverImage from '../components/CoverImage'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../providers/AuthProvider'

export default function Playlist(){
  const { id } = useParams()
  const { user } = useAuth() as any
  const { playlists, songs, addToPlaylist, removeFromPlaylist } = useData()
  const pl = playlists.find(p => p.id === id)
  const [shareLink, setShareLink] = React.useState<string>('')
  const [copied, setCopied] = React.useState(false)

  if (!pl) return <div className="status-chip status-chip--danger">歌单不存在</div>

  const makePublic = async (v: boolean) => {
    if (!canEdit || pl.name === '已点赞歌曲') return
    if (supabase && pl) {
      await supabase.from('playlists').update({ is_public: v }).eq('id', pl.id)
    }
  }

  const hashToken = async (token: string) => {
    const enc = new TextEncoder().encode(token)
    const digest = await crypto.subtle.digest('SHA-256', enc)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const createShare = async () => {
    if (!supabase || !pl) return
    const token = crypto.randomUUID()
    const token_hash = await hashToken(token)
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('share_tokens').insert({ resource_type: 'playlist', resource_id: pl.id, token_hash, expires_at })
    setShareLink(`${location.origin}/playlists/${pl.id}?token=${token}`)
  }

  const songObjs = pl.songs.map(sid => songs.find(s => s.id === sid)).filter(Boolean) as any[]
  const candidateSongs = songs.filter(s => !pl.songs.includes(s.id))
  const canEdit = !!user && (((pl as any).owner_id && (pl as any).owner_id === user.id) || !(pl as any).owner_id)

  return (
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Playlist Detail</div>
              <h2 className="page-title">{pl.name}</h2>
              <p className="page-subtitle">{pl.description || '这是一张用于沉浸式播放与收藏管理的歌单。'}</p>
            </div>
            <div className={`status-chip ${pl.is_public ? 'status-chip--accent' : ''}`}>{pl.is_public ? '公开歌单' : '私有歌单'}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && pl.name !== '已点赞歌曲' && (
              <label className="status-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={pl.is_public} onChange={e => makePublic(e.target.checked)} />公开
              </label>
            )}
            {canEdit && <Button onClick={createShare}>生成私密分享链接</Button>}
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
        {songObjs.map(s => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            {canEdit && <Button onClick={() => removeFromPlaylist(pl.id, s.id)}>移除</Button>}
          </Card>
        ))}
        {songObjs.length === 0 && <div className="status-chip">歌单里还没有歌曲</div>}
      </div>

      <div className="page-heading">
        <div className="page-kicker">Add More</div>
        <h3 className="page-title" style={{ fontSize: 24 }}>添加到歌单</h3>
      </div>
      <div className="card-grid">
        {candidateSongs.map(s => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            {canEdit && <Button onClick={() => addToPlaylist(pl.id, s.id)}>添加</Button>}
          </Card>
        ))}
        {candidateSongs.length === 0 && <div className="status-chip">没有可添加的新歌曲</div>}
      </div>
    </div>
  )
}
