import { createProgram, GL } from './util'

export type CoverState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buf: WebGLBuffer
  uRes: WebGLUniformLocation
  uTime: WebGLUniformLocation
  uBass: WebGLUniformLocation
  uMid: WebGLUniformLocation
  uTreble: WebGLUniformLocation
  uBeat: WebGLUniformLocation
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
}

export const init = (ctx: GL | null) => {
  const gl = ctx as GL
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`

  const fs = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;

  float ring(vec2 uv, float radius, float width) {
    float d = abs(length(uv) - radius);
    return smoothstep(width, 0.0, d);
  }

  void main(){
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uRes.x / max(uRes.y, 1.0);
    float t = uTime * 0.75;
    float d = length(uv);

    vec3 bg = mix(vec3(0.02, 0.03, 0.05), vec3(0.08, 0.04, 0.02), clamp(uBass * 0.8, 0.0, 1.0));
    vec3 color = bg;

    float pulse = 0.28 + uBass * 0.12 + uBeat * 0.08;
    float r1 = ring(uv, pulse + sin(t) * 0.01, 0.014 + uTreble * 0.01);
    float r2 = ring(uv, pulse + 0.18 + sin(t * 1.4) * 0.015, 0.012 + uTreble * 0.012);
    float r3 = ring(uv, pulse + 0.34 + sin(t * 0.8) * 0.02, 0.010 + uTreble * 0.008);
    float core = smoothstep(0.35, 0.0, d) * (0.28 + uMid * 0.4);
    float halo = smoothstep(0.95 + uBeat * 0.2, 0.0, d) * (0.20 + uBass * 0.32);

    color += uPrimary * (r1 * (0.8 + uBeat * 0.9) + core * 0.9 + halo * 0.25);
    color += uSecondary * (r2 * (0.65 + uBass * 0.6) + r3 * (0.5 + uTreble * 0.7) + halo * 0.18);

    float sparkle = smoothstep(0.02, 0.0, abs(sin((atan(uv.y, uv.x) + t * 0.6) * 10.0))) * uTreble * 0.18;
    color += vec3(sparkle);

    o = vec4(color, 1.0);
  }`

  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  const buf = gl.createBuffer()!
  const quad = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ])
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return {
    gl,
    program,
    vao,
    buf,
    uRes: gl.getUniformLocation(program, 'uRes')!,
    uTime: gl.getUniformLocation(program, 'uTime')!,
    uBass: gl.getUniformLocation(program, 'uBass')!,
    uMid: gl.getUniformLocation(program, 'uMid')!,
    uTreble: gl.getUniformLocation(program, 'uTreble')!,
    uBeat: gl.getUniformLocation(program, 'uBeat')!,
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
  }
}

export const resize = (ctx: GL | null, s: CoverState) => {
  s.gl.viewport(0, 0, s.gl.drawingBufferWidth, s.gl.drawingBufferHeight)
}

export const cleanup = (s: CoverState) => {
  const gl = s.gl
  gl.deleteBuffer(s.buf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

export const render = (
  ctx: GL | null,
  data: { analyser: AnalyserNode; playing?: boolean; theme?: 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'; time?: number; sensitivity?: number },
  s: CoverState,
) => {
  const gl = s.gl
  const amps = new Uint8Array(data.analyser.frequencyBinCount)
  data.analyser.getByteFrequencyData(amps)
  const avg = (from: number, to: number) => {
    let sum = 0
    let count = 0
    for (let i = from; i < Math.min(to, amps.length); i++) {
      sum += amps[i]
      count++
    }
    return count ? sum / (count * 255) : 0
  }
  const sensitivity = data.sensitivity ?? 1
  const bass = Math.min(1, avg(0, 12) * 1.6 * sensitivity)
  const mid = Math.min(1, avg(12, 48) * 1.4 * sensitivity)
  const treble = Math.min(1, avg(48, 120) * 1.6 * sensitivity)
  const beat = Math.max(0, bass * 1.15 - 0.18)
  const theme = data.theme ?? 'amber-dark'
  const palette = {
    'amber-dark': { primary: [1.0, 0.72, 0.30], secondary: [1.0, 0.48, 0.10] },
    'neon-grid': { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97] },
    'deep-space': { primary: [0.49, 0.83, 0.99], secondary: [0.96, 0.45, 0.71] },
    'rainbow': { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93] },
  }[theme]

  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform2f(s.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight)
  gl.uniform1f(s.uTime, data.time ?? 0)
  gl.uniform1f(s.uBass, bass)
  gl.uniform1f(s.uMid, mid)
  gl.uniform1f(s.uTreble, treble)
  gl.uniform1f(s.uBeat, data.playing ? beat : 0)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.clearColor(0.02, 0.02, 0.03, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.bindVertexArray(null)
}
