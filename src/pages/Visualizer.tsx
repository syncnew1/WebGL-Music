import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePlayer, useProgress } from '../providers/PlayerProvider'
import { useVisualizer } from '../providers/VisualizerProvider'
import { AudioAnalyzer, AnalysisFrame } from '../visualizer/AudioAnalyzer'
import WebGLModeCanvas from '../components/insight/WebGLModeCanvas'

const EMPTY_FRAME: AnalysisFrame = {
  bands: [], instruments: [], harmony: [],
  rms: 0, lufs: -60, spectralCentroid: 0, spectralFlux: 0,
  beat: false, beatStrength: 0,
  smoothBass: 0, smoothMid: 0, smoothTreble: 0,
}

const MODE_OPTIONS: { id: 'spectrum' | 'radial' | 'cover-pulse'; label: string; sub: string }[] = [
  { id: 'spectrum', label: '频谱', sub: 'BARS' },
  { id: 'radial', label: '频谱环', sub: 'RING' },
  { id: 'cover-pulse', label: '脉冲', sub: 'PULSE' },
]

const THEMES: { id: 'amber-dark' | 'neon-grid' | 'deep-space' | 'rainbow'; label: string; stops: string[] }[] = [
  { id: 'amber-dark', label: '琥珀', stops: ['#ff7319', '#ffd14d', '#fff2c7'] },
  { id: 'neon-grid',  label: '霓虹', stops: ['#21d4ee', '#a854f7', '#f26bd9'] },
  { id: 'deep-space', label: '深空', stops: ['#4d8cf2', '#f574b5', '#8c80f2'] },
  { id: 'rainbow',    label: '翡翠', stops: ['#31c27c', '#21d4ee', '#9bebbf'] },
]

export default function Visualizer() {
  const navigate = useNavigate()
  const { isPlaying, current, play, pause } = usePlayer() as any
  const { analyser } = useProgress()
  const { mode, setMode, theme, setTheme, bloom, sensitivity } = useVisualizer()
  const [frame, setFrame] = useState<AnalysisFrame>(EMPTY_FRAME)
  const [hudHidden, setHudHidden] = useState(false)
  const idleTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!analyser) return
    const analyzer = new AudioAnalyzer(analyser)
    let raf = 0
    const tick = () => {
      setFrame(analyzer.analyze())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyser])

  // 鼠标静止 3s 自动隐藏 HUD
  useEffect(() => {
    const reset = () => {
      setHudHidden(false)
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => setHudHidden(true), 3000)
    }
    reset()
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('keydown', reset)
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    }
  }, [])

  // F 键切换 / Esc 退出 / 空格播放暂停
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Escape' || e.code === 'KeyF') {
        e.preventDefault()
        navigate(-1)
      } else if (e.code === 'Space') {
        e.preventDefault()
        if (isPlaying) pause()
        else if (current) play(current)
      } else if (e.code === 'KeyM') {
        e.preventDefault()
        const idx = MODE_OPTIONS.findIndex(o => o.id === mode)
        const nextMode = MODE_OPTIONS[(idx + 1) % MODE_OPTIONS.length]
        setMode(nextMode.id)
      } else if (e.code === 'KeyT') {
        e.preventDefault()
        const idx = THEMES.findIndex(t => t.id === theme)
        const nextTheme = THEMES[(idx + 1) % THEMES.length]
        setTheme(nextTheme.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, isPlaying, current, play, pause, mode, theme, setMode, setTheme])

  const lufsStr = isFinite(frame.lufs) ? frame.lufs.toFixed(1) : '-∞'
  const centroidKhz = (frame.spectralCentroid / 1000).toFixed(1)
  const rmsDb = (20 * Math.log10(Math.max(frame.rms, 1e-8))).toFixed(1)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: '#04060a',
      cursor: hudHidden ? 'none' : 'default',
    }}>
      {analyser ? (
        <WebGLModeCanvas
          analyser={analyser}
          isPlaying={isPlaying}
          mode={mode}
          theme={theme}
          sensitivity={sensitivity}
          bloom={bloom}
          height={typeof window !== 'undefined' ? window.innerHeight : 720}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 13, letterSpacing: '0.16em', color: 'var(--accent-bright)', textTransform: 'uppercase' }}>WebGL Music · Visualizer</div>
            <div style={{ fontSize: 22, fontFamily: 'Righteous, sans-serif', color: 'var(--text)' }}>请先开始播放</div>
            <Link to="/" style={{
              padding: '10px 22px', borderRadius: 999,
              background: 'rgba(255,255,255,0.04)', color: 'var(--text-sub)',
              fontSize: 13, border: '1px solid var(--border)',
            }}>返回首页</Link>
          </div>
        </div>
      )}

      {/* HUD 整体淡入淡出 */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: hudHidden ? 'none' : 'auto',
        opacity: hudHidden ? 0 : 1,
        transition: 'opacity 350ms ease',
      }}>
        {/* 顶部：标题 + 退出 */}
        <div style={{
          position: 'absolute', left: 24, top: 20,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: 'var(--accent-bright)' }}>FULLSCREEN VISUALIZER</div>
            <div style={{ fontFamily: 'Righteous, sans-serif', fontSize: 22, color: 'var(--text)', marginTop: 4, letterSpacing: '0.04em' }}>
              {current?.title || '实时音频可视化'}
            </div>
            {current?.artist && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{current.artist}</div>}
          </div>
        </div>

        <div style={{ position: 'absolute', right: 24, top: 20, display: 'flex', gap: 8 }}>
          <div style={{
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(8,11,20,0.7)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.1em',
            backdropFilter: 'blur(10px)',
          }}>
            F · ESC 退出 &nbsp;·&nbsp; M 切模式 &nbsp;·&nbsp; T 切主题 &nbsp;·&nbsp; SPACE 暂停
          </div>
          <button
            onClick={() => navigate(-1)}
            className="cursor-pointer"
            aria-label="退出全屏可视化"
            style={{
              padding: '7px 14px', borderRadius: 999,
              background: 'rgba(8,11,20,0.7)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', backdropFilter: 'blur(10px)',
              transition: 'background 180ms, border-color 180ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(49,194,124,0.15)'; e.currentTarget.style.borderColor = 'rgba(49,194,124,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(8,11,20,0.7)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >退出</button>
        </div>

        {/* 底部：模式/主题/特征指标 */}
        <div style={{
          position: 'absolute', left: 24, right: 24, bottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className="cursor-pointer"
                  style={{
                    padding: '8px 16px', borderRadius: 999,
                    background: active ? 'rgba(49,194,124,0.16)' : 'rgba(8,11,20,0.65)',
                    border: `1px solid ${active ? 'rgba(49,194,124,0.45)' : 'var(--border)'}`,
                    color: active ? 'var(--accent-bright)' : 'var(--text-sub)',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                    cursor: 'pointer', backdropFilter: 'blur(10px)',
                    transition: 'all 180ms ease',
                  }}
                >{opt.label}</button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Stat label="LUFS" value={lufsStr} />
            <Stat label="RMS" value={rmsDb} unit="dB" />
            <Stat label="音色" value={centroidKhz} unit="kHz" />
            <Stat label="瞬态" value={(frame.spectralFlux * 100).toFixed(1)} unit="%" />
            <Stat label="节拍" value={String(Math.round(frame.beatStrength * 100))} unit="%" accent={frame.beat} />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {THEMES.map((t) => {
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="cursor-pointer"
                  aria-label={`切换到 ${t.label} 主题`}
                  title={t.label}
                  style={{
                    display: 'inline-flex',
                    overflow: 'hidden',
                    width: 36, height: 22, borderRadius: 6,
                    border: `2px solid ${active ? 'var(--accent-bright)' : 'rgba(255,255,255,0.18)'}`,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    boxShadow: active ? '0 0 10px rgba(49,194,124,0.45)' : 'none',
                    padding: 0,
                  }}
                >
                  {t.stops.map(c => (
                    <span key={c} style={{ flex: 1, background: c, display: 'block' }} />
                  ))}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 12,
      background: accent ? 'rgba(49,194,124,0.12)' : 'rgba(8,11,20,0.65)',
      border: `1px solid ${accent ? 'rgba(49,194,124,0.35)' : 'var(--border)'}`,
      backdropFilter: 'blur(10px)',
      minWidth: 76,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ marginTop: 3, fontFamily: 'Righteous, sans-serif', fontSize: 17, lineHeight: 1, color: accent ? 'var(--accent-bright)' : 'var(--text)' }}>
        {value}
        {unit && <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}
