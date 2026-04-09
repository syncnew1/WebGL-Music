import React, { useRef, useEffect, useState } from 'react'
import type { AnalysisFrame } from '../../visualizer/AudioAnalyzer'

type CoverPulseProps = {
  frame: AnalysisFrame
  coverUrl?: string | null
  title?: string
  artist?: string
  bloom?: number
  theme?: 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'
}

type ModeTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

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
export function SpectrumWave({ analyser, theme = 'amber-dark' }: { analyser: AnalyserNode; theme?: 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space' }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const peaks = useRef<Float32Array>(new Float32Array(2048))
  const decays = useRef<Float32Array>(new Float32Array(2048))
  useEffect(() => {
    const palette = {
      'amber-dark': { start: [38, 28, 16], end: [255, 122, 24], peak: [255, 210, 140] },
      'neon-grid': { start: [10, 24, 38], end: [34, 211, 238], peak: [191, 219, 254] },
      'deep-space': { start: [16, 18, 38], end: [125, 211, 252], peak: [244, 114, 182] },
      'rainbow': { start: [16, 38, 24], end: [49, 194, 124], peak: [125, 211, 252] },
    }[theme]
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
        const hueMix = i / n
        const lit = 38 + v * 26
        ctx.fillStyle = `rgba(${Math.round(palette.start[0] + (palette.end[0] - palette.start[0]) * hueMix)},${Math.round(palette.start[1] + (palette.end[1] - palette.start[1]) * hueMix)},${Math.round(palette.start[2] + (palette.end[2] - palette.start[2]) * hueMix)},${0.52 + v * 0.42})`
        ctx.fillRect(i * bw, H - bh, Math.max(1, bw - 0.6), bh)
        if (v > 0.45) {
          ctx.fillStyle = `rgba(${palette.peak[0]},${palette.peak[1]},${palette.peak[2]},${v * 0.5})`
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
        ctx.fillStyle = `rgba(${palette.peak[0]},${palette.peak[1]},${palette.peak[2]},0.65)`
        ctx.fillRect(i * bw, py, Math.max(1, bw - 0.6), 1.5 * dpr)
      }
      ctx.save(); ctx.scale(1, -1); ctx.translate(0, -H)
      for (let i = 0; i < n; i++) {
        const v = buf[i] / 255 * 0.14, bh = v * H
        const hueMix = i / n
        ctx.fillStyle = `rgba(${Math.round(palette.start[0] + (palette.end[0] - palette.start[0]) * hueMix)},${Math.round(palette.start[1] + (palette.end[1] - palette.start[1]) * hueMix)},${Math.round(palette.start[2] + (palette.end[2] - palette.start[2]) * hueMix)},0.14)`
        ctx.fillRect(i * bw, 0, Math.max(1, bw - 0.6), bh)
      }
      ctx.restore()
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [analyser, theme])
  return (
    <div style={{ position: 'relative', minHeight: 340, borderRadius: 22, overflow: 'hidden', background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(6,8,14,0.98) 72%)' }}>
      <canvas ref={ref} style={{
        width: '100%', height: 340, display: 'block',
        borderRadius: 22, background: 'transparent',
        border: 'none',
      }} />
    </div>
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

export function SpectrumRing({ frame, bloom = 0.85, theme = 'amber-dark', sensitivity = 1 }: { frame: AnalysisFrame; bloom?: number; theme?: ModeTheme; sensitivity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth * dpr
    const H = c.clientHeight * dpr
    if (c.width !== W || c.height !== H) {
      c.width = W
      c.height = H
    }
    const cx = W / 2
    const cy = H / 2
    const base = Math.min(W, H) * 0.18
    const ringRadius = Math.min(W, H) * 0.29
    const palette = {
      'amber-dark': ['#ffb84d', '#ff7a18'],
      'neon-grid': ['#22d3ee', '#a855f7'],
      'deep-space': ['#7dd3fc', '#f472b6'],
      'rainbow': ['#31c27c', '#22d3ee'],
    }[theme]

    ctx.clearRect(0, 0, W, H)
    const bg = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, ringRadius * 1.65)
    bg.addColorStop(0, 'rgba(255,255,255,0.03)')
    bg.addColorStop(1, 'rgba(0,0,0,0.0)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    ctx.beginPath()
    ctx.arc(cx, cy, base, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fill()

    const bands = frame.bands.slice(0, 10)
    bands.forEach((band, i) => {
      const start = (i / bands.length) * Math.PI * 2 - Math.PI / 2
      const end = ((i + 0.82) / bands.length) * Math.PI * 2 - Math.PI / 2
      const energy = Math.max(0.04, band.energy * sensitivity)
      const outer = ringRadius + energy * (120 * dpr) + frame.beatStrength * (30 * dpr)
      const inner = ringRadius - 16 * dpr
      const grad = ctx.createLinearGradient(cx, cy - outer, cx, cy + outer)
      grad.addColorStop(0, palette[0])
      grad.addColorStop(1, palette[1])
      ctx.beginPath()
      ctx.arc(cx, cy, outer, start, end)
      ctx.arc(cx, cy, inner, end, start, true)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.35 + energy * 0.65
      ctx.shadowColor = palette[i % 2]
      ctx.shadowBlur = (8 + bloom * 14 + energy * 18) * dpr
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    })

    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 - Math.PI / 2
      const x0 = cx + Math.cos(a) * (ringRadius - 26 * dpr)
      const y0 = cy + Math.sin(a) * (ringRadius - 26 * dpr)
      const x1 = cx + Math.cos(a) * (ringRadius - 8 * dpr)
      const y1 = cy + Math.sin(a) * (ringRadius - 8 * dpr)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(cx, cy, ringRadius + frame.beatStrength * 12 * dpr, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + frame.beatStrength * 0.3})`
    ctx.lineWidth = 2 * dpr
    ctx.stroke()
  }, [frame, bloom, theme, sensitivity])

  return <canvas ref={ref} style={{ width: '100%', height: 340, display: 'block', borderRadius: 22, background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(6,8,14,0.96) 72%)' }} />
}

export function ParticleCloud({ frame, bloom = 0.85, theme = 'amber-dark', density = 512, sensitivity = 1 }: { frame: AnalysisFrame; bloom?: number; theme?: ModeTheme; density?: number; sensitivity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; size: number; phase: number }>>([])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = c.clientWidth * dpr
    const H = c.clientHeight * dpr
    if (c.width !== W || c.height !== H) {
      c.width = W
      c.height = H
    }
    if (particlesRef.current.length === 0 || Math.abs(particlesRef.current.length - Math.max(48, Math.round(density / 3))) > 12) {
      particlesRef.current = Array.from({ length: Math.max(48, Math.round(density / 3)) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const palette = {
      'amber-dark': ['255,184,77', '255,122,24'],
      'neon-grid': ['34,211,238', '168,85,247'],
      'deep-space': ['125,211,252', '244,114,182'],
      'rainbow': ['49,194,124', '34,211,238'],
    }[theme]

    const particles = particlesRef.current
    ctx.clearRect(0, 0, W, H)
    const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.min(W, H) * 0.65)
    bg.addColorStop(0, 'rgba(255,255,255,0.03)')
    bg.addColorStop(1, 'rgba(5,8,18,0.0)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    const pulse = 0.8 + frame.smoothBass * 3.8 * sensitivity + frame.beatStrength * 3.2
    const jitter = 0.4 + frame.smoothTreble * 4.6 * sensitivity

    for (const p of particles) {
      p.phase += 0.04 + frame.smoothMid * 0.06
      p.x += p.vx + Math.cos(p.phase) * jitter
      p.y += p.vy + Math.sin(p.phase * 1.2) * jitter
      if (p.x < -20) p.x = W + 20
      if (p.x > W + 20) p.x = -20
      if (p.y < -20) p.y = H + 20
      if (p.y > H + 20) p.y = -20

      const glowSize = (p.size + pulse) * dpr
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize * (3 + bloom))
      g.addColorStop(0, `rgba(${palette[0]},${0.38 + frame.beatStrength * 0.22})`)
      g.addColorStop(1, `rgba(${palette[1]},0)`)
      ctx.beginPath()
      ctx.arc(p.x, p.y, glowSize * (3 + bloom), 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${palette[0]},${0.55 + frame.smoothTreble * 0.3})`
      ctx.fill()
    }
  }, [frame, bloom, theme, density, sensitivity])

  return <canvas ref={ref} style={{ width: '100%', height: 340, display: 'block', borderRadius: 22, background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(6,8,14,0.96) 72%)' }} />
}

export function CoverPulse({ frame, coverUrl, title, artist, bloom = 0.85, theme = 'amber-dark' }: CoverPulseProps) {
  const palette = {
    'amber-dark': { primary: '#ffb84d', secondary: '#ff7a18', glow: 'rgba(255,184,77,0.38)', bg: 'radial-gradient(circle at 50% 35%, rgba(255,184,77,0.16), rgba(11,13,18,0.96) 58%)' },
    'neon-grid': { primary: '#22d3ee', secondary: '#a855f7', glow: 'rgba(34,211,238,0.34)', bg: 'radial-gradient(circle at 50% 35%, rgba(34,211,238,0.14), rgba(8,11,21,0.96) 58%)' },
    'deep-space': { primary: '#7dd3fc', secondary: '#f472b6', glow: 'rgba(125,211,252,0.28)', bg: 'radial-gradient(circle at 50% 35%, rgba(59,130,246,0.16), rgba(5,8,18,0.97) 60%)' },
    'rainbow': { primary: '#31c27c', secondary: '#22d3ee', glow: 'rgba(49,194,124,0.30)', bg: 'radial-gradient(circle at 50% 35%, rgba(49,194,124,0.14), rgba(10,12,16,0.96) 58%)' },
  }[theme]

  const pulse = 1 + frame.smoothBass * 0.18 + frame.beatStrength * 0.12
  const halo = 90 + frame.smoothBass * 110 + frame.beatStrength * 70
  const ringOpacity = Math.min(0.9, 0.18 + frame.smoothTreble * 0.5 + bloom * 0.22)
  const bloomBlur = 20 + bloom * 36 + frame.beatStrength * 18

  return (
    <div style={{
      position: 'relative',
      minHeight: 340,
      borderRadius: 22,
      overflow: 'hidden',
      background: palette.bg,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.45), 0 0 ${28 + bloom * 28}px ${palette.glow}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '38px 38px',
        opacity: theme === 'neon-grid' ? 0.3 : 0.08,
        transform: `perspective(700px) rotateX(75deg) translateY(42%) scale(${1 + frame.smoothMid * 0.02})`,
        transformOrigin: '50% 100%',
      }} />

      <div style={{ position: 'absolute', inset: '14% 0 auto 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: halo * 2,
          height: halo * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.glow} 0%, rgba(255,255,255,0.04) 36%, rgba(255,255,255,0) 72%)`,
          filter: `blur(${bloomBlur}px)`,
          opacity: 0.7 + frame.beatStrength * 0.2,
          transform: `scale(${1 + frame.beatStrength * 0.12})`,
          transition: 'transform 120ms ease-out, opacity 160ms ease-out',
        }} />
      </div>

      {[0, 1, 2].map((ring) => {
        const size = 180 + ring * 44 + frame.smoothBass * 26
        const alpha = Math.max(0.08, ringOpacity - ring * 0.12)
        return (
          <div
            key={ring}
            style={{
              position: 'absolute',
              left: '50%',
              top: '46%',
              width: size,
              height: size,
              borderRadius: '50%',
              border: `1px solid rgba(255,255,255,${alpha})`,
              boxShadow: `0 0 ${12 + ring * 8}px ${palette.glow}`,
              transform: `translate(-50%, -50%) scale(${1 + frame.beatStrength * (0.05 + ring * 0.02)})`,
              opacity: alpha,
            }}
          />
        )
      })}

      <div style={{ position: 'absolute', left: '50%', top: '46%', transform: `translate(-50%, -50%) scale(${pulse})`, transition: 'transform 120ms ease-out' }}>
        <div style={{
          width: 168,
          height: 168,
          borderRadius: 28,
          padding: 8,
          background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
          boxShadow: `0 0 ${24 + bloom * 20}px ${palette.glow}, 0 18px 48px rgba(0,0,0,0.45)`,
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            borderRadius: 22,
            overflow: 'hidden',
            background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.9)',
            fontSize: 54,
          }}>
            {!coverUrl ? '♪' : null}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 24, right: 24, bottom: 22, display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'rgba(255,255,255,0.98)', fontSize: 24, fontFamily: 'Righteous, sans-serif', letterSpacing: '0.03em' }}>{title || '未播放歌曲'}</div>
          <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 6 }}>{artist || 'Cover Pulse · WebGL Style'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(56px, 1fr))', gap: 8, minWidth: 200 }}>
          {[
            { label: 'BEAT', value: `${Math.round(frame.beatStrength * 100)}%` },
            { label: 'BASS', value: `${Math.round(frame.smoothBass * 100)}%` },
            { label: 'GLOW', value: `${Math.round((ringOpacity + bloom) * 50)}%` },
          ].map((item) => (
            <div key={item.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.52)', letterSpacing: '0.12em' }}>{item.label}</div>
              <div style={{ marginTop: 4, color: '#fff', fontSize: 18, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
