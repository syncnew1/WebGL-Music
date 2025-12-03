import React from 'react'
import { usePlayer } from '../providers/PlayerProvider'

export default function QueuePanel({ open, onClose }: { open: boolean; onClose: () => void }){
  const { queue, current } = usePlayer()
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end">
      <div className="w-[360px] h-full bg-surface border-l border-borderc p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">播放队列</div>
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
        <div className="text-xs text-muted mb-2">当前播放</div>
        {current ? (
          <div className="flex items-center gap-3 mb-4">
            <div className="album-thumb" />
            <div>
              <div className="font-semibold">{current.title}</div>
              <div className="text-xs text-muted">{current.artist ?? ''}</div>
            </div>
          </div>
        ) : <div className="text-xs text-muted mb-4">暂无播放</div>}
        <div className="text-xs text-muted mb-2">接下来</div>
        <div className="space-y-2">
          {queue.filter(q=>!current || q.id!==current.id).map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="album-thumb" />
              <div>
                <div className="font-semibold">{item.title}</div>
                <div className="text-xs text-muted">{item.artist ?? ''}</div>
              </div>
            </div>
          ))}
          {queue.length<=1 && <div className="text-xs text-muted">队列为空</div>}
        </div>
      </div>
    </div>
  )
}