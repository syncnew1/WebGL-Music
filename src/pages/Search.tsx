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

  useEffect(() => { run('') }, [])

  const handleChange = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => run(val), 300)
  }

  return (
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Search</div>
              <h2 className="page-title">全局搜索</h2>
              <p className="page-subtitle">查找歌曲、歌手、专辑与标签，快速把结果加入当前播放上下文。</p>
            </div>
            <div className={`status-chip ${loading ? 'status-chip--accent' : ''}`}>{loading ? '检索中…' : `结果 ${results.length} 条`}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="search-input"
              placeholder="搜索歌曲、歌手、专辑、标签"
              value={q}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run(q) }}
            />
            <Button variant="primary" onClick={() => run(q)}>搜索</Button>
          </div>
        </div>
      </section>
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
        {!loading && results.length === 0 && <div className="status-chip">暂无结果</div>}
      </div>
    </div>
  )
}
