import { createProgram, GL } from './util'

// Bar histogram (replace previous blur)
export type BlurState = { gl: GL, program: WebGLProgram, vao: WebGLVertexArrayObject, uAmps: WebGLUniformLocation, uCount: WebGLUniformLocation }

export const init = (ctx: GL | null) => {
  const gl = ctx as GL
  const vs = `#version 300 es
  uniform float uAmps[256];
  uniform int uCount;
  out float vHue; out float vAmp;
  // 6 vertices per bar (two triangles)
  void main(){
    int bar = gl_VertexID / 6;
    int v = gl_VertexID % 6;
    float count = float(uCount);
    float amp = uAmps[bar];
    float spacing = 2.0 / count;
    float cx = -1.0 + spacing * (float(bar) + 0.5);
    float bw = spacing * 0.72;
    float h = max(0.02, amp) * 1.6;
    float x = cx + (v==0||v==2||v==3 ? -bw*0.5 : bw*0.5);
    float y = (v==0||v==1) ? -1.0 : (-1.0 + h);
    gl_Position = vec4(x, y, 0.0, 1.0);
    vHue = float(bar)/count; vAmp = amp;
  }`
  const fs = `#version 300 es
  precision highp float;
  in float vHue; in float vAmp; out vec4 o;
  vec3 h2rgb(float h){ return clamp(abs(fract(h+vec3(0.0,0.66,0.33))*6.0-3.0)-1.0,0.0,1.0); }
  void main(){ vec3 c = h2rgb(vHue); c = mix(vec3(0.2,0.2,0.24), c, 0.6+vAmp*0.4); o = vec4(c,1.0); }`
  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  const uAmps = gl.getUniformLocation(program,'uAmps')!
  const uCount = gl.getUniformLocation(program,'uCount')!
  return { gl, program, vao, uAmps, uCount }
}

export const resize = (ctx: GL | null, s: BlurState) => {
  s.gl.viewport(0,0,s.gl.drawingBufferWidth, s.gl.drawingBufferHeight)
}

export const render = (ctx: GL | null, data: { analyser: AnalyserNode }, s: BlurState) => {
  const gl = s.gl
  gl.useProgram(s.program)
  const amps = new Uint8Array(data.analyser.frequencyBinCount)
  data.analyser.getByteFrequencyData(amps)
  const count = Math.min(128, amps.length)
  const arr = new Float32Array(256)
  for (let i=0;i<count;i++){ arr[i] = amps[i]/255 }
  gl.uniform1fv(s.uAmps, arr)
  gl.uniform1i(s.uCount, count)
  gl.bindVertexArray(s.vao)
  gl.clearColor(0.06,0.06,0.06,1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES,0,count*6)
  gl.bindVertexArray(null)
}