import React, { useEffect, useRef } from 'react'
import { useProgress, usePlayer } from '../providers/PlayerProvider'
import { useVisualizer } from '../providers/VisualizerProvider'
import { AudioAnalyzer } from '../visualizer/AudioAnalyzer'
import * as ambient from '../visualizer/gl/ambient'

// Ambient WebGL backdrop. Sits behind the entire UI, driven by the global
// AnalyserNode from PlayerProvider. Renders at half DPR so it's cheap.
export default function BackgroundVisualizer() {
  const { analyser } = useProgress()
  const { isPlaying } = usePlayer() as any
  const { theme, backgroundEnabled } = useVisualizer()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ isPlaying, theme })
  propsRef.current = { isPlaying, theme }

  useEffect(() => {
    if (!backgroundEnabled || !analyser) return
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) return

    const analyzer = new AudioAnalyzer(analyser)
    const state = ambient.init(gl)

    const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 1.5)) * 0.6
    let width = 2
    let height = 2

    const resize = () => {
      const w = Math.max(2, Math.floor(canvas.clientWidth * dpr))
      const h = Math.max(2, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h
        width = w; height = h
        gl.viewport(0, 0, w, h)
      }
    }
    resize()

    const start = performance.now()
    let raf = 0
    const tick = () => {
      resize()
      const time = (performance.now() - start) / 1000
      const frame = analyzer.analyze()
      ambient.render(state, {
        frame,
        playing: propsRef.current.isPlaying,
        theme: propsRef.current.theme,
        time,
        width,
        height,
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ambient.cleanup(state)
    }
  }, [analyser, backgroundEnabled])

  if (!backgroundEnabled) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.55,
        mixBlendMode: 'screen',
      }}
    />
  )
}
