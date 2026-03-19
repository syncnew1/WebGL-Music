export type GL = WebGL2RenderingContext

// 编译 Shader 并检查错误
const compileShader = (gl: GL, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || '未知 Shader 编译错误'
    gl.deleteShader(shader)
    console.error('[WebGL Shader 编译失败]', info)
    throw new Error('[WebGL Shader 编译失败] ' + info)
  }
  return shader
}

export const createProgram = (gl: GL, vs: string, fs: string): WebGLProgram => {
  const v = compileShader(gl, gl.VERTEX_SHADER, vs)
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
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
