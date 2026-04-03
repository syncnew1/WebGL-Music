import React, { useMemo, useCallback, memo } from 'react'
import UICard from './ui/Card'
import CoverImage from './CoverImage'
import Button from './ui/Button'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'
import type { Song } from '../providers/DataProvider'

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
  const list = useMemo(() => songs.slice(0, 12), [songs])

  return (
    <div className="card-grid">
      {list.map(s => (
        <SongCard key={s.id} song={s} play={play} addToQueue={addToQueue} />
      ))}
      {list.length === 0 && (
        <div className="text-xs text-muted">暂无数据，请前往"音乐库"上传或在 Supabase 添加歌曲</div>
      )}
    </div>
  )
}
