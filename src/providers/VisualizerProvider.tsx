import React, { createContext, useContext, useMemo, useState } from 'react'

type Mode = 'spectrum' | 'waveform' | 'particles' | 'radial' | 'spicetify'
type VisualizerCtx = {
  mode: Mode
  setMode: (m: Mode) => void
  sensitivity: number
  setSensitivity: (v: number) => void
  theme: 'rainbow'
  setTheme: (t: 'rainbow') => void
  density: number
  setDensity: (d: number) => void
}

const Ctx = createContext<VisualizerCtx | null>(null)

export function VisualizerProvider({ children }: { children: React.ReactNode }){
  const [mode, setMode] = useState<Mode>('spectrum')
  const [sensitivity, setSensitivity] = useState(1)
  const [theme, setTheme] = useState<'rainbow'>('rainbow')
  const [density, setDensity] = useState(512)
  const value = useMemo(() => ({ mode, setMode, sensitivity, setSensitivity, theme, setTheme, density, setDensity }), [mode, sensitivity, theme, density])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useVisualizer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVisualizer must be used within VisualizerProvider')
  return ctx
}