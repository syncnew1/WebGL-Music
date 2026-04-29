import React, { useMemo, useCallback, memo } from 'react'
import UICard from './ui/Card'
import CoverImage from './CoverImage'
import Button from './ui/Button'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'
import type { Song } from '../providers/DataProvider'

const getSongDisplayLimit = () => {
  if (typeof window === 'undefined') return 18
  const width = window.innerWidth
  if (width < 640) return 8
  if (width < 1024) return 12
  if (width < 1440) return 18
  return 24
}

function useResponsiveSongLimit() {
  const [limit, setLimit] = React.useState(getSongDisplayLimit)

  React.useEffect(() => {
    const updateLimit = () => setLimit(getSongDisplayLimit())
    updateLimit()
    window.addEventListener('resize', updateLimit, { passive: true })
    return () => window.removeEventListener('resize', updateLimit)
  }, [])

  return limit
}

type CardProps = { song: Song; play: (s: Song) => void; addToQueue: (s: Song) => void }
const SongCard = memo(function SongCard({ song, play, addToQueue }: CardProps) {
  const handlePlay = useCallback(() => {
    const t = toTrack(song)
    addToQueue(t)
    play(t)
  }, [song, play, addToQueue])

  const handleQueue = useCallback(() => {
    addToQueue(toTrack(song))
  }, [song, addToQueue])

  return (
    <UICard className="relative">
      <CoverImage path={song.cover_storage_path} url={song.cover_url} className="card-cover" />
      <div className="font-semibold">{song.title}</div>
      <div className="text-xs text-muted">{song.artist ?? ''}</div>
      <div className="flex gap-2">
        <Button onClick={handlePlay}>播放</Button>
        <Button onClick={handleQueue}>加入队列</Button>
      </div>
    </UICard>
  )
})

export default function ContentGrid(){
  const { songs } = useData()
  const { play, addToQueue } = usePlayer()
  const displayLimit = useResponsiveSongLimit()
  const list = useMemo(() => songs.slice(0, displayLimit), [songs, displayLimit])

  return (
    <div className="grid gap-4">
      <div className="panel-shell panel-shell--soft" style={{ padding: 16 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="page-kicker" style={{ marginBottom: 6 }}>Featured Picks</div>
            <div className="text-sm" style={{ color: 'var(--text-sub)' }}>选择一首开始播放，或先加入队列构建你的沉浸式流程。</div>
          </div>
          <div className="status-chip">已展示 {list.length} / {songs.length}</div>
        </div>
      </div>

      <div className="card-grid">
        {list.map(s => (
          <SongCard key={s.id} song={s} play={play} addToQueue={addToQueue} />
        ))}
        {list.length === 0 && (
          <div className="status-chip">暂无数据，请前往“音乐库”上传或在 Supabase 添加歌曲</div>
        )}
      </div>
    </div>
  )
}
