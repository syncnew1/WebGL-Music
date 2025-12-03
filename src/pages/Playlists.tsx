import React, { useState } from 'react'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Link } from 'react-router-dom'

export default function Playlists(){
  const { playlists, createPlaylist } = useData()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const onCreate = async () => {
    if (!name.trim()) return
    await createPlaylist({ name: name.trim(), description: desc, is_public: isPublic })
    setName(''); setDesc(''); setIsPublic(false)
  }
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">歌单</h2>
      <div className="flex items-center gap-2">
        <input className="search-input" placeholder="歌单名称" value={name} onChange={e=>setName(e.target.value)} />
        <input className="search-input" placeholder="描述" value={desc} onChange={e=>setDesc(e.target.value)} />
        <label className="text-xs text-muted flex items-center gap-2"><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)} />公共</label>
        <Button variant="primary" onClick={onCreate}>创建歌单</Button>
      </div>
      <div className="card-grid">
        {playlists.map(pl => (
          <Card key={pl.id}>
            <div className="card-cover">
              {pl.name === '已点赞歌曲' ? (
                <div className="w-full h-full rounded-lg" style={{background:'linear-gradient(135deg,#6a5af9,#8a7cfb)'}}>
                  <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded-lg bg-white" style={{maskImage:'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)', WebkitMaskImage:'url(data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6.01 4.01 4 6.5 4c1.74 0 3.41 1.01 4.15 2.56C11.09 5.01 12.76 4 14.5 4 16.99 4 19 6.01 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>)'}}></div></div>
                </div>
              ) : null}
            </div>
            <div className="font-semibold">{pl.name}</div>
            <div className="text-xs text-muted">{pl.description || ''}</div>
            <Link className="btn" to={`/playlists/${pl.id}`}>查看详情</Link>
          </Card>
        ))}
      </div>
    </div>
  )
}