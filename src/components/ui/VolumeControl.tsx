import React from 'react'
import { MdVolumeUp, MdVolumeOff } from 'react-icons/md'
import { usePlayer } from '../../providers/PlayerProvider'

type Props = {
  onChangeVolume?: (v: number, ms?: number) => void
  onToggleMute?: () => void
  value?: number
  muted?: boolean
}

export default function VolumeControl(p: Props){
  const ctx = usePlayer()
  const ramp = p.onChangeVolume || ctx.rampVolume
  const toggle = p.onToggleMute || ctx.toggleMute
  const vol = typeof p.value === 'number' ? p.value : ctx.volume
  const isMuted = typeof p.muted === 'boolean' ? p.muted : ctx.muted
  const [open, setOpen] = React.useState(false)
  const dpr = (typeof window !== 'undefined' && (window as any).devicePixelRatio) ? (window as any).devicePixelRatio : 1
  const width = dpr > 1.5 ? 160 : 120
  const height = dpr > 1.5 ? 12 : 8
  const barRef = React.useRef<HTMLDivElement | null>(null)

  const setByClientX = (clientX: number) => {
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = Math.min(1, Math.max(0, x / rect.width))
    ramp(ratio, 100)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ramp(Math.min(1, vol + 0.05), 100)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ramp(Math.max(0, vol - 0.05), 100)
    else if (e.key === 'Home') ramp(0, 100)
    else if (e.key === 'End') ramp(1, 100)
    else if (e.key.toLowerCase() === 'm') toggle()
  }

  return (
    <div className="relative" aria-label="音量控制" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      <button className={`btn-circle ${isMuted ? 'bg-[#444]' : ''}`} aria-label={isMuted ? '取消静音' : '静音'} onClick={toggle} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}>
        {isMuted ? <MdVolumeOff className="icon" /> : <MdVolumeUp className="icon" />}
      </button>
      <div className={`vc-pop ${open ? 'show' : ''}`} style={{position:'absolute', bottom:36, right:0}}>
        <div role="slider" aria-label="音量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vol*100)} tabIndex={0} onKeyDown={onKey} className="volume" ref={barRef} style={{width, height}} onMouseDown={(e) => {
          setByClientX((e as any).clientX)
          const move = (ev: MouseEvent) => setByClientX(ev.clientX)
          const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
          window.addEventListener('mousemove', move)
          window.addEventListener('mouseup', up)
        }} onClick={(e) => setByClientX((e as any).clientX)}>
          <div style={{width: `${Math.min(100, Math.max(0, vol*100))}%`}}></div>
        </div>
      </div>
    </div>
  )
}

