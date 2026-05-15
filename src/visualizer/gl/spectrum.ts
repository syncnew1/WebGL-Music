import { createProgram, GL } from './util'
import type { AnalysisFrame } from '../AudioAnalyzer'

export type SpectrumState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  cornerBuf: WebGLBuffer
  instBuf: WebGLBuffer
  bars: number
  inst: Float32Array
  peaks: Float32Array
  decays: Float32Array
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
  uTertiary: WebGLUniformLocation
  uTime: WebGLUniformLocation
  uCentroid: WebGLUniformLocation
}

export type SpectrumTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

const BARS = 128

export const init = (gl: GL): SpectrumState => {
  const vs = `#version 300 es
  layout(location=0) in vec2 aCorner;     // [0,1]^2
  layout(location=1) in vec4 aInst;       // (x0, x1, h, peak)
  uniform float uTime;

  out float vT;
  out float vEnergy;
  out float vBar;
  flat out int vIsPeak;

  void main(){
    float x0 = aInst.x;
    float x1 = aInst.y;
    float h = aInst.z;
    float peak = aInst.w;

    float x = mix(x0, x1, aCorner.x);
    // Bottom half: bar; top thin slice (corner.y near 1) emits a peak indicator
    float y;
    int isPeak = 0;
    if (aCorner.y < 1.0) {
      y = -1.0 + aCorner.y * h * 1.6;
    } else {
      // peak marker is a small slab above the latest bar height
      y = -1.0 + peak * 1.6 + 0.018;
      isPeak = 1;
    }
    vT = aCorner.y;
    vEnergy = h;
    vBar = (x0 + x1) * 0.5 * 0.5 + 0.5;
    vIsPeak = isPeak;
    gl_Position = vec4(x, y, 0.0, 1.0);
  }`

  const fs = `#version 300 es
  precision highp float;
  in float vT;
  in float vEnergy;
  in float vBar;
  flat in int vIsPeak;
  out vec4 o;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uTertiary;
  uniform float uCentroid;

  void main(){
    if (vIsPeak == 1) {
      o = vec4(uTertiary, 0.85);
      return;
    }
    // 仅 primary→secondary 横向渐变；tertiary 留给峰值指示线
    vec3 col = mix(uPrimary, uSecondary, vBar);
    float gain = 0.55 + vEnergy * 1.1;
    o = vec4(col * gain, 0.85 + vEnergy * 0.15);
  }`

  const program = createProgram(gl, vs, fs)

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  // 6 corner verts for the bar quad + 6 for the peak slab (handled by y-mode)
  const cornerBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf)
  // First 6 verts: bar (corner.y in {0,1}). Next 6: peak slab (we use corner.y == 1 + sentinel handled via uniform branch).
  // Simpler: just emit 6 verts per bar and a separate 6 verts per bar with corner.y = 2.0 to mark "peak"
  const verts = new Float32Array([
    // bar (corner.y < 1): 6 verts
    0, 0, 1, 0, 0, 1,
    0, 1, 1, 0, 1, 1,
    // peak indicator quad (corner.y = 1.5 means "peak")
    0, 1.5, 1, 1.5, 0, 1.55,
    0, 1.55, 1, 1.5, 1, 1.55,
  ])
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const instBuf = gl.createBuffer()!
  const inst = new Float32Array(BARS * 4)
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(1, 1)

  gl.bindVertexArray(null)

  return {
    gl,
    program,
    vao,
    cornerBuf,
    instBuf,
    bars: BARS,
    inst,
    peaks: new Float32Array(BARS),
    decays: new Float32Array(BARS),
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
    uTertiary: gl.getUniformLocation(program, 'uTertiary')!,
    uTime: gl.getUniformLocation(program, 'uTime')!,
    uCentroid: gl.getUniformLocation(program, 'uCentroid')!,
  }
}

export const cleanup = (s: SpectrumState) => {
  const gl = s.gl
  gl.deleteBuffer(s.cornerBuf)
  gl.deleteBuffer(s.instBuf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

const PALETTES: Record<SpectrumTheme, { primary: number[]; secondary: number[]; tertiary: number[] }> = {
  'amber-dark': { primary: [1.00, 0.45, 0.10], secondary: [1.00, 0.82, 0.30], tertiary: [1.00, 0.95, 0.78] },
  'neon-grid':  { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97], tertiary: [0.95, 0.42, 0.85] },
  'deep-space': { primary: [0.30, 0.55, 0.95], secondary: [0.96, 0.45, 0.71], tertiary: [0.55, 0.50, 0.95] },
  'rainbow':    { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93], tertiary: [0.60, 0.92, 0.75] },
}

export type SpectrumRenderInput = {
  analyser: AnalyserNode
  frame: AnalysisFrame
  theme: SpectrumTheme
  time: number
}

export const render = (s: SpectrumState, input: SpectrumRenderInput) => {
  const gl = s.gl
  const N = s.bars
  const buf = new Uint8Array(input.analyser.frequencyBinCount)
  input.analyser.getByteFrequencyData(buf)

  const minBin = 1
  const maxBin = Math.min(buf.length - 1, Math.floor(buf.length * 0.5))
  const span = 2.0 / N
  for (let i = 0; i < N; i++) {
    const t0 = Math.pow(i / N, 1.55)
    const t1 = Math.pow((i + 1) / N, 1.55)
    const lo = Math.floor(minBin + (maxBin - minBin) * t0)
    const hi = Math.max(lo + 1, Math.floor(minBin + (maxBin - minBin) * t1))
    let sum = 0
    let count = 0
    for (let k = lo; k <= hi && k < buf.length; k++) { sum += buf[k]; count++ }
    const e = count ? Math.pow(sum / (count * 255), 0.85) : 0
    const x0 = -1 + i * span + span * 0.10
    const x1 = -1 + (i + 1) * span - span * 0.10
    if (e > s.peaks[i]) { s.peaks[i] = e; s.decays[i] = 0 }
    else { s.decays[i] += 0.0008; s.peaks[i] = Math.max(0, s.peaks[i] - s.decays[i]) }
    s.inst[i * 4 + 0] = x0
    s.inst[i * 4 + 1] = x1
    s.inst[i * 4 + 2] = e
    s.inst[i * 4 + 3] = s.peaks[i]
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.instBuf)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.inst)

  const palette = PALETTES[input.theme]
  const centroid = Math.max(0, Math.min(1, (input.frame.spectralCentroid - 200) / 4500))

  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform1f(s.uTime, input.time)
  gl.uniform1f(s.uCentroid, centroid)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.uniform3f(s.uTertiary, palette.tertiary[0], palette.tertiary[1], palette.tertiary[2])
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 12, N)
  gl.disable(gl.BLEND)
  gl.bindVertexArray(null)
}
