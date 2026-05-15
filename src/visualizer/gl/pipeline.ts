import {
  GL,
  Fbo,
  FullscreenQuad,
  createFbo,
  resizeFbo,
  deleteFbo,
  createFullscreenQuad,
  drawFullscreen,
  deleteFullscreenQuad,
  createProgram,
  FS_QUAD_VS,
} from './util'

export type Pipeline = {
  gl: GL
  scene: Fbo
  ping: Fbo
  pong: Fbo
  quad: FullscreenQuad
  bright: WebGLProgram
  blur: WebGLProgram
  composite: WebGLProgram
  uBrightThreshold: WebGLUniformLocation
  uBrightTex: WebGLUniformLocation
  uBlurTex: WebGLUniformLocation
  uBlurDir: WebGLUniformLocation
  uBlurTexel: WebGLUniformLocation
  uCompSrc: WebGLUniformLocation
  uCompBloom: WebGLUniformLocation
  uCompBloomStrength: WebGLUniformLocation
  uCompTime: WebGLUniformLocation
  uCompVignette: WebGLUniformLocation
  width: number
  height: number
}

const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThreshold, uThreshold + 0.25, lum);
  o = vec4(c * k, 1.0);
}`

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uDir;
const float w0 = 0.227027;
const float w1 = 0.1945946;
const float w2 = 0.1216216;
const float w3 = 0.054054;
const float w4 = 0.016216;
void main(){
  vec2 step = uTexel * uDir;
  vec3 c = texture(uTex, vUv).rgb * w0;
  c += texture(uTex, vUv + step * 1.0).rgb * w1;
  c += texture(uTex, vUv - step * 1.0).rgb * w1;
  c += texture(uTex, vUv + step * 2.0).rgb * w2;
  c += texture(uTex, vUv - step * 2.0).rgb * w2;
  c += texture(uTex, vUv + step * 3.0).rgb * w3;
  c += texture(uTex, vUv - step * 3.0).rgb * w3;
  c += texture(uTex, vUv + step * 4.0).rgb * w4;
  c += texture(uTex, vUv - step * 4.0).rgb * w4;
  o = vec4(c, 1.0);
}`

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uTime;
uniform float uVignette;
vec3 aces(vec3 x){
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
void main(){
  vec3 src = texture(uSrc, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = src + bloom * uBloomStrength;
  vec2 q = vUv - 0.5;
  float vig = smoothstep(0.85, 0.25, length(q));
  col *= mix(1.0, vig, uVignette);
  float n = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.012;
  col = aces(col);
  o = vec4(col, 1.0);
}`

export const createPipeline = (gl: GL, width: number, height: number): Pipeline => {
  const scene = createFbo(gl, width, height, { float: true })
  const halfW = Math.max(2, width >> 1)
  const halfH = Math.max(2, height >> 1)
  const ping = createFbo(gl, halfW, halfH, { float: true })
  const pong = createFbo(gl, halfW, halfH, { float: true })
  const quad = createFullscreenQuad(gl)
  const bright = createProgram(gl, FS_QUAD_VS, BRIGHT_FS)
  const blur = createProgram(gl, FS_QUAD_VS, BLUR_FS)
  const composite = createProgram(gl, FS_QUAD_VS, COMPOSITE_FS)
  return {
    gl,
    scene,
    ping,
    pong,
    quad,
    bright,
    blur,
    composite,
    uBrightThreshold: gl.getUniformLocation(bright, 'uThreshold')!,
    uBrightTex: gl.getUniformLocation(bright, 'uTex')!,
    uBlurTex: gl.getUniformLocation(blur, 'uTex')!,
    uBlurDir: gl.getUniformLocation(blur, 'uDir')!,
    uBlurTexel: gl.getUniformLocation(blur, 'uTexel')!,
    uCompSrc: gl.getUniformLocation(composite, 'uSrc')!,
    uCompBloom: gl.getUniformLocation(composite, 'uBloom')!,
    uCompBloomStrength: gl.getUniformLocation(composite, 'uBloomStrength')!,
    uCompTime: gl.getUniformLocation(composite, 'uTime')!,
    uCompVignette: gl.getUniformLocation(composite, 'uVignette')!,
    width,
    height,
  }
}

export const resizePipeline = (gl: GL, p: Pipeline, width: number, height: number) => {
  if (p.width === width && p.height === height) return
  resizeFbo(gl, p.scene, width, height, { float: true })
  const halfW = Math.max(2, width >> 1)
  const halfH = Math.max(2, height >> 1)
  resizeFbo(gl, p.ping, halfW, halfH, { float: true })
  resizeFbo(gl, p.pong, halfW, halfH, { float: true })
  p.width = width
  p.height = height
}

export const deletePipeline = (gl: GL, p: Pipeline) => {
  deleteFbo(gl, p.scene)
  deleteFbo(gl, p.ping)
  deleteFbo(gl, p.pong)
  deleteFullscreenQuad(gl, p.quad)
  gl.deleteProgram(p.bright)
  gl.deleteProgram(p.blur)
  gl.deleteProgram(p.composite)
}

export const beginScene = (gl: GL, p: Pipeline, clear: [number, number, number, number] = [0, 0, 0, 1]) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, p.scene.fbo)
  gl.viewport(0, 0, p.scene.width, p.scene.height)
  gl.clearColor(clear[0], clear[1], clear[2], clear[3])
  gl.clear(gl.COLOR_BUFFER_BIT)
}

export const endSceneToScreen = (
  gl: GL,
  p: Pipeline,
  opts: { bloomStrength: number; bloomThreshold: number; bloomIterations: number; vignette: number; time: number },
) => {
  const halfW = p.ping.width
  const halfH = p.ping.height

  gl.bindFramebuffer(gl.FRAMEBUFFER, p.ping.fbo)
  gl.viewport(0, 0, halfW, halfH)
  gl.useProgram(p.bright)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, p.scene.tex)
  gl.uniform1i(p.uBrightTex, 0)
  gl.uniform1f(p.uBrightThreshold, opts.bloomThreshold)
  drawFullscreen(gl, p.quad)

  gl.useProgram(p.blur)
  gl.uniform2f(p.uBlurTexel, 1 / halfW, 1 / halfH)
  gl.uniform1i(p.uBlurTex, 0)
  let src = p.ping
  let dst = p.pong
  const passes = Math.max(1, Math.min(8, opts.bloomIterations))
  for (let i = 0; i < passes; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.uniform2f(p.uBlurDir, 1, 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    drawFullscreen(gl, p.quad)
    const swap = src; src = dst; dst = swap
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.uniform2f(p.uBlurDir, 0, 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    drawFullscreen(gl, p.quad)
    const swap2 = src; src = dst; dst = swap2
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, p.scene.width, p.scene.height)
  gl.useProgram(p.composite)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, p.scene.tex)
  gl.uniform1i(p.uCompSrc, 0)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, src.tex)
  gl.uniform1i(p.uCompBloom, 1)
  gl.uniform1f(p.uCompBloomStrength, opts.bloomStrength)
  gl.uniform1f(p.uCompTime, opts.time)
  gl.uniform1f(p.uCompVignette, opts.vignette)
  drawFullscreen(gl, p.quad)
}
