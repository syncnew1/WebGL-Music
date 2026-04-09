
import React from 'react'
import { useVisualizer } from '../providers/VisualizerProvider'
import Button from './ui/Button'

const themes = [
  { id: 'amber-dark', label: '琥珀' },
  { id: 'neon-grid', label: '霓虹' },
  { id: 'deep-space', label: '深空' },
] as const

export default function VisualizerControls() {
  const {
    mode,
    setMode,
    sensitivity,
    setSensitivity,
    theme,
    setTheme,
    smoothing,
    setSmoothing,
    bloom,
    setBloom,
  } = useVisualizer()

  const isPulse = mode === 'cover-pulse'

  return (
    <div className="flex flex-col gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button variant={mode === 'cover-pulse' ? 'primary' : 'ghost'} onClick={() => setMode('cover-pulse')}>脉冲</Button>
        <Button variant={mode === 'radial' ? 'primary' : 'ghost'} onClick={() => setMode('radial')}>频谱环</Button>
        <Button variant={mode === 'spectrum' ? 'primary' : 'ghost'} onClick={() => setMode('spectrum')}>频谱</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {themes.map(t => (
          <Button key={t.id} variant={theme === t.id ? 'primary' : 'ghost'} onClick={() => setTheme(t.id)}>{t.label}</Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 justify-end text-xs text-muted">
        {isPulse ? (
          <>
            <label className="flex items-center gap-2">
              <span>敏感度</span>
              <input type="range" min={0.5} max={2} step={0.1} value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <span>平滑</span>
              <input type="range" min={0.3} max={0.95} step={0.01} value={smoothing} onChange={e => setSmoothing(parseFloat(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <span>泛光</span>
              <input type="range" min={0.1} max={1.4} step={0.05} value={bloom} onChange={e => setBloom(parseFloat(e.target.value))} />
            </label>
          </>
        ) : (
          <div className="status-chip">敏感度 / 平滑 / 泛光 仅在「脉冲」模式生效</div>
        )}
      </div>
    </div>
  )
}
