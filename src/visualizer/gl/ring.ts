import { createProgram, GL } from './util'
import type { AnalysisFrame } from '../AudioAnalyzer'

export type RingState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  cornerBuf: WebGLBuffer
  instBuf: WebGLBuffer
  segments: number
  inst: Float32Array
  uRes: WebGLUniformLocation
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
  uTertiary: WebGLUniformLocation
  uBeatStr: WebGLUniformLocation
  uTime: WebGLUniformLocation
  uCentroid: WebGLUniformLocation
}

export type RingTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

const SEGMENTS = 96

export const init = (gl: GL): RingState => {
  const vs = `#version 300 es
  // per-vertex (corner of bar quad in [0,1]^2)
  layout(location=0) in vec2 aCorner;
  // per-instance (start angle, end angle, energy)
  layout(location=1) in vec3 aInst;
  uniform vec2 uRes;
  uniform float uBeatStr;
  uniform float uTime;
  uniform float uCentroid;

  out float vEnergy;
  out float vT;
  out vec2 vLocal;

  void main(){
    float a0 = aInst.x;
    float a1 = aInst.y;
    float energy = aInst.z;

    // ring geometry
    float aspect = uRes.x / max(uRes.y, 1.0);
    float baseR = 0.34;
    float inner = baseR - 0.04;
    float outer = baseR + 0.04 + energy * (0.42 + uBeatStr * 0.18);

    // bend a quad into an arc segment using polar coords
    float ang = mix(a0, a1, aCorner.x);
    float rad = mix(inner, outer, aCorner.y);

    // gentle wobble that follows the beat — keeps the ring alive on transients
    rad += sin(ang * 6.0 + uTime * 2.0) * 0.004 * uBeatStr;
    // brighter (high centroid) songs push the ring outward subtly
    rad += uCentroid * 0.018;

    vec2 p = vec2(cos(ang) * rad, sin(ang) * rad);
    p.x /= aspect;

    vEnergy = energy;
    vT = aCorner.y;
    vLocal = aCorner;
    gl_Position = vec4(p, 0.0, 1.0);
  }`

  const fs = `#version 300 es
  precision highp float;
  in float vEnergy;
  in float vT;
  in vec2 vLocal;
  out vec4 o;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uTertiary;

  void main(){
    // gradient from base of bar to its tip
    vec3 col = mix(uPrimary, uSecondary, vT);
    // 末端高光：仅顶端最后一截掺入 tertiary，避免覆盖整段
    col += uTertiary * pow(vT, 6.0) * (0.25 + vEnergy * 0.35);
    // soft edge falloff along the bar's width
    float edge = smoothstep(0.0, 0.08, vLocal.x) * smoothstep(1.0, 0.92, vLocal.x);
    float alpha = (0.55 + vEnergy * 0.6) * edge;
    o = vec4(col * (0.7 + vEnergy * 1.2), alpha);
  }`

  const program = createProgram(gl, vs, fs)

  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)

  // unit-quad corners shared by every instance
  const cornerBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0, 1, 0, 0, 1,
    0, 1, 1, 0, 1, 1,
  ]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  // per-instance buffer
  const instBuf = gl.createBuffer()!
  const inst = new Float32Array(SEGMENTS * 3)
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf)
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
  gl.vertexAttribDivisor(1, 1)

  gl.bindVertexArray(null)

  return {
    gl,
    program,
    vao,
    cornerBuf,
    instBuf,
    segments: SEGMENTS,
    inst,
    uRes: gl.getUniformLocation(program, 'uRes')!,
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
    uTertiary: gl.getUniformLocation(program, 'uTertiary')!,
    uBeatStr: gl.getUniformLocation(program, 'uBeatStr')!,
    uTime: gl.getUniformLocation(program, 'uTime')!,
    uCentroid: gl.getUniformLocation(program, 'uCentroid')!,
  }
}

export const cleanup = (s: RingState) => {
  const gl = s.gl
  gl.deleteBuffer(s.cornerBuf)
  gl.deleteBuffer(s.instBuf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

const PALETTES: Record<RingTheme, { primary: number[]; secondary: number[]; tertiary: number[] }> = {
  'amber-dark': { primary: [1.00, 0.55, 0.18], secondary: [1.00, 0.85, 0.50], tertiary: [1.00, 0.95, 0.78] },
  'neon-grid':  { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97], tertiary: [0.92, 0.48, 0.96] },
  'deep-space': { primary: [0.30, 0.55, 0.95], secondary: [0.96, 0.45, 0.71], tertiary: [0.55, 0.50, 0.95] },
  'rainbow':    { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93], tertiary: [0.60, 0.92, 0.75] },
}

export type RingRenderInput = {
  analyser: AnalyserNode
  frame: AnalysisFrame
  theme: RingTheme
  time: number
  width: number
  height: number
}

export const render = (s: RingState, input: RingRenderInput) => {
  const gl = s.gl
  const N = s.segments
  const buf = new Uint8Array(input.analyser.frequencyBinCount)
  input.analyser.getByteFrequencyData(buf)

  // log-spaced sampling so low frequencies aren't crushed
  const minBin = 2
  const maxBin = Math.min(buf.length - 1, Math.floor(buf.length * 0.55))
  const arc = (Math.PI * 2) / N
  for (let i = 0; i < N; i++) {
    const tNorm = i / (N - 1)
    const logT = Math.pow(tNorm, 1.6)
    const lo = Math.floor(minBin + (maxBin - minBin) * logT)
    const hi = Math.max(lo + 1, Math.floor(minBin + (maxBin - minBin) * Math.pow((i + 1) / (N - 1), 1.6)))
    let sum = 0
    let count = 0
    for (let k = lo; k <= hi && k < buf.length; k++) { sum += buf[k]; count++ }
    const e = count ? sum / (count * 255) : 0
    const a0 = i * arc - Math.PI / 2
    const a1 = (i + 0.85) * arc - Math.PI / 2
    s.inst[i * 3 + 0] = a0
    s.inst[i * 3 + 1] = a1
    s.inst[i * 3 + 2] = Math.pow(e, 0.85)
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.instBuf)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.inst)

  const palette = PALETTES[input.theme]
  const centroid = Math.max(0, Math.min(1, (input.frame.spectralCentroid - 200) / 4500))

  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform2f(s.uRes, input.width, input.height)
  gl.uniform1f(s.uBeatStr, input.frame.beatStrength)
  gl.uniform1f(s.uTime, input.time)
  gl.uniform1f(s.uCentroid, centroid)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.uniform3f(s.uTertiary, palette.tertiary[0], palette.tertiary[1], palette.tertiary[2])
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N)
  gl.disable(gl.BLEND)
  gl.bindVertexArray(null)
}
