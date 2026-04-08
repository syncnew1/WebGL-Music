import React, { useEffect, useMemo, useRef } from 'react'
import type { AnalysisFrame } from '../../visualizer/AudioAnalyzer'
import * as ringRenderer from '../../visualizer/gl/dot'
import * as coverRenderer from '../../visualizer/gl/cover'

type Mode = 'cover-pulse' | 'radial' | 'spectrum'
type Theme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

type Props = {
  analyser: AnalyserNode
  isPlaying: boolean
  mode: Mode
  theme: Theme
  sensitivity: number
  frame: AnalysisFrame
}

type RendererState =
  | { kind: 'cover'; state: ReturnType<typeof coverRenderer.init> }
  | { kind: 'ring'; state: ReturnType<typeof ringRenderer.init> }

export default function WebGLModeCanvas({ analyser, isPlaying, mode, theme, sensitivity, frame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<RendererState | null>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(performance.now())

  const webglMode = useMemo<'cover' | 'ring'>(() => {
    if (mode === 'cover-pulse') return 'cover'
    return 'ring'
  }, [mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!gl) return

    const initRenderer = () => {
      if (rendererRef.current?.kind === 'cover') coverRenderer.cleanup(rendererRef.current.state)

      if (webglMode === 'cover') {
        const state = coverRenderer.init(gl)
        rendererRef.current = { kind: 'cover', state }
      } else {
        const state = ringRenderer.init(gl)
        rendererRef.current = { kind: 'ring', state }
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const current = rendererRef.current
      if (!current) return
      if (current.kind === 'cover') coverRenderer.resize(gl, current.state)
      if (current.kind === 'ring') ringRenderer.resize(gl, current.state)
    }

    initRenderer()
    resize()

    const tick = () => {
      resize()
      const current = rendererRef.current
      if (!current) return
      if (current.kind === 'cover') {
        coverRenderer.render(gl, {
          analyser,
          playing: isPlaying,
          theme,
          time: (performance.now() - startRef.current) / 1000,
          sensitivity,
        }, current.state)
      } else {
        ringRenderer.render(gl, { analyser, theme }, current.state)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      const current = rendererRef.current
      if (current?.kind === 'cover') coverRenderer.cleanup(current.state)
      rendererRef.current = null
    }
  }, [analyser, webglMode, theme, sensitivity, isPlaying])

  return (
    <div style={{ position: 'relative', minHeight: 340, borderRadius: 22, overflow: 'hidden', background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(6,8,14,0.98) 72%)' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 340, display: 'block' }} />
      <div style={{ position: 'absolute', left: 18, bottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(6,8,14,0.52)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>WEBGL</div>
        <div style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(6,8,14,0.52)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
          Beat {Math.round(frame.beatStrength * 100)}%
        </div>
      </div>
    </div>
  )
}
