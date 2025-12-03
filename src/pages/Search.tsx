import React, { useEffect, useState } from 'react'
import { useData } from '../providers/DataProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { usePlayer } from '../providers/PlayerProvider'

export default function Search(){
  const { searchSongs } = useData()
  const { play, addToQueue } = usePlayer() as any
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const run = async () => { setLoading(true); const r = await searchSongs(q); setResults(r); setLoading(false) }
  useEffect(()=>{ run() }, [])
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <input className="search-input" placeholder="搜索歌曲、歌手、专辑、标签" value={q} onChange={e=>setQ(e.target.value)} />
        <Button variant="primary" onClick={run}>搜索</Button>
      </div>
      {loading && <div className="text-xs text-muted">正在搜索...</div>}
      <div className="card-grid">
        {results.map((s:any) => (
          <Card key={s.id}>
            <div className="card-cover">
              {s.cover_storage_path ? null : <div className="text-xs text-muted p-2">被你发现啦！我们仍在努力获取这首歌的封面</div>}
            </div>
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <div className="flex gap-2">
              <Button onClick={() => { addToQueue({ id: s.id, title: s.title, artist: s.artist, url: s.url, storage_path: s.storage_path }); play({ id: s.id, title: s.title, artist: s.artist, url: s.url, storage_path: s.storage_path }) }}>播放</Button>
              <Button onClick={() => addToQueue({ id: s.id, title: s.title, artist: s.artist, url: s.url })}>加入队列</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}