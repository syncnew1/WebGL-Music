import React, { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../../providers/PlayerProvider'
import { AudioAnalyzer, AnalysisFrame } from '../../visualizer/AudioAnalyzer'
import { SpatialRadar, HarmonyWheel, BandBars, SpectrumWave, InstrumentList } from './VisComponents'

const EMPTY_FRAME: AnalysisFrame = {
  bands: [], instruments: [], harmony: [],
  rms: 0, lufs: -60, spectralCentroid: 0, spectralFlux: 0,
}

function StatPill({ label, value, unit, color, accent }: {
  label: string; value: string; unit?: string; color?: string; accent?: boolean
}) {
  return (
    <div style={{
      background: accent ? 'rgba(49,194,124,0.10)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(49,194,124,0.28)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 3,
      minWidth: 80, flex: 1,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, lineHeight: 1,
        color: color ?? 'var(--text)',
        fontFamily: 'Righteous, sans-serif',
      }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3, fontFamily: 'Poppins, sans-serif', fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  )
}

function PanelCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(14,19,34,0.88)',
      border: '1px solid rgba(49,194,124,0.09)',
      borderRadius: 16, padding: 18,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(49,194,124,0.04)',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          marginBottom: 12,
        }}>{title}</div>
      )}
      {children}
    </div>
  )
}

export default function InsightDashboard() {
  const { analyser, isPlaying } = usePlayer() as any
  const [frame, setFrame] = useState<AnalysisFrame>(EMPTY_FRAME)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!analyser) return
    analyzerRef.current = new AudioAnalyzer(analyser)
    const tick = () => {
      if (analyzerRef.current) setFrame(analyzerRef.current.analyze())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafRef.current); analyzerRef.current = null }
  }, [analyser])

  if (!analyser) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 400, gap: 16,
      }}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M9 18V5l12-2v13" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="6" cy="18" r="3" stroke="var(--accent)" strokeWidth="1.5"/>
          <circle cx="18" cy="16" r="3" stroke="var(--rose)" strokeWidth="1.5"/>
        </svg>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-sub)' }}>请先播放音乐以启动可视化分析</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>点击下方播放按钮开始</div>
      </div>
    )
  }

  const lufsStr = isFinite(frame.lufs) ? frame.lufs.toFixed(1) : '-∞'
  const centroidKhz = (frame.spectralCentroid / 1000).toFixed(1)
  const rmsDb = (20 * Math.log10(Math.max(frame.rms, 1e-8))).toFixed(1)
  const isLoud = frame.lufs > -14

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '6px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 24, fontWeight: 400, letterSpacing: '0.045em',
            fontFamily: 'Righteous, sans-serif',
            background: 'linear-gradient(90deg, var(--text) 0%, var(--accent) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>音频分析</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'Poppins, sans-serif', letterSpacing: '0.01em' }}>
            实时频谱 · 乐器识别 · 声场定位 · 和声分析
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 99,
          background: isPlaying ? 'rgba(49,194,124,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isPlaying ? 'rgba(49,194,124,0.3)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: 12, fontWeight: 600,
          color: isPlaying ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 300ms',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isPlaying ? 'var(--accent)' : 'var(--text-muted)',
            boxShadow: isPlaying ? '0 0 8px var(--accent)' : 'none',
            animation: isPlaying ? 'vis-pulse 1.8s ease-in-out infinite' : 'none',
            transition: 'all 300ms',
          }} />
          {isPlaying ? '分析中' : '已暂停'}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatPill label="响度" value={lufsStr} unit="LUFS"
          color={isLoud ? '#ef4444' : 'var(--accent)'} accent={isLoud} />
        <StatPill label="RMS" value={rmsDb} unit="dB" />
        <StatPill label="音色" value={centroidKhz} unit="kHz" color="var(--rose)" />
        <StatPill label="瞬态" value={(frame.spectralFlux * 100).toFixed(1)} unit="%" color="#a78bfa" />
        <StatPill label="乐器" value={String(frame.instruments.length)} color="#22d3ee" />
        <StatPill label="音符" value={String(frame.harmony.length)} color="var(--accent-bright)" />
      </div>

      {/* Spectrum — full width */}
      <PanelCard title="频谱">
        <SpectrumWave analyser={analyser} />
      </PanelCard>

      {/* Spatial + Harmony */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <PanelCard title="声场分布">
          <SpatialRadar frame={frame} />
        </PanelCard>
        <PanelCard title="和声分析">
          <HarmonyWheel frame={frame} />
        </PanelCard>
      </div>

      {/* Bands + Instruments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <PanelCard title="频段能量">
          <BandBars frame={frame} />
        </PanelCard>
        <PanelCard title="识别乐器">
          <InstrumentList frame={frame} />
        </PanelCard>
      </div>

      <style>{`
        @keyframes vis-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
