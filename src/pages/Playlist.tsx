import React from 'react'
import { useParams } from 'react-router-dom'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'

export default function Playlist(){
  const { id } = useParams()
  const { playlists, songs, addToPlaylist, removeFromPlaylist } = useData()
  const pl = playlists.find(p => p.id === id)
  if (!pl) return <div>歌单不存在</div>
  const [shareLink, setShareLink] = React.useState<string>('')
  const [copied, setCopied] = React.useState(false)
  const makePublic = async (v: boolean) => {
    if (supabase && pl){ await supabase.from('playlists').update({ is_public: v }).eq('id', pl.id) }
  }
  const hashToken = async (token: string) => {
    const enc = new TextEncoder().encode(token)
    const digest = await crypto.subtle.digest('SHA-256', enc)
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
  }
  const createShare = async () => {
    if (!supabase || !pl) return
    const token = crypto.randomUUID()
    const token_hash = await hashToken(token)
    const expires_at = new Date(Date.now() + 24*60*60*1000).toISOString()
    await supabase.from('share_tokens').insert({ resource_type: 'playlist', resource_id: pl.id, token_hash, expires_at })
    setShareLink(`${location.origin}/playlists/${pl.id}?token=${token}`)
  }
  const songObjs = pl.songs.map(sid => songs.find(s => s.id === sid)).filter(Boolean) as any[]
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">{pl.name}</h2>
      <div className="text-xs text-muted">{pl.description || ''}</div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted flex items-center gap-2"><input type="checkbox" checked={pl.is_public} onChange={e=>makePublic(e.target.checked)} />公开</label>
        <Button onClick={createShare}>生成私密分享链接</Button>
        {shareLink && <button className="btn" onClick={async () => {
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
            setTimeout(()=>setCopied(false), 1500)
          } catch {}
        }}>复制链接</button>}
        {copied && <div className="text-xs text-muted">已复制链接</div>}
      </div>
      <h3 className="text-lg font-semibold">歌单歌曲</h3>
      <div className="card-grid">
        {songObjs.map(s => (
          <Card key={s.id}>
            <div className="card-cover">
              {pl.name === '已点赞歌曲' ? (
                <div className="w-full h-full rounded-lg" style={{background:'linear-gradient(135deg,#6a5af9,#8a7cfb)'}}>
                  <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded-lg bg-white" style={{maskImage:'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)', WebkitMaskImage:'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)'}}></div></div>
                </div>
              ) : null}
            </div>
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <Button onClick={() => removeFromPlaylist(pl.id, s.id)}>移除</Button>
          </Card>
        ))}
      </div>
      <h3 className="text-lg font-semibold">添加到歌单</h3>
      <div className="card-grid">
        {songs.filter(s=>!pl.songs.includes(s.id)).map(s => (
          <Card key={s.id}>
            <div className="card-cover"></div>
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <Button onClick={() => addToPlaylist(pl.id, s.id)}>添加</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}