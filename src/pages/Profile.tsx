import React from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'

export default function Profile(){
  const { user, profile, updateProfile } = useAuth() as any
  const { playlists, songs, fetchHistory, getCoverUrl } = useData() as any
  const [items, setItems] = React.useState<any[]>([])
  const [covers, setCovers] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [page, setPage] = React.useState(0)
  const [editOpen, setEditOpen] = React.useState(false)
  const [uname, setUname] = React.useState('')
  const [avatar, setAvatar] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const pageSize = 20
  React.useEffect(() => {
    (async () => {
      try {
        console.log('fetchHistory start', { page, pageSize })
        setLoading(true)
        const data = await fetchHistory(page, pageSize)
        const withSong = (data||[]).map((h:any) => ({...h, song: songs.find((s:any)=>s.id===h.song_id)}))
        withSong.sort((a:any,b:any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
        setItems(withSong)
        const list = withSong.slice(0, pageSize)
        for (const h of list){
          const sid = h.song?.id
          const p = h.song?.cover_storage_path
          if (sid && p && !covers[sid]){
            try {
              const u = await getCoverUrl(p)
              if (u) setCovers(prev => ({...prev, [sid]: u}))
            } catch {}
          }
        }
        console.log('fetchHistory done', { count: withSong.length })
      } catch (e:any) {
        console.error('fetchHistory error', e)
        setError(e?.message || '加载失败')
        setTimeout(() => setError(''), 3000)
      } finally { setLoading(false) }
    })()
  }, [page, songs])
  const nick = user ? (profile?.username || user?.user_metadata?.username || (user?.email||'').split('@')[0]) : ''
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">个人中心</h2>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full" style={{background:'#3a3a3a', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : undefined, backgroundSize:'cover', backgroundPosition:'center'}}></div>
        <div>
          <div className="font-semibold" style={{fontSize:14}}>{user ? nick : '未登录'}</div>
          <div className="text-xs text-muted">{user?.email ?? ''}</div>
        </div>
        <div className="w-2 h-2 rounded-full" style={{background: user ? '#36c36c' : '#3a3a3a'}}></div>
        {user && <button className="btn" onClick={() => { setUname(profile?.username || ''); setAvatar(profile?.avatar_url || ''); setEditOpen(true) }}>编辑个人信息</button>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-[#1c1c1c]"><div className="text-xs text-muted">歌曲数量</div><div className="font-semibold">{songs.length}</div></div>
        <div className="p-3 rounded-lg bg-[#1c1c1c]"><div className="text-xs text-muted">歌单数量</div><div className="font-semibold">{playlists.length}</div></div>
        <div className="p-3 rounded-lg bg-[#1c1c1c]"><div className="text-xs text-muted">本页历史记录</div><div className="font-semibold">{items.length}</div></div>
      </div>
      <h3 className="text-lg font-semibold">播放历史</h3>
      {loading && <div className="text-xs text-muted">正在加载...</div>}
      {error && <div className="text-xs" style={{color:'#ff4d4f'}}>{error}</div>}
      <div className="grid gap-2" style={{gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))'}}>
        {items.map((h:any) => (
          <Card key={h.id || `${h.song_id}-${h.played_at}`}>
            <div className="flex items-center gap-3">
              <div style={{width:80, height:80, borderRadius:8, background:'#2a2a2a', backgroundSize:'cover', backgroundPosition:'center', backgroundImage: h.song?.id && covers[h.song.id] ? `url(${covers[h.song.id]})` : undefined}} />
              <div>
                <div className="font-semibold" style={{fontSize:14}}>{h.song?.title || h.song_id}</div>
                <div className="text-xs text-muted">{new Date(h.played_at).toLocaleString()}</div>
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && !loading && <div className="text-xs text-muted">暂无记录</div>}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => { console.log('history prev'); setPage(p => Math.max(0, p-1)) }}>上一页</button>
        <button className="btn" onClick={() => { console.log('history next'); setPage(p => p+1) }}>下一页</button>
        <div className="text-xs text-muted">每页{pageSize}条</div>
      </div>
      <h3 className="text-lg font-semibold">我的歌单</h3>
      <div className="card-grid">
        {playlists.map((pl:any) => (
          <Card key={pl.id}><div className="card-cover"></div><div className="font-semibold">{pl.name}</div></Card>
        ))}
      </div>
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="w-full sm:w-[560px] bg-surface border border-borderc p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">编辑个人信息</div>
              <button className="btn" onClick={() => setEditOpen(false)}>关闭</button>
            </div>
            <div className="grid gap-2">
              <input className="w-full px-4 py-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="昵称" value={uname} onChange={e=>setUname(e.target.value)} />
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (!/image\/(png|jpe?g|gif)/i.test(file.type)) { setError('仅支持 JPG/PNG/GIF'); setTimeout(()=>setError(''),3000); return }
                  if (file.size > 2*1024*1024) { /* 预压缩提示，仍尝试压缩 */ }
                  const readImage = async (f: File) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(f) })
                  try {
                    const img = await readImage(file)
                    const size = Math.min(img.width, img.height)
                    const sx = (img.width - size) / 2
                    const sy = (img.height - size) / 2
                    const canvas = document.createElement('canvas')
                    const out = Math.min(512, size)
                    canvas.width = out; canvas.height = out
                    const ctx = canvas.getContext('2d')!
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out)
                    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85))
                    const aa = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
                    const { supabase } = await import('../lib/supabaseClient')
                    const uid = user?.id
                    if (!supabase || !uid) throw new Error('未登录或 Supabase 未配置')
                    const key = `${uid}/avatar-${Date.now()}.jpg`
                    const up = await supabase.storage.from('covers').upload(key, aa, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
                    if (up.error) throw new Error(up.error.message)
                    setAvatar(key)
                  } catch (e:any) { setError(e?.message || '头像处理失败'); setTimeout(()=>setError(''),3000) }
                }} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button className="btn" onClick={async () => {
                setSaving(true)
                try {
                  await updateProfile({ username: uname.trim() || undefined, avatar_url: avatar.trim() || undefined })
                  setEditOpen(false)
                } catch (e:any) {
                  setError(e?.message || '保存失败'); setTimeout(() => setError(''), 3000)
                } finally { setSaving(false) }
              }}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}