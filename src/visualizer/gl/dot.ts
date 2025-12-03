import { createProgram, GL } from './util'

export type DotState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  count: number
  uRes: WebGLUniformLocation
  uAmps: WebGLUniformLocation
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
  uniform float uAmps[256];
  void main(){
    float a = gl_FragCoord.x*0.001;
    float h = fract(a);
    vec3 c = vec3(abs(h-0.5)*2.0, h, 1.0-h);
    o = vec4(c,1.0);
  }`
  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const count = 128
  const pos = new Float32Array(count*2)
  for (let i=0;i<count;i++){
    const t = (i/count)*Math.PI*2
    pos[i*2] = Math.cos(t)*0.8
    pos[i*2+1] = Math.sin(t)*0.8
  }
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)
  const uRes = gl.getUniformLocation(program,'uRes')!
  const uAmps = gl.getUniformLocation(program,'uAmps')!
  gl.bindVertexArray(null)
  return { gl, program, vao, count, uRes, uAmps }
}

export const resize = (ctx: GL | null, s: DotState) => {
  const gl = s.gl
  gl.viewport(0,0,gl.drawingBufferWidth, gl.drawingBufferHeight)
}

export const render = (ctx: GL | null, data: { analyser: AnalyserNode }, s: DotState) => {
  const gl = s.gl
  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  const amps = new Uint8Array(data.analyser.frequencyBinCount)
  data.analyser.getByteFrequencyData(amps)
  const arr = new Float32Array(256)
  for (let i=0;i<Math.min(256, s.count);i++) arr[i] = amps[i]/255
  gl.uniform1fv(s.uAmps, arr)
  gl.clearColor(0.06,0.06,0.06,1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.POINTS,0,s.count)
  gl.bindVertexArray(null)
}