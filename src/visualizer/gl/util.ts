export type GL = WebGL2RenderingContext
export const createProgram = (gl: GL, vs: string, fs: string) => {
  const v = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(v, vs)
  gl.compileShader(v)
  const f = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(f, fs)
  gl.compileShader(f)
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  return p
}