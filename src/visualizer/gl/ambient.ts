import { createProgram, GL } from './util'
import type { AnalysisFrame } from '../AudioAnalyzer'

// Ambient full-screen backdrop. Designed to be quiet at idle and respond
// gently when audio is playing. Renders at half DPR for cheap fill rate.

export type AmbientState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buf: WebGLBuffer
  uRes: WebGLUniformLocation
  uTime: WebGLUniformLocation
  uIntensity: WebGLUniformLocation
  uBass: WebGLUniformLocation
  uMid: WebGLUniformLocation
  uTreble: WebGLUniformLocation
  uBeat: WebGLUniformLocation
  uCentroid: WebGLUniformLocation
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
  uTertiary: WebGLUniformLocation
}

export type AmbientTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

const PALETTES: Record<AmbientTheme, { primary: number[]; secondary: number[]; tertiary: number[] }> = {
  'amber-dark': { primary: [0.50, 0.22, 0.05], secondary: [0.30, 0.10, 0.04], tertiary: [0.65, 0.45, 0.18] },
  'neon-grid':  { primary: [0.05, 0.32, 0.45], secondary: [0.22, 0.08, 0.42], tertiary: [0.42, 0.18, 0.55] },
  'deep-space': { primary: [0.06, 0.10, 0.30], secondary: [0.32, 0.10, 0.28], tertiary: [0.18, 0.20, 0.45] },
  'rainbow':    { primary: [0.06, 0.28, 0.18], secondary: [0.05, 0.30, 0.40], tertiary: [0.30, 0.40, 0.18] },
}

export const init = (gl: GL): AmbientState => {
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

  const fs = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uCentroid;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uTertiary;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.04; a *= 0.5; }
    return s;
  }

  void main(){
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uRes.x / max(uRes.y, 1.0);

    float t = uTime * 0.05;
    // Slow domain warp; energy from the bass band makes it pulse with the beat
    vec2 q = uv * 0.6 + vec2(t, -t * 0.7);
    q += 0.5 * vec2(fbm(q + vec2(t * 0.6, 0.0)), fbm(q - vec2(0.0, t * 0.4)));
    float n = fbm(q);
    float n2 = fbm(q * 1.7 + vec2(2.3, -1.1));

    // Three soft horizontal bands of color, each shifted by audio
    float band1 = smoothstep(0.65, 0.0, abs(uv.y - (-0.55 + uBass * 0.18)));
    float band2 = smoothstep(0.85, 0.0, abs(uv.y - (0.05 + uMid * 0.14 - uBass * 0.05)));
    float band3 = smoothstep(0.75, 0.0, abs(uv.y - (0.55 - uTreble * 0.18)));

    vec3 col = vec3(0.0);
    col += uPrimary * band1 * (0.6 + 0.4 * n);
    col += uSecondary * band2 * (0.6 + 0.4 * n2);
    col += uTertiary * band3 * (0.5 + 0.5 * n);

    // gentle radial vignette so corners stay quiet
    float r = length(uv * vec2(0.85, 1.0));
    col *= mix(1.0, smoothstep(1.6, 0.2, r), 0.6);

    // beat shimmer
    col += uTertiary * (uBeat * 0.18) * smoothstep(1.4, 0.0, r);
    // brightness scaled by playing intensity
    col *= 0.55 + uIntensity * 0.85;

    // bake to subtle dark base
    vec3 base = vec3(0.018, 0.024, 0.04);
    o = vec4(base + col, 1.0);
  }`

  const program = createProgram(gl, vs, fs)
  const vao = gl.createVertexArray()!
  const buf = gl.createBuffer()!
  const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  return {
    gl, program, vao, buf,
    uRes: gl.getUniformLocation(program, 'uRes')!,
    uTime: gl.getUniformLocation(program, 'uTime')!,
    uIntensity: gl.getUniformLocation(program, 'uIntensity')!,
    uBass: gl.getUniformLocation(program, 'uBass')!,
    uMid: gl.getUniformLocation(program, 'uMid')!,
    uTreble: gl.getUniformLocation(program, 'uTreble')!,
    uBeat: gl.getUniformLocation(program, 'uBeat')!,
    uCentroid: gl.getUniformLocation(program, 'uCentroid')!,
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
    uTertiary: gl.getUniformLocation(program, 'uTertiary')!,
  }
}

export const cleanup = (s: AmbientState) => {
  const gl = s.gl
  gl.deleteBuffer(s.buf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

export type AmbientRenderInput = {
  frame: AnalysisFrame
  playing: boolean
  theme: AmbientTheme
  time: number
  width: number
  height: number
}

export const render = (s: AmbientState, input: AmbientRenderInput) => {
  const gl = s.gl
  const f = input.frame
  const palette = PALETTES[input.theme]
  const intensity = input.playing ? Math.min(1, f.rms * 8 + 0.25) : 0.0
  const centroid = Math.max(0, Math.min(1, (f.spectralCentroid - 200) / 4500))
  const bass = input.playing ? f.smoothBass : 0
  const mid = input.playing ? f.smoothMid : 0
  const treble = input.playing ? f.smoothTreble : 0
  const beat = input.playing && f.beat ? f.beatStrength : 0

  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform2f(s.uRes, input.width, input.height)
  gl.uniform1f(s.uTime, input.time)
  gl.uniform1f(s.uIntensity, intensity)
  gl.uniform1f(s.uBass, bass)
  gl.uniform1f(s.uMid, mid)
  gl.uniform1f(s.uTreble, treble)
  gl.uniform1f(s.uBeat, beat)
  gl.uniform1f(s.uCentroid, centroid)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.uniform3f(s.uTertiary, palette.tertiary[0], palette.tertiary[1], palette.tertiary[2])
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.bindVertexArray(null)
}
