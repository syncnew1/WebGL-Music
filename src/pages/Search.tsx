import React, { useEffect, useRef, useState } from 'react'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import CoverImage from '../components/CoverImage'
import { toTrack } from '../lib/trackUtils'
import type { Song } from '../providers/DataProvider'

export default function Search(){
  const { searchSongs } = useData()
  const { play, addToQueue } = usePlayer()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Song[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = async (query: string) => {
    setLoading(true)
    const r = await searchSongs(query)
    setResults(r)
    setLoading(false)
  }

  // 初始加载
  useEffect(() => { run('') }, [])

  // 输入变化防抖 300ms
  const handleChange = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => run(val), 300)
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <input
          className="search-input"
          placeholder="搜索歌曲、歌手、专辑、标签"
          value={q}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run(q) }}
        />
        <Button variant="primary" onClick={() => run(q)}>搜索</Button>
      </div>
      {loading && <div className="text-xs text-muted">正在搜索...</div>}
      <div className="card-grid">
        {results.map((s: Song) => (
          <Card key={s.id}>
            <CoverImage path={s.cover_storage_path} url={s.cover_url} className="card-cover" />
            <div className="font-semibold">{s.title}</div>
            <div className="text-xs text-muted">{s.artist ?? ''}</div>
            <div className="flex gap-2">
              <Button onClick={() => { addToQueue(toTrack(s)); play(toTrack(s)) }}>播放</Button>
              <Button onClick={() => addToQueue(toTrack(s))}>加入队列</Button>
            </div>
          </Card>
        ))}
        {!loading && results.length === 0 && <div className="text-xs text-muted">暂无结果</div>}
      </div>
    </div>
  )
}
