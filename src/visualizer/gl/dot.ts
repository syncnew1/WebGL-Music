import { createProgram, GL } from './util'

export type DotState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  count: number
  uRes: WebGLUniformLocation
  uAmps: WebGLUniformLocation
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
}

export const init = (ctx: GL | null) => {
  const gl = ctx as GL
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  uniform vec2 uRes;
  uniform float uAmps[256];
  void main(){
    int idx = gl_VertexID;
    float amp = uAmps[idx];
    vec2 p = aPos * (1.0 + amp*0.8);
    vec2 ndc = p;
    gl_Position = vec4(ndc,0.0,1.0);
    gl_PointSize = 3.0 + amp*6.0;
  }`
  const fs = `#version 300 es
  precision highp float;
  out vec4 o;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  void main(){
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, r);
    float mixT = clamp(gl_FragCoord.x / 1600.0, 0.0, 1.0);
    vec3 c = mix(uPrimary, uSecondary, mixT);
    o = vec4(c, a);
  }`
  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const count = 128
  const pos = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    pos[i * 2] = Math.cos(t) * 0.8
    pos[i * 2 + 1] = Math.sin(t) * 0.8
  }
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const uRes = gl.getUniformLocation(program, 'uRes')!
  const uAmps = gl.getUniformLocation(program, 'uAmps')!
  const uPrimary = gl.getUniformLocation(program, 'uPrimary')!
  const uSecondary = gl.getUniformLocation(program, 'uSecondary')!
  gl.bindVertexArray(null)
  return { gl, program, vao, count, uRes, uAmps, uPrimary, uSecondary }
}

export const resize = (ctx: GL | null, s: DotState) => {
  const gl = s.gl
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
}

export const render = (ctx: GL | null, data: { analyser: AnalyserNode; theme?: 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space' }, s: DotState) => {
  const gl = s.gl
  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  const amps = new Uint8Array(data.analyser.frequencyBinCount)
  data.analyser.getByteFrequencyData(amps)
  const arr = new Float32Array(256)
  for (let i = 0; i < Math.min(256, s.count); i++) arr[i] = amps[i] / 255
  const theme = data.theme ?? 'amber-dark'
  const palette = {
    'amber-dark': { primary: [1.0, 0.72, 0.30], secondary: [1.0, 0.48, 0.10] },
    'neon-grid': { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97] },
    'deep-space': { primary: [0.49, 0.83, 0.99], secondary: [0.96, 0.45, 0.71] },
    'rainbow': { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93] },
  }[theme]
  gl.uniform1fv(s.uAmps, arr)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.clearColor(0.06, 0.06, 0.06, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.drawArrays(gl.POINTS, 0, s.count)
  gl.disable(gl.BLEND)
  gl.bindVertexArray(null)
}
