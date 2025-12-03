import { createProgram, GL } from './util'

// Waveform line (replace previous finalize)
export type FinalizeState = { gl: GL, program: WebGLProgram, vao: WebGLVertexArrayObject, buf: WebGLBuffer, count: number }

export const init = (ctx: GL | null) => {
  const gl = ctx as GL
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  void main(){ gl_Position = vec4(aPos,0.0,1.0); }`
  const fs = `#version 300 es
  precision highp float;
  out vec4 o;
  void main(){ o = vec4(0.8,0.8,0.85,1.0); }`
  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  const buf = gl.createBuffer()!
  const count = 512
  const initPos = new Float32Array(count*2)
  for (let i=0;i<count;i++){ const x = -1 + (2*i)/(count-1); initPos[i*2]=x; initPos[i*2+1]=0 }
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, initPos, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)
  gl.bindVertexArray(null)
  return { gl, program, vao, buf, count }
}

export const resize = (ctx: GL | null, s: FinalizeState) => {
  s.gl.viewport(0,0,s.gl.drawingBufferWidth, s.gl.drawingBufferHeight)
}

export const render = (ctx: GL | null, data: { analyser: AnalyserNode }, s: FinalizeState) => {
  const gl = s.gl
  gl.useProgram(s.program)
  const samples = new Float32Array(data.analyser.fftSize)
  data.analyser.getFloatTimeDomainData(samples)
  const pos = new Float32Array(s.count*2)
  for (let i=0;i<s.count;i++){
    const x = -1 + (2*i)/(s.count-1)
    const y = samples[Math.floor((i/s.count)*samples.length)] * 0.8
    pos[i*2]=x; pos[i*2+1]=y
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.buf)
  gl.bufferSubData(gl.ARRAY_BUFFER,0,pos)
  gl.bindVertexArray(s.vao)
  gl.clearColor(0.06,0.06,0.06,1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.LINE_STRIP,0,s.count)
  gl.bindVertexArray(null)
}