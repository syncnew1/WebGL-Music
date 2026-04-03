import React from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../providers/AuthProvider'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import CoverImage from '../components/CoverImage'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuth() as any
  const { playlists, songs, fetchHistory, getCoverUrl } = useData() as any

  const [items, setItems] = React.useState<any[]>([])
  const [covers, setCovers] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [editOpen, setEditOpen] = React.useState(false)
  const [uname, setUname] = React.useState('')
  const [avatar, setAvatar] = React.useState('')
  const [avatarPreview, setAvatarPreview] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [formMsg, setFormMsg] = React.useState('')
  const pageSize = 20

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const data = await fetchHistory(page, pageSize)
        const withSong = (data || []).map((h: any) => ({ ...h, song: songs.find((s: any) => s.id === h.song_id) }))
        withSong.sort((a: any, b: any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
        setItems(withSong)

        const list = withSong.slice(0, pageSize)
        for (const h of list) {
          const sid = h.song?.id
          const p = h.song?.cover_storage_path
          const u0 = h.song?.cover_url
          if (sid && !covers[sid]) {
            if (p) {
              try {
                const u = await getCoverUrl(p)
                if (u) setCovers(prev => ({ ...prev, [sid]: u }))
              } catch {}
            } else if (u0) {
              setCovers(prev => ({ ...prev, [sid]: u0 }))
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || '加载失败')
        setTimeout(() => setError(''), 3000)
      } finally {
        setLoading(false)
      }
    })()
  }, [page, songs])

  React.useEffect(() => {
    const raw = profile?.avatar_url || ''
    if (!raw) {
      setAvatarPreview('')
      return
    }
    if (/^https?:\/\//i.test(raw)) {
      setAvatarPreview(raw)
      return
    }
    if (!supabase) {
      setAvatarPreview('')
      return
    }
    supabase.storage.from('covers').createSignedUrl(raw, 60 * 60 * 24)
      .then(({ data }) => setAvatarPreview(data?.signedUrl || ''))
      .catch(() => setAvatarPreview(''))
  }, [profile?.avatar_url])

  const nick = user ? (profile?.username || user?.user_metadata?.username || (user?.email || '').split('@')[0]) : ''
  const headerAvatar = avatarPreview || (/^https?:\/\//i.test(avatar) ? avatar : '')

  const handleSignOut = async () => {
    await signOut()
    window.location.replace('/login')
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">个人中心</h2>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full" style={{ background: '#3a3a3a', backgroundImage: headerAvatar ? `url(${headerAvatar})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        <div>
          <div className="font-semibold" style={{ fontSize: 14 }}>{user ? nick : '未登录'}</div>
          <div className="text-xs text-muted">{user?.email ?? ''}</div>
        </div>
        <div className="w-2 h-2 rounded-full" style={{ background: user ? '#36c36c' : '#3a3a3a' }}></div>
        {user && <button className="btn" onClick={() => { setUname(profile?.username || ''); setAvatar(profile?.avatar_url || ''); setFormMsg(''); setEditOpen(true) }}>编辑个人信息</button>}
        {user && <button className="btn" style={{ marginLeft: 8, color: '#ff4d4f' }} onClick={handleSignOut}>退出登录</button>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}><div className="text-xs text-muted">歌曲数量</div><div className="font-semibold">{songs.length}</div></div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}><div className="text-xs text-muted">歌单数量</div><div className="font-semibold">{playlists.length}</div></div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}><div className="text-xs text-muted">本页历史记录</div><div className="font-semibold">{items.length}</div></div>
      </div>

      <h3 className="text-lg font-semibold">我的歌单</h3>
      <div className="card-grid">
        {playlists.map((pl: any) => {
          const latestSongIds = [...(pl.songs || [])].slice(-4).reverse()
          const latestSongs = latestSongIds.map((sid: string) => songs.find((s: any) => s.id === sid)).filter(Boolean)
          return (
            <Card key={pl.id}>
              <div className="card-cover" style={{ overflow: 'hidden' }}>
                {latestSongs.length > 0 ? (
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
                ) : null}
              </div>
              <div className="font-semibold">{pl.name}</div>
            </Card>
          )
        })}
      </div>

      <h3 className="text-lg font-semibold">播放历史</h3>
      {loading && <div className="text-xs text-muted">正在加载...</div>}
      {error && <div className="text-xs" style={{ color: '#ff4d4f' }}>{error}</div>}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {items.map((h: any) => (
          <Card key={h.id || `${h.song_id}-${h.played_at}`}>
            <div className="flex items-center gap-3">
              <div style={{ width: 80, height: 80, borderRadius: 8, background: '#2a2a2a', backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: h.song?.id && covers[h.song.id] ? `url(${covers[h.song.id]})` : undefined }} />
              <div>
                <div className="font-semibold" style={{ fontSize: 14 }}>{h.song?.title || h.song_id}</div>
                <div className="text-xs text-muted">{new Date(h.played_at).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && <div className="text-xs text-muted">暂无记录</div>}
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setPage((p: number) => Math.max(0, p - 1))}>上一页</button>
        <button className="btn" onClick={() => setPage((p: number) => p + 1)}>下一页</button>
        <div className="text-xs text-muted">每页{pageSize}条</div>
      </div>

      {editOpen && (
        <div className="modal-mask">
          <div className="modal-card sm:w-[560px]">
            <div className="modal-header">
              <div className="modal-title">编辑个人信息</div>
              <button className="btn" onClick={() => setEditOpen(false)}>关闭</button>
            </div>

            <div className="grid gap-2">
              <input style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} placeholder="昵称" value={uname} onChange={e => setUname(e.target.value)} />
              <div className="flex items-center gap-2">
                <label style={{ cursor: 'pointer' }}>
                  <span className="btn">选择头像图片</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!/image\/(png|jpe?g|gif)/i.test(file.type)) { setError('仅支持 JPG/PNG/GIF'); setTimeout(() => setError(''), 3000); return }

                    const readImage = async (f: File) => new Promise<HTMLImageElement>((resolve, reject) => {
                      const img = new Image()
                      img.onload = () => resolve(img)
                      img.onerror = reject
                      img.src = URL.createObjectURL(f)
                    })

                    try {
                      const img = await readImage(file)
                      const size = Math.min(img.width, img.height)
                      const sx = (img.width - size) / 2
                      const sy = (img.height - size) / 2
                      const canvas = document.createElement('canvas')
                      const out = Math.min(512, size)
                      canvas.width = out
                      canvas.height = out
                      const ctx = canvas.getContext('2d')!
                      ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out)
                      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85))
                      const aa = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
                      const uid = user?.id
                      if (!supabase || !uid) throw new Error('未登录或 Supabase 未配置')

                      const key = `${uid}/avatar-${Date.now()}.jpg`
                      const up = await supabase.storage.from('covers').upload(key, aa, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
                      if (up.error) throw new Error(up.error.message)

                      setAvatar(key)
                      const { data } = await supabase.storage.from('covers').createSignedUrl(key, 60 * 60 * 24)
                      setAvatarPreview(data?.signedUrl || '')
                      setFormMsg('头像已上传，点击“保存”后生效')
                    } catch (e: any) {
                      setError(e?.message || '头像处理失败')
                      setTimeout(() => setError(''), 3000)
                    }
                  }} />
                </label>
                <div className="text-xs text-muted">支持 JPG/PNG/GIF，自动裁剪为正方形</div>
              </div>
              {!!avatarPreview && <div className="text-xs" style={{ color: 'var(--accent)' }}>头像已准备好，点击保存即可更新</div>}
              {!!formMsg && <div className="text-xs" style={{ color: 'var(--accent)' }}>{formMsg}</div>}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button className="btn" onClick={async () => {
                setSaving(true)
                try {
                  await updateProfile({ username: uname.trim() || undefined, avatar_url: avatar.trim() || undefined })
                  setFormMsg('保存成功')
                  setEditOpen(false)
                } catch (e: any) {
                  setError(e?.message || '保存失败')
                  setTimeout(() => setError(''), 3000)
                } finally {
                  setSaving(false)
                }
              }}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
