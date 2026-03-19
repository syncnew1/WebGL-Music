import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayer } from '../../providers/PlayerProvider'
import { AudioAnalyzer, AnalysisFrame } from '../../visualizer/AudioAnalyzer'
import { SpatialRadar, HarmonyWheel, BandBars, SpectrumWave, InstrumentList } from './VisComponents'

const EMPTY_FRAME: AnalysisFrame = {
  bands: [], instruments: [], harmony: [],
  rms: 0, lufs: -60, spectralCentroid: 0, spectralFlux: 0,
}

function StatPill({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 3,
      minWidth: 90,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#727272' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? '#fff', lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, color: '#727272', marginLeft: 3 }}>{unit}</span>
      </div>
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
      if (analyzerRef.current) {
        setFrame(analyzerRef.current.analyze())
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      analyzerRef.current = null
    }
  }, [analyser])

  if (!analyser) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 400, gap: 16, color: '#727272',
      }}>
        <div style={{ fontSize: 48 }}>🎵</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>请先播放音乐以启动可视化分析</div>
        <div style={{ fontSize: 12 }}>点击下方播放按钮开始</div>
      </div>
    )
  }

  const lufsStr = isFinite(frame.lufs) ? frame.lufs.toFixed(1) : '-∞'
  const centroidKhz = (frame.spectralCentroid / 1000).toFixed(1)
  const rmsDb = (20 * Math.log10(Math.max(frame.rms, 1e-8))).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>音频分析</div>
          <div style={{ fontSize: 12, color: '#727272', marginTop: 2 }}>
            实时频谱 · 乐器识别 · 声场定位 · 和声分析
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 99,
          background: isPlaying ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isPlaying ? 'rgba(29,185,84,0.4)' : 'rgba(255,255,255,0.1)'}`,
          fontSize: 12, fontWeight: 600,
          color: isPlaying ? '#1db954' : '#727272',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isPlaying ? '#1db954' : '#727272',
            animation: isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
          {isPlaying ? '分析中' : '已暂停'}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatPill label="响度" value={lufsStr} unit="LUFS" color={frame.lufs > -14 ? '#ef4444' : '#1db954'} />
        <StatPill label="RMS" value={rmsDb} unit="dB" />
        <StatPill label="音色" value={centroidKhz} unit="kHz" color="#a78bfa" />
        <StatPill label="瞬态" value={(frame.spectralFlux * 100).toFixed(1)} unit="%" color="#f97316" />
        <StatPill label="乐器" value={String(frame.instruments.length)} color="#06b6d4" />
        <StatPill label="音符" value={String(frame.harmony.length)} color="#eab308" />
      </div>

      {/* Spectrum */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, padding: 16,
      }}>
        <SpectrumWave analyser={analyser} />
      </div>

      {/* Main grid: Spatial + Harmony */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 16,
        }}>
          <SpatialRadar frame={frame} />
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 16,
        }}>
          <HarmonyWheel frame={frame} />
        </div>
      </div>

      {/* Bottom grid: BandBars + InstrumentList */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 16,
        }}>
          <BandBars frame={frame} />
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 16,
        }}>
          <InstrumentList frame={frame} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
