import React from 'react'

export default function DevicePanel({ open, onClose }: { open: boolean; onClose: () => void }){
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end">
      <div className="w-[320px] h-full bg-surface border-l border-borderc p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">设备</div>
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent"></div><div>此浏览器</div></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#2a2a2a]"></div><div>手机设备（未连接）</div></div>
        </div>
      </div>
    </div>
  )
}