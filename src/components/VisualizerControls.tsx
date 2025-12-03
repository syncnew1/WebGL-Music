import React from 'react'
import { useVisualizer } from '../providers/VisualizerProvider'
import Button from './ui/Button'

export default function VisualizerControls(){
  const { mode, setMode, sensitivity, setSensitivity, density, setDensity } = useVisualizer()
  return (
    <div className="flex flex-wrap items-center gap-2 justify-end mb-2">
      <Button onClick={() => setMode('spectrum')}>频谱</Button>
      <Button onClick={() => setMode('waveform')}>波形</Button>
      <Button onClick={() => setMode('radial')}>圆环频谱</Button>
      <Button onClick={() => setMode('spicetify')}>环形可视化</Button>
      <Button onClick={() => setMode('particles')}>粒子</Button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">敏感度</span>
        <input type="range" min={0.5} max={2} step={0.1} value={sensitivity} onChange={e=>setSensitivity(parseFloat(e.target.value))} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">密度</span>
        <input type="range" min={32} max={1024} step={32} value={density} onChange={e=>setDensity(parseInt(e.target.value))} />
      </div>
    </div>
  )
}