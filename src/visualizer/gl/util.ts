export type GL = WebGL2RenderingContext

const compileShader = (gl: GL, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || '未知 Shader 编译错误'
    gl.deleteShader(shader)
    console.error('[WebGL Shader 编译失败]', info, '\n源码:\n', source)
    throw new Error('[WebGL Shader 编译失败] ' + info)
  }
  return shader
}

export const createProgram = (
  gl: GL,
  vs: string,
  fs: string,
  transformFeedbackVaryings?: string[],
): WebGLProgram => {
  const v = compileShader(gl, gl.VERTEX_SHADER, vs)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  if (transformFeedbackVaryings && transformFeedbackVaryings.length) {
    gl.transformFeedbackVaryings(p, transformFeedbackVaryings, gl.INTERLEAVED_ATTRIBS)
  }
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(p) || '未知 Program 链接错误'
    console.error('[WebGL Program 链接失败]', info)
    throw new Error('[WebGL Program 链接失败] ' + info)
  }
  return p
}

export type Fbo = {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

export const createFbo = (gl: GL, width: number, height: number, opts?: { float?: boolean }): Fbo => {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  const internal = opts?.float ? gl.RGBA16F : gl.RGBA8
  const type = opts?.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fbo = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { fbo, tex, width, height }
}

export const resizeFbo = (gl: GL, target: Fbo, width: number, height: number, opts?: { float?: boolean }) => {
  if (target.width === width && target.height === height) return
  gl.bindTexture(gl.TEXTURE_2D, target.tex)
  const internal = opts?.float ? gl.RGBA16F : gl.RGBA8
  const type = opts?.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null)
  target.width = width
  target.height = height
}

export const deleteFbo = (gl: GL, target: Fbo) => {
  gl.deleteFramebuffer(target.fbo)
  gl.deleteTexture(target.tex)
}

export type FullscreenQuad = {
  vao: WebGLVertexArrayObject
  buf: WebGLBuffer
}

export const createFullscreenQuad = (gl: GL): FullscreenQuad => {
  const vao = gl.createVertexArray()!
  const buf = gl.createBuffer()!
  const data = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  return { vao, buf }
}

export const drawFullscreen = (gl: GL, quad: FullscreenQuad) => {
  gl.bindVertexArray(quad.vao)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.bindVertexArray(null)
}

export const deleteFullscreenQuad = (gl: GL, quad: FullscreenQuad) => {
  gl.deleteBuffer(quad.buf)
  gl.deleteVertexArray(quad.vao)
}

export const FS_QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`
