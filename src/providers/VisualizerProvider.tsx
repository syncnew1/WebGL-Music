import React, { createContext, useContext, useMemo, useState } from 'react'

type Mode = 'spectrum' | 'radial' | 'cover-pulse'
type Theme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

type VisualizerCtx = {
  mode: Mode
  setMode: (m: Mode) => void
  sensitivity: number
  setSensitivity: (v: number) => void
  theme: Theme
  setTheme: (t: Theme) => void
  smoothing: number
  setSmoothing: (v: number) => void
  bloom: number
  setBloom: (v: number) => void
  backgroundEnabled: boolean
  setBackgroundEnabled: (on: boolean) => void
  miniSpectrumEnabled: boolean
  setMiniSpectrumEnabled: (on: boolean) => void
}

const Ctx = createContext<VisualizerCtx | null>(null)

export function VisualizerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('spectrum')
  const [sensitivity, setSensitivity] = useState(1)
  const [theme, setTheme] = useState<Theme>('amber-dark')
  const [smoothing, setSmoothing] = useState(0.72)
  const [bloom, setBloom] = useState(0.85)
  const [backgroundEnabled, setBackgroundEnabled] = useState(true)
  const [miniSpectrumEnabled, setMiniSpectrumEnabled] = useState(true)

  const value = useMemo(
    () => ({
      mode, setMode,
      sensitivity, setSensitivity,
      theme, setTheme,
      smoothing, setSmoothing,
      bloom, setBloom,
      backgroundEnabled, setBackgroundEnabled,
      miniSpectrumEnabled, setMiniSpectrumEnabled,
    }),
    [mode, sensitivity, theme, smoothing, bloom, backgroundEnabled, miniSpectrumEnabled],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useVisualizer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVisualizer must be used within VisualizerProvider')
  return ctx
}
