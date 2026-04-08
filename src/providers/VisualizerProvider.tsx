import React, { createContext, useContext, useMemo, useState } from 'react'

type Mode = 'spectrum' | 'waveform' | 'radial' | 'spicetify' | 'cover-pulse'
type Theme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

type VisualizerCtx = {
  mode: Mode
  setMode: (m: Mode) => void
  sensitivity: number
  setSensitivity: (v: number) => void
  theme: Theme
  setTheme: (t: Theme) => void
  density: number
  setDensity: (d: number) => void
  smoothing: number
  setSmoothing: (v: number) => void
  bloom: number
  setBloom: (v: number) => void
}

const Ctx = createContext<VisualizerCtx | null>(null)

export function VisualizerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('cover-pulse')
  const [sensitivity, setSensitivity] = useState(1)
  const [theme, setTheme] = useState<Theme>('amber-dark')
  const [density, setDensity] = useState(512)
  const [smoothing, setSmoothing] = useState(0.72)
  const [bloom, setBloom] = useState(0.85)

  const value = useMemo(
    () => ({
      mode,
      setMode,
      sensitivity,
      setSensitivity,
      theme,
      setTheme,
      density,
      setDensity,
      smoothing,
      setSmoothing,
      bloom,
      setBloom,
    }),
    [mode, sensitivity, theme, density, smoothing, bloom],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useVisualizer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVisualizer must be used within VisualizerProvider')
  return ctx
}
