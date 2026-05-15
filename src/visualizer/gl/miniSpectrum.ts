import { createProgram, GL } from './util'

// Compact frequency-bar visualizer designed for the player bar.
// Reuses the shader-instanced approach from gl/spectrum.ts but with tighter
// styling: thin bars, no peak indicators, single horizontal gradient.

export type MiniSpectrumState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  cornerBuf: WebGLBuffer
  instBuf: WebGLBuffer
  bars: number
  inst: Float32Array
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
}

export type MiniTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

const BARS = 64

const PALETTES: Record<MiniTheme, { primary: number[]; secondary: number[] }> = {
  'amber-dark': { primary: [1.00, 0.45, 0.10], secondary: [1.00, 0.85, 0.30] },
  'neon-grid':  { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97] },
  'deep-space': { primary: [0.30, 0.55, 0.95], secondary: [0.96, 0.45, 0.71] },
  'rainbow':    { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93] },
}

export const init = (gl: GL): MiniSpectrumState => {
  const vs = `#version 300 es
  layout(location=0) in vec2 aCorner;     // [0,1]^2
  layout(location=1) in vec3 aInst;       // (x0, x1, h)

  out float vT;
  out float vX;
  out float vEnergy;

  void main(){
    float x = mix(aInst.x, aInst.y, aCorner.x);
    float y = -1.0 + aCorner.y * aInst.z * 1.95;
    vT = aCorner.y;
    vX = (aInst.x + aInst.y) * 0.5 * 0.5 + 0.5;
    vEnergy = aInst.z;
    gl_Position = vec4(x, y, 0.0, 1.0);
  }`

  const fs = `#version 300 es
  precision highp float;
  in float vT;
  in float vX;
  in float vEnergy;
  out vec4 o;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  void main(){
    vec3 col = mix(uPrimary, uSecondary, vX);
    col *= 0.7 + vT * 0.6 + vEnergy * 0.4;
    o = vec4(col, 0.85);
  }`

  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  const cornerBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0, 1, 0, 0, 1,
    0, 1, 1, 0, 1, 1,
  ]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const instBuf = gl.createBuffer()!
  const inst = new Float32Array(BARS * 3)
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(1, 1)

  gl.bindVertexArray(null)

  return {
    gl, program, vao, cornerBuf, instBuf,
    bars: BARS,
    inst,
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
  }
}

export const cleanup = (s: MiniSpectrumState) => {
  const gl = s.gl
  gl.deleteBuffer(s.cornerBuf)
  gl.deleteBuffer(s.instBuf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

export type MiniSpectrumRenderInput = {
  analyser: AnalyserNode
  theme: MiniTheme
}

export const render = (s: MiniSpectrumState, input: MiniSpectrumRenderInput) => {
  const gl = s.gl
  const N = s.bars
  const buf = new Uint8Array(input.analyser.frequencyBinCount)
  input.analyser.getByteFrequencyData(buf)

  const minBin = 1
  const maxBin = Math.min(buf.length - 1, Math.floor(buf.length * 0.4))
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
    const x0 = -1 + i * span + span * 0.18
    const x1 = -1 + (i + 1) * span - span * 0.18
    s.inst[i * 3 + 0] = x0
    s.inst[i * 3 + 1] = x1
    s.inst[i * 3 + 2] = e
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.instBuf)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.inst)

  const palette = PALETTES[input.theme]
  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N)
  gl.disable(gl.BLEND)
  gl.bindVertexArray(null)
}
