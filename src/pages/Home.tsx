import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer, useProgress } from '../providers/PlayerProvider'
import { useVisualizer } from '../providers/VisualizerProvider'
import { useData } from '../providers/DataProvider'
import { AudioAnalyzer, AnalysisFrame } from '../visualizer/AudioAnalyzer'
import { toTrack } from '../lib/trackUtils'
import WebGLModeCanvas from '../components/insight/WebGLModeCanvas'

const EMPTY_FRAME: AnalysisFrame = {
  bands: [], instruments: [], harmony: [],
  rms: 0, lufs: -60, spectralCentroid: 0, spectralFlux: 0,
  beat: false, beatStrength: 0,
  smoothBass: 0, smoothMid: 0, smoothTreble: 0,
}

const MODE_OPTIONS: { id: 'spectrum' | 'radial' | 'cover-pulse'; label: string; sub: string }[] = [
  { id: 'spectrum', label: '频谱', sub: 'Spectrum Bars' },
  { id: 'radial', label: '频谱环', sub: 'Spectrum Ring' },
  { id: 'cover-pulse', label: '脉冲', sub: 'Cover Pulse' },
]

const THEMES: { id: 'amber-dark' | 'neon-grid' | 'deep-space' | 'rainbow'; label: string; stops: string[] }[] = [
  { id: 'amber-dark', label: '琥珀', stops: ['#ff7319', '#ffd14d', '#fff2c7'] },
  { id: 'neon-grid',  label: '霓虹', stops: ['#21d4ee', '#a854f7', '#f26bd9'] },
  { id: 'deep-space', label: '深空', stops: ['#4d8cf2', '#f574b5', '#8c80f2'] },
  { id: 'rainbow',    label: '翡翠', stops: ['#31c27c', '#21d4ee', '#9bebbf'] },
]

function StatChip({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 88,
      padding: '10px 12px',
      borderRadius: 12,
      background: accent ? 'rgba(49,194,124,0.10)' : 'rgba(255,255,255,0.025)',
      border: `1px solid ${accent ? 'rgba(49,194,124,0.32)' : 'var(--border)'}`,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ marginTop: 5, fontFamily: 'Righteous, sans-serif', fontSize: 20, lineHeight: 1, color: accent ? 'var(--accent-bright)' : 'var(--text)' }}>
        {value}
        {unit && <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

export default function Home() {
  const { isPlaying, current, play, setQueue } = usePlayer() as any
  const { analyser } = useProgress()
  const { mode, setMode, theme, setTheme, bloom, sensitivity } = useVisualizer()
  const { songs } = useData() as any
  const [frame, setFrame] = useState<AnalysisFrame>(EMPTY_FRAME)

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

  const lufsStr = isFinite(frame.lufs) ? frame.lufs.toFixed(1) : '-∞'
  const centroidKhz = (frame.spectralCentroid / 1000).toFixed(1)

  const playRandom = () => {
    if (!songs || songs.length === 0) return
    const list = [...songs].sort(() => Math.random() - 0.5).map((s: any) => toTrack(s))
    setQueue(list)
    play(list[0])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 16 }}>
      {/* Hero / 可视化舞台 */}
      <section style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'linear-gradient(145deg, rgba(18,24,40,0.72) 0%, rgba(8,11,20,0.78) 100%)',
        boxShadow: 'var(--shadow)',
      }}>
        {analyser ? (
          <WebGLModeCanvas
            analyser={analyser}
            isPlaying={isPlaying}
            mode={mode}
            theme={theme}
            sensitivity={sensitivity}
            bloom={bloom}
            height={460}
          />
        ) : (
          <div style={{ height: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center', display: 'grid', gap: 14 }}>
              <div style={{ fontSize: 13, letterSpacing: '0.16em', color: 'var(--accent-bright)', textTransform: 'uppercase' }}>WebGL Music · Visualizer</div>
              <div style={{ fontSize: 24, fontFamily: 'Righteous, sans-serif', color: 'var(--text)' }}>开始播放，激活实时音频可视化引擎</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                <button
                  onClick={playRandom}
                  className="cursor-pointer"
                  style={{
                    padding: '10px 22px', borderRadius: 999,
                    background: 'linear-gradient(135deg, rgba(49,194,124,0.85) 0%, rgba(49,194,124,1) 100%)',
                    color: '#04140a', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
                    border: 'none', cursor: 'pointer',
                  }}
                >随机播放一首</button>
                <Link to="/library" style={{
                  padding: '10px 22px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-sub)',
                  fontWeight: 600, fontSize: 13, letterSpacing: '0.06em',
                  border: '1px solid var(--border)',
                }}>浏览曲库</Link>
              </div>
            </div>
          </div>
        )}

        {/* 顶部 HUD：标题 / 状态 / 全屏入口 */}
        <div style={{
          position: 'absolute', left: 22, top: 18,
          display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'none',
        }}>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--accent-bright)' }}>VISUALIZER STAGE</div>
            <div style={{ fontFamily: 'Righteous, sans-serif', fontSize: 22, color: 'var(--text)', marginTop: 4 }}>实时音频可视化</div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 22, top: 18, display: 'flex', gap: 8 }}>
          <Link
            to="/visualizer"
            className="cursor-pointer"
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              background: 'rgba(14,19,34,0.78)',
              border: '1px solid var(--border-2)',
              color: 'var(--text-sub)',
              fontSize: 12,
              letterSpacing: '0.06em',
              backdropFilter: 'blur(10px)',
              transition: 'color 200ms, border-color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-bright)'; e.currentTarget.style.borderColor = 'rgba(49,194,124,0.5)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-sub)'; e.currentTarget.style.borderColor = 'var(--border-2)' }}
            aria-label="进入全屏可视化"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: '-2px', marginRight: 6 }}>
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            全屏可视化
          </Link>
        </div>

        {/* 当前播放底部条 */}
        <div style={{
          position: 'absolute',
          left: 22, right: 22, bottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '10px 14px',
          borderRadius: 14,
          background: 'rgba(8,11,20,0.65)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(14px)',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: frame.beat ? 'var(--rose)' : isPlaying ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: frame.beat ? '0 0 8px var(--rose)' : isPlaying ? '0 0 6px var(--accent)' : 'none',
              flexShrink: 0,
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                {current?.title || '未播放歌曲'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {current?.artist || (isPlaying ? '正在分析' : '点击底部播放按钮开始')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <StatChip label="LUFS" value={lufsStr} accent={isPlaying} />
            <StatChip label="音色" value={centroidKhz} unit="kHz" />
            <StatChip label="节拍" value={String(Math.round(frame.beatStrength * 100))} unit="%" accent={frame.beat} />
          </div>
        </div>
      </section>

      {/* 模式 / 主题快捷切换 */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
      }}>
        <div style={{
          padding: 18,
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.55)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>可视化模式</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODE_OPTIONS.map((opt) => {
              const active = mode === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className="cursor-pointer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: active ? 'rgba(49,194,124,0.12)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${active ? 'rgba(49,194,124,0.4)' : 'var(--border)'}`,
                    color: active ? 'var(--accent-bright)' : 'var(--text-sub)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontFamily: 'Righteous, sans-serif', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)' }}>{opt.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          padding: 18,
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.55)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>配色主题</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {THEMES.map((t) => {
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="cursor-pointer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: active ? 'rgba(49,194,124,0.10)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${active ? 'rgba(49,194,124,0.4)' : 'var(--border)'}`,
                    color: active ? 'var(--accent-bright)' : 'var(--text-sub)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                  }}
                >
                  <span aria-hidden style={{
                    display: 'inline-flex',
                    width: 22, height: 14, borderRadius: 4, overflow: 'hidden',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                    flexShrink: 0,
                  }}>
                    {t.stops.map(c => (
                      <span key={c} style={{ flex: 1, background: c, display: 'block' }} />
                    ))}
                  </span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          padding: 18,
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.55)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          gap: 10,
          alignContent: 'space-between',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>沉浸式入口</div>
          <Link to="/visualizer" className="cursor-pointer" style={{
            display: 'block', padding: '12px 14px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(49,194,124,0.18) 0%, rgba(49,194,124,0.08) 100%)',
            border: '1px solid rgba(49,194,124,0.42)',
            color: 'var(--accent-bright)', fontWeight: 600, fontSize: 13,
          }}>
            <div>全屏可视化舞台</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>无 chrome 沉浸模式 · F 键随时切换</div>
          </Link>
          <Link to="/gallery-3d" className="cursor-pointer" style={{
            display: 'block', padding: '12px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontWeight: 600, fontSize: 13,
          }}>
            <div>3D 漫游画廊</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>音频驱动的 WebGL 第一人称展厅</div>
          </Link>
          <Link to="/library" className="cursor-pointer" style={{
            display: 'block', padding: '12px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontWeight: 600, fontSize: 13,
          }}>
            <div>曲库</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>{songs?.length ?? 0} 首作品</div>
          </Link>
        </div>
      </section>
    </div>
  )
}
