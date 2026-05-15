
import React from 'react'
import { useVisualizer } from '../providers/VisualizerProvider'
import Button from './ui/Button'

const themes = [
  { id: 'amber-dark', label: '琥珀', gradient: 'linear-gradient(135deg,#ff7319 0%,#ffd14d 55%,#fff2c7 100%)' },
  { id: 'neon-grid',  label: '霓虹', gradient: 'linear-gradient(135deg,#21d4ee 0%,#a854f7 55%,#f26bd9 100%)' },
  { id: 'deep-space', label: '深空', gradient: 'linear-gradient(135deg,#4d8cf2 0%,#f574b5 55%,#8c80f2 100%)' },
  { id: 'rainbow',    label: '晨曦', gradient: 'linear-gradient(135deg,#31c27c 0%,#21d4ee 55%,#fcc74d 100%)' },
] as const

export default function VisualizerControls() {
  const {
    mode, setMode,
    sensitivity, setSensitivity,
    theme, setTheme,
    bloom, setBloom,
    backgroundEnabled, setBackgroundEnabled,
    miniSpectrumEnabled, setMiniSpectrumEnabled,
  } = useVisualizer()

  return (
    <div className="flex flex-col gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button variant={mode === 'spectrum' ? 'primary' : 'ghost'} onClick={() => setMode('spectrum')}>频谱</Button>
        <Button variant={mode === 'radial' ? 'primary' : 'ghost'} onClick={() => setMode('radial')}>频谱环</Button>
        <Button variant={mode === 'cover-pulse' ? 'primary' : 'ghost'} onClick={() => setMode('cover-pulse')}>脉冲</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {themes.map(t => {
          const active = theme === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                borderRadius: 999,
                background: active ? 'rgba(49,194,124,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(49,194,124,0.45)' : 'rgba(255,255,255,0.10)'}`,
                color: active ? 'var(--accent-bright)' : 'var(--text-sub)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: t.gradient,
                boxShadow: active ? '0 0 10px rgba(255,255,255,0.18)' : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                flexShrink: 0,
              }} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 justify-end text-xs text-muted">
        <label className="flex items-center gap-2">
          <span>敏感度</span>
          <input type="range" min={0.5} max={2} step={0.1} value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <span>泛光</span>
          <input type="range" min={0.1} max={1.6} step={0.05} value={bloom} onChange={e => setBloom(parseFloat(e.target.value))} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button
          variant={backgroundEnabled ? 'primary' : 'ghost'}
          onClick={() => setBackgroundEnabled(!backgroundEnabled)}
        >
          背景可视化 {backgroundEnabled ? '已开启' : '已关闭'}
        </Button>
        <Button
          variant={miniSpectrumEnabled ? 'primary' : 'ghost'}
          onClick={() => setMiniSpectrumEnabled(!miniSpectrumEnabled)}
        >
          底栏频谱 {miniSpectrumEnabled ? '已开启' : '已关闭'}
        </Button>
      </div>
    </div>
  )
}
