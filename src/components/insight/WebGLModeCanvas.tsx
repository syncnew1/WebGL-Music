import React, { useEffect, useRef } from 'react'
import { AudioAnalyzer, AnalysisFrame } from '../../visualizer/AudioAnalyzer'
import * as cover from '../../visualizer/gl/cover'
import * as ring from '../../visualizer/gl/ring'
import * as spectrum from '../../visualizer/gl/spectrum'
import {
  Pipeline,
  createPipeline,
  resizePipeline,
  deletePipeline,
  beginScene,
  endSceneToScreen,
} from '../../visualizer/gl/pipeline'

export type Mode = 'cover-pulse' | 'radial' | 'spectrum'
export type Theme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

type Props = {
  analyser: AnalyserNode
  isPlaying: boolean
  mode: Mode
  theme: Theme
  sensitivity: number
  bloom: number
  height?: number
}

type Renderer =
  | { kind: 'cover-pulse'; state: cover.CoverState }
  | { kind: 'radial'; state: ring.RingState }
  | { kind: 'spectrum'; state: spectrum.SpectrumState }

const disposeRenderer = (r: Renderer) => {
  if (r.kind === 'cover-pulse') cover.cleanup(r.state)
  else if (r.kind === 'radial') ring.cleanup(r.state)
  else if (r.kind === 'spectrum') spectrum.cleanup(r.state)
}

const buildRenderer = (gl: WebGL2RenderingContext, mode: Mode): Renderer => {
  if (mode === 'cover-pulse') return { kind: 'cover-pulse', state: cover.init(gl) }
  if (mode === 'radial') return { kind: 'radial', state: ring.init(gl) }
  return { kind: 'spectrum', state: spectrum.init(gl) }
}

export default function WebGLModeCanvas({ analyser, isPlaying, mode, theme, sensitivity, bloom, height = 340 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // refs that change every frame but should not trigger effect re-runs
  const propsRef = useRef({ isPlaying, mode, theme, sensitivity, bloom })
  propsRef.current = { isPlaying, mode, theme, sensitivity, bloom }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false })
    if (!gl) {
      console.warn('[WebGLModeCanvas] WebGL2 not supported')
      return
    }
    // RGBA16F support requires EXT_color_buffer_float in WebGL2
    gl.getExtension('EXT_color_buffer_float')

    const analyzer = new AudioAnalyzer(analyser)
    let frame: AnalysisFrame = analyzer.analyze()

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = Math.max(2, Math.floor(canvas.clientWidth * dpr))
    let h = Math.max(2, Math.floor(canvas.clientHeight * dpr))
    canvas.width = width
    canvas.height = h

    const pipeline: Pipeline = createPipeline(gl, width, h)
    let renderer: Renderer = buildRenderer(gl, propsRef.current.mode)
    let activeMode: Mode = propsRef.current.mode

    const resize = () => {
      const dpr2 = Math.min(window.devicePixelRatio || 1, 2)
      const w2 = Math.max(2, Math.floor(canvas.clientWidth * dpr2))
      const h2 = Math.max(2, Math.floor(canvas.clientHeight * dpr2))
      if (canvas.width !== w2 || canvas.height !== h2) {
        canvas.width = w2
        canvas.height = h2
        width = w2
        h = h2
        resizePipeline(gl, pipeline, w2, h2)
      }
    }

    const start = performance.now()
    let raf = 0

    const tick = () => {
      resize()
      const p = propsRef.current

      if (p.mode !== activeMode) {
        disposeRenderer(renderer)
        renderer = buildRenderer(gl, p.mode)
        activeMode = p.mode
      }

      frame = analyzer.analyze()
      const time = (performance.now() - start) / 1000

      // 1. render into the scene FBO
      beginScene(gl, pipeline, [0.012, 0.018, 0.032, 1])
      if (renderer.kind === 'cover-pulse') {
        cover.render(renderer.state, {
          frame, playing: p.isPlaying, theme: p.theme, time,
          sensitivity: p.sensitivity, width, height: h,
        })
      } else if (renderer.kind === 'radial') {
        ring.render(renderer.state, {
          analyser, frame, theme: p.theme, time, width, height: h,
        })
      } else {
        spectrum.render(renderer.state, {
          analyser, frame, theme: p.theme, time,
        })
      }

      // 2. bloom + tonemap to screen
      const strength = 0.55 + p.bloom * 1.1
      const threshold = 0.35
      const iters = activeMode === 'cover-pulse' ? 4 : 3
      endSceneToScreen(gl, pipeline, {
        bloomStrength: strength,
        bloomThreshold: threshold,
        bloomIterations: iters,
        vignette: 0.45,
        time,
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      disposeRenderer(renderer)
      deletePipeline(gl, pipeline)
    }
  }, [analyser])

  return (
    <div style={{
      position: 'relative',
      minHeight: height,
      borderRadius: 22,
      overflow: 'hidden',
      background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(6,8,14,0.98) 72%)',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />
    </div>
  )
}
