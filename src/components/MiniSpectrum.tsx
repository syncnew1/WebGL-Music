import React, { useEffect, useRef } from 'react'
import { useProgress } from '../providers/PlayerProvider'
import { useVisualizer } from '../providers/VisualizerProvider'
import * as miniSpectrum from '../visualizer/gl/miniSpectrum'

type Props = {
  height?: number
  className?: string
  style?: React.CSSProperties
}

export default function MiniSpectrum({ height = 32, className, style }: Props) {
  const { analyser } = useProgress()
  const { theme, miniSpectrumEnabled } = useVisualizer()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    if (!miniSpectrumEnabled || !analyser) return
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false })
    if (!gl) return

    const state = miniSpectrum.init(gl)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const w = Math.max(2, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(2, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    resize()

    let raf = 0
    const tick = () => {
      resize()
      miniSpectrum.render(state, { analyser, theme: themeRef.current })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      miniSpectrum.cleanup(state)
    }
  }, [analyser, miniSpectrumEnabled])

  if (!miniSpectrumEnabled || !analyser) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height,
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
