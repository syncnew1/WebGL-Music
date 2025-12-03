import React, { createContext, useContext, useMemo, useState } from 'react'

type LayoutCtx = {
  leftOpen: boolean
  toggleLeft: () => void
  setLeft: (v: boolean) => void
}

const Ctx = createContext<LayoutCtx | null>(null)

export function LayoutProvider({ children }: { children: React.ReactNode }){
  const [leftOpen, setLeftOpen] = useState(true)
  const toggleLeft = () => setLeftOpen(v => !v)
  const setLeft = (v: boolean) => setLeftOpen(v)
  const value = useMemo(() => ({ leftOpen, toggleLeft, setLeft }), [leftOpen])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useLayout = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}