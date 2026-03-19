import React from 'react'
import UICard from './ui/Card'
import CoverImage from './CoverImage'
import Button from './ui/Button'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'

export default function ContentGrid(){
  const { songs } = useData()
  const { play, addToQueue } = usePlayer()
  const list = songs.slice(0, 12)
  return (
    <div className="card-grid">
      {list.map(s => (
        <UICard key={s.id} className="relative">
          <CoverImage path={s.cover_storage_path} className="card-cover" />
          <div className="font-semibold">{s.title}</div>
          <div className="text-xs text-muted">{s.artist ?? ''}</div>
          <div className="flex gap-2">
            <Button onClick={() => { addToQueue(toTrack(s)); play(toTrack(s)) }}>播放</Button>
            <Button onClick={() => addToQueue(toTrack(s))}>加入队列</Button>
          </div>
        </UICard>
      ))}
      {list.length === 0 && <div className="text-xs text-muted">暂无数据，请前往"音乐库"上传或在 Supabase 添加歌曲</div>}
    </div>
  )
}
