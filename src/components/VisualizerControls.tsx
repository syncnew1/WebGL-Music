
import React from 'react'
import { useVisualizer } from '../providers/VisualizerProvider'
import Button from './ui/Button'

const themes = [
  { id: 'amber-dark', label: '琥珀', stops: ['#ff7319', '#ffd14d', '#fff2c7'] },
  { id: 'neon-grid',  label: '霓虹', stops: ['#21d4ee', '#a854f7', '#f26bd9'] },
  { id: 'deep-space', label: '深空', stops: ['#4d8cf2', '#f574b5', '#8c80f2'] },
  { id: 'rainbow',    label: '翡翠', stops: ['#31c27c', '#21d4ee', '#9bebbf'] },
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
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  width: 22, height: 14, borderRadius: 4, overflow: 'hidden',
                  boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.25)' : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                  flexShrink: 0,
                }}
              >
                {t.stops.map(c => (
                  <span key={c} style={{ flex: 1, background: c, display: 'block' }} />
                ))}
              </span>
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
