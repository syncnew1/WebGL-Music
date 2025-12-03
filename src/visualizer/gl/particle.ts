import { createProgram, GL } from './util'

export type ParticleState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buf: WebGLBuffer
  pos: Float32Array
  vel: Float32Array
  count: number
}

export const init = (ctx: GL | null) => {
  const gl = ctx as GL
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  void main(){
    gl_Position = vec4(aPos,0.0,1.0);
    gl_PointSize = 2.0;
  }`
  const fs = `#version 300 es
  precision highp float;
  out vec4 o;
  void main(){
    float r = length(gl_PointCoord-0.5);
    float a = smoothstep(0.5,0.0,r);
    o = vec4(1.0, gl_FragCoord.y*0.001, 0.6, a);
  }`
  const program = createProgram(gl, vs, fs)
  const count = 2000
  const pos = new Float32Array(count*2)
  const vel = new Float32Array(count*2)
  for (let i=0;i<count;i++){
    pos[i*2]=0; pos[i*2+1]=0;
    vel[i*2]=(Math.random()*2-1)*0.002
    vel[i*2+1]=(Math.random()*2-1)*0.002
  }
  const buf = gl.createBuffer()!
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)
  gl.bindVertexArray(null)
  return { gl, program, vao, buf, pos, vel, count }
}

export const resize = (ctx: GL | null, s: ParticleState) => {
  const gl = s.gl
  gl.viewport(0,0,gl.drawingBufferWidth, gl.drawingBufferHeight)
}

export const render = (ctx: GL | null, data: { analyser: AnalyserNode, playing?: boolean }, s: ParticleState) => {
  const gl = s.gl
  gl.useProgram(s.program)
  const amps = new Uint8Array(data.analyser.frequencyBinCount)
  data.analyser.getByteFrequencyData(amps)
  const energy = amps[0]/255
  const play = !!data.playing
  for (let i=0;i<s.count;i++){
    const speed = play ? (0.5+energy) : 0.0
    s.vel[i*2] *= play ? 1.0 : 0.92
    s.vel[i*2+1] *= play ? 1.0 : 0.92
    s.pos[i*2]+=s.vel[i*2]*speed
    s.pos[i*2+1]+=s.vel[i*2+1]*speed
    const r = Math.hypot(s.pos[i*2], s.pos[i*2+1])
    if (r>1.0){ s.pos[i*2]*=0.6; s.pos[i*2+1]*=0.6 }
    if (!play){ s.pos[i*2]*=0.98; s.pos[i*2+1]*=0.98 }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.buf)
  gl.bufferSubData(gl.ARRAY_BUFFER,0,s.pos)
  gl.bindVertexArray(s.vao)
  gl.clearColor(0.06,0.06,0.06,1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.POINTS,0,s.count)
  gl.bindVertexArray(null)
}