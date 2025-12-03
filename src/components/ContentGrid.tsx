import React from 'react'
import UICard from './ui/Card'
import CoverImage from './CoverImage'
import Button from './ui/Button'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'

export default function ContentGrid(){
  const { songs } = useData()
  const { play, addToQueue } = usePlayer() as any
  const list = songs.slice(0, 12)
  return (
    <div className="card-grid">
      {list.map((s:any) => (
        <UICard key={s.id} className="relative">
          <CoverImage path={s.cover_storage_path} className="card-cover" />
          <div className="font-semibold">{s.title}</div>
          <div className="text-xs text-muted">{s.artist ?? ''}</div>
          <div className="flex gap-2">
            <Button onClick={() => { addToQueue({ id: s.id, title: s.title, artist: s.artist, url: s.url, storage_path: s.storage_path }); play({ id: s.id, title: s.title, artist: s.artist, url: s.url, storage_path: s.storage_path }) }}>播放</Button>
            <Button onClick={() => addToQueue({ id: s.id, title: s.title, artist: s.artist, url: s.url, storage_path: s.storage_path })}>加入队列</Button>
          </div>
        </UICard>
      ))}
      {list.length === 0 && <div className="text-xs text-muted">暂无数据，请前往“音乐库”上传或在 Supabase 添加歌曲</div>}
    </div>
  )
}
