
import React, { useRef, useEffect } from 'react'
import type { AnalysisFrame } from '../../visualizer/AudioAnalyzer'

export function SpatialRadar({ frame }: { frame: AnalysisFrame }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = c.width = c.clientWidth * dpr
    const h = c.height = c.clientHeight * dpr
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4
    ctx.clearRect(0, 0, w, h)
    // 同心圆
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + i * 0.02})`; ctx.lineWidth = 1; ctx.stroke()
    }
    // 方位线 + 标签
    const dirs = ['前','右前','右','右后','后','左后','左','左前']
    dirs.forEach((lbl, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke()
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.font = `${Math.max(9, R * 0.09 / dpr)}px DM Sans,sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(lbl, cx + Math.cos(a) * (R + 14 * dpr), cy + Math.sin(a) * (R + 14 * dpr))
      }
    })
    // 中心点
    ctx.beginPath(); ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill()
    // 乐器
    frame.instruments.forEach(inst => {
      const a = (inst.angle - 90) * Math.PI / 180
      const r = inst.distance * R
      const ix = cx + Math.cos(a) * r, iy = cy + Math.sin(a) * r
      const rad = (5 + inst.energy * 16) * dpr
      // 光晕
      const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, rad * 2.5)
      g.addColorStop(0, inst.color + 'aa'); g.addColorStop(1, inst.color + '00')
      ctx.beginPath(); ctx.arc(ix, iy, rad * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = g; ctx.fill()
      // 圆
      ctx.beginPath(); ctx.arc(ix, iy, rad, 0, Math.PI * 2)
      ctx.fillStyle = inst.color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1
      // 图标
      ctx.font = `${Math.max(10, rad * 1.1)}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(inst.icon, ix, iy)
      // 标签
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = `${Math.max(9, 10 * dpr)}px DM Sans,sans-serif`
      ctx.fillText(inst.name, ix, iy + rad + 10 * dpr)
    })
  }, [frame])
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#727272',marginBottom:8}}>声场分布</div>
      <canvas ref={ref} style={{width:'100%',height:260,display:'block',borderRadius:8}} />
    </div>
  )
}

export function HarmonyWheel({ frame }: { frame: AnalysisFrame }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = c.width = c.clientWidth * dpr
    const h = c.height = c.clientHeight * dpr
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.38
    ctx.clearRect(0, 0, w, h)
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    const active = new Map(frame.harmony.map(n => [n.name, n.energy]))
    NOTES.forEach((note, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      const arc = Math.PI * 2 / 12
      const e = active.get(note) ?? 0
      const rI = R * 0.42, rO = R * (0.7 + e * 0.3)
      ctx.beginPath()
      ctx.arc(cx, cy, rO, a - arc / 2 + 0.02, a + arc / 2 - 0.02)
      ctx.arc(cx, cy, rI, a + arc / 2 - 0.02, a - arc / 2 + 0.02, true)
      ctx.closePath()
      ctx.fillStyle = e > 0.1 ? `hsl(${(i / 12) * 360},75%,52%)` : (note.includes('#') ? '#334155' : '#1e293b')
      ctx.globalAlpha = e > 0.08 ? 0.9 : 0.35; ctx.fill(); ctx.globalAlpha = 1
      const tx = cx + Math.cos(a) * (rI + (rO - rI) * 0.55)
      const ty = cy + Math.sin(a) * (rI + (rO - rI) * 0.55)
      ctx.fillStyle = e > 0.1 ? '#fff' : '#475569'
      ctx.font = `${e > 0.1 ? 700 : 400} ${Math.max(9, 11 * dpr)}px DM Sans,sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(note, tx, ty)
    })
    // 和声连线
    const pts = frame.harmony.filter(n => n.energy > 0.15).map(n => {
      const i = NOTES.indexOf(n.name), a = (i / 12) * Math.PI * 2 - Math.PI / 2
      return { x: cx + Math.cos(a) * R * 0.36, y: cy + Math.sin(a) * R * 0.36 }
    })
    if (pts.length >= 2) {
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath(); ctx.strokeStyle = 'rgba(29,185,84,0.55)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke()
      ctx.fillStyle = 'rgba(29,185,84,0.08)'; ctx.fill()
    }
    // 中心
    const top = frame.harmony[0]
    if (top) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = `700 ${14 * dpr}px DM Sans,sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(top.name + top.octave, cx, cy - 8 * dpr)
      ctx.fillStyle = '#727272'; ctx.font = `${10 * dpr}px DM Sans,sans-serif`
      ctx.fillText(frame.harmony.length + ' 音', cx, cy + 10 * dpr)
    }
  }, [frame])
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#727272',marginBottom:8}}>和声分析</div>
      <canvas ref={ref} style={{width:'100%',height:220,display:'block',borderRadius:8}} />
    </div>
  )
}

export function BandBars({ frame }: { frame: AnalysisFrame }) {
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#727272',marginBottom:10}}>频段能量</div>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        {frame.bands.slice(0,10).map(b => (
          <div key={b.name} style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:48,fontSize:10,color:'#727272',flexShrink:0,textAlign:'right'}}>{b.label}</div>
            <div style={{flex:1,height:7,background:'rgba(255,255,255,0.06)',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min(100,b.energy*100)}%`,background:b.color,borderRadius:4,transition:'width 60ms linear',boxShadow:b.energy>0.5?`0 0 6px ${b.color}88`:'none'}} />
            </div>
            <div style={{width:28,fontSize:10,color:'#727272',flexShrink:0,textAlign:'right'}}>{Math.round(b.energy*100)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SpectrumWave({ analyser }: { analyser: AnalyserNode }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  useEffect(() => {
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      const c = ref.current; if (!c) return
      const ctx = c.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth * dpr, h = c.clientHeight * dpr
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
      analyser.getByteFrequencyData(buf)
      ctx.clearRect(0,0,w,h)
      const n = buf.length, bw = w / n
      for (let i = 0; i < n; i++) {
        const v = buf[i] / 255, bh = v * h
        ctx.fillStyle = `hsla(${(i/n)*240},80%,60%,${0.5+v*0.5})`
        ctx.fillRect(i * bw, h - bh, Math.max(1, bw - 0.5), bh)
      }
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [analyser])
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#727272',marginBottom:8}}>频谱</div>
      <canvas ref={ref} style={{width:'100%',height:110,display:'block',borderRadius:8,background:'rgba(0,0,0,0.25)'}} />
    </div>
  )
}

export function InstrumentList({ frame }: { frame: AnalysisFrame }) {
  return (
    <div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#727272',marginBottom:10}}>识别乐器</div>
      {frame.instruments.length === 0 && <div style={{fontSize:12,color:'#727272'}}>暂无检测到乐器</div>}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {frame.instruments.map(inst => (
          <div key={inst.name} style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18}}>{inst.icon}</span>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:13,fontWeight:600}}>{inst.name}</span>
                <span style={{fontSize:11,color:'#727272'}}>{Math.round(inst.angle)}°</span>
              </div>
              <div style={{height:4,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,inst.energy*100)}%`,background:inst.color,borderRadius:2,transition:'width 80ms linear'}} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
