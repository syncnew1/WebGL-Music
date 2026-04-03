import React, { useRef, useEffect, useState } from 'react'
import type { AnalysisFrame } from '../../visualizer/AudioAnalyzer'

/* ─── SpatialRadar ─── */
export function SpatialRadar({ frame }: { frame: AnalysisFrame }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth * dpr, H = c.clientHeight * dpr
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.37
    ctx.clearRect(0, 0, W, H)
    // rings
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(49,194,124,${0.05 + i * 0.03})`; ctx.lineWidth = 1; ctx.stroke()
    }
    // grid lines + labels
    const DIRS = ['前','右前','右','右后','后','左后','左','左前']
    DIRS.forEach((lbl, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.strokeStyle = 'rgba(49,194,124,0.08)'; ctx.lineWidth = 1; ctx.stroke()
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(139,155,191,0.5)'
        ctx.font = `${Math.max(9, R * 0.08)}px Poppins,sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(lbl, cx + Math.cos(a) * (R + 14 * dpr), cy + Math.sin(a) * (R + 14 * dpr))
      }
    })
    // center dot
    ctx.beginPath(); ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = '#31c27c'; ctx.fill()
    // instruments
    frame.instruments.forEach(inst => {
      const a = (inst.angle - 90) * Math.PI / 180
      const r = inst.distance * R
      const ix = cx + Math.cos(a) * r, iy = cy + Math.sin(a) * r
      const rad = (4 + inst.energy * 14) * dpr
      // glow
      const gl = ctx.createRadialGradient(ix, iy, 0, ix, iy, rad * 3)
      gl.addColorStop(0, inst.color + 'aa'); gl.addColorStop(1, inst.color + '00')
      ctx.beginPath(); ctx.arc(ix, iy, rad * 3, 0, Math.PI * 2)
      ctx.fillStyle = gl; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1
      // dot
      ctx.beginPath(); ctx.arc(ix, iy, rad, 0, Math.PI * 2)
      ctx.fillStyle = inst.color; ctx.globalAlpha = 0.88; ctx.fill(); ctx.globalAlpha = 1
      // icon
      ctx.font = `${Math.max(10, rad * 1.1)}px serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(inst.icon, ix, iy)
      // name
      ctx.fillStyle = 'rgba(232,234,240,0.7)'
      ctx.font = `${Math.max(9, 9 * dpr)}px Poppins,sans-serif`
      ctx.fillText(inst.name, ix, iy + rad + 9 * dpr)
    })
  }, [frame])
  return <canvas ref={ref} style={{ width: '100%', height: 220, display: 'block', borderRadius: 8 }} />
}

/* ─── HarmonyWheel ─── */
export function HarmonyWheel({ frame }: { frame: AnalysisFrame }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth * dpr, H = c.clientHeight * dpr
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.38
    ctx.clearRect(0, 0, W, H)
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    const HUES  = [160,175,190,205,220,235,250,265,280,140,155,170]
    const active = new Map(frame.harmony.map(n => [n.name, n.energy]))
    NOTES.forEach((note, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      const arc = Math.PI * 2 / 12
      const e = active.get(note) ?? 0
      const rI = R * 0.40, rO = R * (0.68 + e * 0.32)
      ctx.beginPath()
      ctx.arc(cx, cy, rO, a - arc / 2 + 0.02, a + arc / 2 - 0.02)
      ctx.arc(cx, cy, rI, a + arc / 2 - 0.02, a - arc / 2 + 0.02, true)
      ctx.closePath()
      if (e > 0.08) {
        const sg = ctx.createLinearGradient(
          cx + Math.cos(a) * rI, cy + Math.sin(a) * rI,
          cx + Math.cos(a) * rO, cy + Math.sin(a) * rO
        )
        sg.addColorStop(0, `hsla(${HUES[i]},70%,38%,0.75)`)
        sg.addColorStop(1, `hsla(${HUES[i]},90%,62%,0.95)`)
        ctx.fillStyle = sg; ctx.globalAlpha = 0.92
      } else {
        ctx.fillStyle = note.includes('#') ? '#141c2e' : '#1a2438'
        ctx.globalAlpha = 0.5
      }
      ctx.fill(); ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(cx, cy, rO, a - arc / 2 + 0.02, a + arc / 2 - 0.02)
      ctx.arc(cx, cy, rI, a + arc / 2 - 0.02, a - arc / 2 + 0.02, true)
      ctx.closePath()
      ctx.strokeStyle = e > 0.08 ? `hsla(${HUES[i]},80%,70%,0.3)` : 'rgba(49,194,124,0.06)'
      ctx.lineWidth = 0.5; ctx.stroke()
      const tx = cx + Math.cos(a) * (rI + (rO - rI) * 0.52)
      const ty = cy + Math.sin(a) * (rI + (rO - rI) * 0.52)
      ctx.fillStyle = e > 0.08 ? '#090d18' : 'rgba(139,155,191,0.35)'
      ctx.font = `${e > 0.08 ? 700 : 400} ${Math.max(9, 10 * dpr)}px Poppins,sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(note, tx, ty)
    })
    // chord polygon
    const pts = frame.harmony.filter(n => n.energy > 0.15).map(n => {
      const i = NOTES.indexOf(n.name), a = (i / 12) * Math.PI * 2 - Math.PI / 2
      return { x: cx + Math.cos(a) * R * 0.34, y: cy + Math.sin(a) * R * 0.34 }
    })
    if (pts.length >= 2) {
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.closePath()
      ctx.strokeStyle = 'rgba(49,194,124,0.55)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke()
      ctx.fillStyle = 'rgba(49,194,124,0.07)'; ctx.fill()
    }
    // center
    const top = frame.harmony[0]
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (top) {
      ctx.fillStyle = '#e8eaf0'
      ctx.font = `700 ${14 * dpr}px Righteous,sans-serif`
      ctx.fillText(top.name + top.octave, cx, cy - 8 * dpr)
      ctx.fillStyle = 'rgba(49,194,124,0.6)'
      ctx.font = `${10 * dpr}px Poppins,sans-serif`
      ctx.fillText(frame.harmony.length + ' 音', cx, cy + 10 * dpr)
    } else {
      ctx.fillStyle = 'rgba(74,88,120,0.5)'
      ctx.font = `${10 * dpr}px Poppins,sans-serif`
      ctx.fillText('暂无', cx, cy)
    }
  }, [frame])
  return <canvas ref={ref} style={{ width: '100%', height: 220, display: 'block', borderRadius: 8 }} />
}

/* ─── BandBars ─── */
const BAND_COLORS = [
  '#a855f7','#7c3aed','#3b82f6','#0ea5e9',
  '#06b6d4','#10b981','#31c27c','#84cc16','#eab308','#f97316',
]
export function BandBars({ frame }: { frame: AnalysisFrame }) {
  const smoothRef = useRef<number[]>([])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {frame.bands.slice(0, 10).map((b, i) => {
        const prev = smoothRef.current[i] ?? b.energy
        const smoothed = prev * 0.84 + b.energy * 0.16
        smoothRef.current[i] = smoothed
        const pct = Math.min(100, smoothed * 100)
        const col = BAND_COLORS[i] ?? '#31c27c'
        return (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, fontSize: 12.5, color: '#9cadcf', flexShrink: 0, textAlign: 'right', fontFamily: 'Poppins, sans-serif' }}>{b.label}</div>
            <div style={{
              flex: 1, height: 10, background: 'rgba(20,28,46,0.82)',
              borderRadius: 6, overflow: 'hidden', position: 'relative',
              border: '1px solid rgba(49,194,124,0.1)',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
                background: `linear-gradient(90deg,${col}88 0%,${col} 100%)`,
                borderRadius: 6, transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                boxShadow: pct > 55 ? `0 0 12px ${col}66` : 'none',
              }} />
            </div>
            <div style={{ width: 34, fontSize: 12, color: '#9cadcf', flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'Poppins, sans-serif' }}>
              {Math.round(pct)}
            </div>
          </div>
        )
      })}
      {frame.bands.length === 0 && <div style={{ fontSize: 13, color: '#627094' }}>暂无数据</div>}
    </div>
  )
}

/* ─── SpectrumWave ─── */
export function SpectrumWave({ analyser }: { analyser: AnalyserNode }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const peaks = useRef<Float32Array>(new Float32Array(2048))
  const decays = useRef<Float32Array>(new Float32Array(2048))
  useEffect(() => {
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      const c = ref.current; if (!c) return
      const ctx = c.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      const W = c.clientWidth * dpr, H = c.clientHeight * dpr
      if (c.width !== W || c.height !== H) {
        c.width = W; c.height = H
        peaks.current = new Float32Array(analyser.frequencyBinCount)
        decays.current = new Float32Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(buf)
      ctx.clearRect(0, 0, W, H)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, 'rgba(9,13,24,0.0)'); bg.addColorStop(1, 'rgba(9,13,24,0.5)')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      const n = buf.length, bw = W / n
      for (let i = 0; i < n; i++) {
        const v = buf[i] / 255; if (v < 0.01) continue
        const bh = v * H * 0.88
        const hue = 160 - (i / n) * 80
        const sat = 80 - (i / n) * 10
        const lit = 40 + v * 22
        ctx.fillStyle = `hsla(${hue},${sat}%,${lit}%,${0.5 + v * 0.5})`
        ctx.fillRect(i * bw, H - bh, Math.max(1, bw - 0.6), bh)
        if (v > 0.45) {
          ctx.fillStyle = `hsla(${hue},100%,80%,${v * 0.5})`
          ctx.fillRect(i * bw, H - bh - 2 * dpr, Math.max(1, bw - 0.6), 2 * dpr)
        }
        if (v > peaks.current[i]) { peaks.current[i] = v; decays.current[i] = 0 }
      }
      for (let i = 0; i < n; i++) {
        const pk = peaks.current[i]; if (pk < 0.05) continue
        decays.current[i] += 0.007
        peaks.current[i] = Math.max(0, pk - decays.current[i])
        const py = H - pk * H * 0.88 - 1.5 * dpr
        const hue = 160 - (i / n) * 80
        ctx.fillStyle = `hsla(${hue},100%,75%,0.65)`
        ctx.fillRect(i * bw, py, Math.max(1, bw - 0.6), 1.5 * dpr)
      }
      ctx.save(); ctx.scale(1, -1); ctx.translate(0, -H)
      for (let i = 0; i < n; i++) {
        const v = buf[i] / 255 * 0.14, bh = v * H
        const hue = 160 - (i / n) * 80
        ctx.fillStyle = `hsla(${hue},80%,50%,0.14)`
        ctx.fillRect(i * bw, 0, Math.max(1, bw - 0.6), bh)
      }
      ctx.restore()
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [analyser])
  return (
    <canvas ref={ref} style={{
      width: '100%', height: 130, display: 'block',
      borderRadius: 8, background: 'rgba(9,13,24,0.7)',
      border: '1px solid rgba(49,194,124,0.07)',
    }} />
  )
}

/* ─── InstrumentList ─── */
export function InstrumentList({ frame }: { frame: AnalysisFrame }) {
  const [rows, setRows] = useState<Array<{ name: string; icon: string; color: string; energy: number; ttl: number }>>([])

  useEffect(() => {
    setRows(prev => {
      const prevMap = new Map(prev.map(r => [r.name, r]))
      const currentNames = new Set(frame.instruments.map(i => i.name))
      const next: Array<{ name: string; icon: string; color: string; energy: number; ttl: number }> = []

      for (const inst of frame.instruments) {
        const p = prevMap.get(inst.name)
        next.push({
          name: inst.name,
          icon: inst.icon,
          color: inst.color,
          energy: p ? p.energy * 0.72 + inst.energy * 0.28 : inst.energy,
          ttl: 1,
        })
      }

      for (const p of prev) {
        if (currentNames.has(p.name)) continue
        const ttl = p.ttl - 0.12
        if (ttl > 0.05) next.push({ ...p, ttl, energy: p.energy * 0.86 })
      }

      next.sort((a, b) => b.energy - a.energy)
      return next.slice(0, 8)
    })
  }, [frame.instruments])
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: '#627094', padding: '8px 0' }}>暂无检测到乐器</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 220 }}>
      {rows.map(inst => {
        const pct = Math.min(100, inst.energy * 100)
        const opacity = Math.max(0.35, inst.ttl)
        return (
          <div key={inst.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            opacity,
            transition: 'opacity 220ms ease',
          }}>
            <span style={{
              fontSize: 22, lineHeight: 1, flexShrink: 0,
              filter: pct > 40 ? `drop-shadow(0 0 6px ${inst.color}aa)` : 'none',
              transition: 'filter 220ms ease',
            }}>{inst.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 650, color: '#e8eaf0', fontFamily: 'Poppins, sans-serif' }}>{inst.name}</span>
                <span style={{
                  fontSize: 11.5,
                  color: pct > 50 ? inst.color : '#8c9cbc',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'color 220ms',
                  fontFamily: 'Poppins, sans-serif',
                }}>{Math.round(pct)}%</span>
              </div>
              <div style={{ height: 7, background: 'rgba(20,28,46,0.8)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg,${inst.color}66 0%,${inst.color} 100%)`,
                  borderRadius: 4,
                  transition: 'width 220ms cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 220ms ease',
                  boxShadow: pct > 50 ? `0 0 8px ${inst.color}88` : 'none',
                }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
