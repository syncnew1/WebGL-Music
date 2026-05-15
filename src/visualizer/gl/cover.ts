import { createProgram, GL } from './util'
import type { AnalysisFrame } from '../AudioAnalyzer'

export type CoverState = {
  gl: GL
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  buf: WebGLBuffer
  uRes: WebGLUniformLocation
  uTime: WebGLUniformLocation
  uBass: WebGLUniformLocation
  uMid: WebGLUniformLocation
  uTreble: WebGLUniformLocation
  uBeat: WebGLUniformLocation
  uBeatStr: WebGLUniformLocation
  uRms: WebGLUniformLocation
  uFlux: WebGLUniformLocation
  uCentroid: WebGLUniformLocation
  uPrimary: WebGLUniformLocation
  uSecondary: WebGLUniformLocation
  uTertiary: WebGLUniformLocation
}

export type CoverTheme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

export const init = (gl: GL): CoverState => {
  const vs = `#version 300 es
  layout(location=0) in vec2 aPos;
  out vec2 vUv;
  void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`

  const fs = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 o;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uBeatStr;
  uniform float uRms;
  uniform float uFlux;
  uniform float uCentroid;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uTertiary;

  // hash / noise utilities
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0 - 2.0*f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.07; a *= 0.5; }
    return s;
  }

  float ring(float r, float radius, float width){
    return smoothstep(width, 0.0, abs(r - radius));
  }

  void main(){
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uRes.x / max(uRes.y, 1.0);
    float t = uTime * 0.6;
    float r = length(uv);
    float ang = atan(uv.y, uv.x);

    // tone-driven hue mix (centroid: brightness, flux: transient richness)
    float toneMix = clamp(uCentroid * 1.2 - 0.05, 0.0, 1.0);
    vec3 hueA = mix(uPrimary, uSecondary, toneMix);
    vec3 hueB = mix(uSecondary, uTertiary, toneMix);

    // base nebula: domain-warped fbm scaled by mid+rms
    vec2 q = uv * (1.4 + uRms * 1.6);
    q += 0.6 * vec2(fbm(q + t * 0.45), fbm(q - t * 0.32));
    float neb = fbm(q + t * 0.22);
    float nebGain = 0.45 + uMid * 1.4 + uBass * 0.6;
    vec3 nebula = mix(vec3(0.02, 0.03, 0.06), hueA, neb * nebGain);

    // pulsing concentric rings driven by bass + beat
    float baseR = 0.30 + uBass * 0.10 + uBeatStr * 0.06;
    float r1 = ring(r, baseR + sin(t * 1.2) * 0.012, 0.014 + uTreble * 0.012);
    float r2 = ring(r, baseR + 0.18 + sin(t * 1.6) * 0.014, 0.012 + uTreble * 0.010);
    float r3 = ring(r, baseR + 0.36 + sin(t * 0.9) * 0.018, 0.010 + uFlux * 0.18);
    vec3 ringCol = hueA * r1 * (0.9 + uBeatStr * 1.3)
                 + hueB * r2 * (0.7 + uBass * 0.7)
                 + uTertiary * r3 * (0.5 + uTreble * 0.9);

    // angular sparkle, density follows treble + flux
    float petals = 8.0 + floor(uCentroid * 18.0);
    float spark = pow(0.5 + 0.5 * cos(ang * petals + t * 1.4), 22.0);
    spark *= smoothstep(0.18, 0.55, r) * smoothstep(0.95, 0.5, r);
    spark *= uTreble * 1.2 + uFlux * 1.6;

    // beat shockwave: a thin expanding ring on every beat
    float shock = ring(r, 0.05 + uBeatStr * 0.95, 0.02 + uBeatStr * 0.04) * uBeat * 1.6;

    // central core
    float core = smoothstep(0.32, 0.0, r) * (0.30 + uMid * 0.55 + uBass * 0.4);

    // halo
    float halo = smoothstep(1.05 + uBeatStr * 0.25, 0.0, r) * (0.18 + uBass * 0.30);

    vec3 col = nebula
             + ringCol
             + uTertiary * spark
             + uPrimary * shock
             + hueA * core
             + hueB * halo * 0.4;

    // gentle vignette so the bloom pass has something to fade against
    col *= mix(1.0, smoothstep(1.55, 0.2, r), 0.55);

    // boost output range so the bright-pass of the bloom pipeline picks up peaks
    col *= 1.0 + uBeatStr * 0.6;
    o = vec4(col, 1.0);
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
    gl,
    program,
    vao,
    buf,
    uRes: gl.getUniformLocation(program, 'uRes')!,
    uTime: gl.getUniformLocation(program, 'uTime')!,
    uBass: gl.getUniformLocation(program, 'uBass')!,
    uMid: gl.getUniformLocation(program, 'uMid')!,
    uTreble: gl.getUniformLocation(program, 'uTreble')!,
    uBeat: gl.getUniformLocation(program, 'uBeat')!,
    uBeatStr: gl.getUniformLocation(program, 'uBeatStr')!,
    uRms: gl.getUniformLocation(program, 'uRms')!,
    uFlux: gl.getUniformLocation(program, 'uFlux')!,
    uCentroid: gl.getUniformLocation(program, 'uCentroid')!,
    uPrimary: gl.getUniformLocation(program, 'uPrimary')!,
    uSecondary: gl.getUniformLocation(program, 'uSecondary')!,
    uTertiary: gl.getUniformLocation(program, 'uTertiary')!,
  }
}

export const cleanup = (s: CoverState) => {
  const gl = s.gl
  gl.deleteBuffer(s.buf)
  gl.deleteVertexArray(s.vao)
  gl.deleteProgram(s.program)
}

const PALETTES: Record<CoverTheme, { primary: number[]; secondary: number[]; tertiary: number[] }> = {
  'amber-dark': { primary: [1.00, 0.72, 0.30], secondary: [1.00, 0.48, 0.10], tertiary: [1.00, 0.92, 0.65] },
  'neon-grid':  { primary: [0.13, 0.83, 0.93], secondary: [0.66, 0.33, 0.97], tertiary: [0.95, 0.42, 0.85] },
  'deep-space': { primary: [0.49, 0.83, 0.99], secondary: [0.96, 0.45, 0.71], tertiary: [0.55, 0.50, 0.95] },
  'rainbow':    { primary: [0.19, 0.76, 0.49], secondary: [0.13, 0.83, 0.93], tertiary: [0.99, 0.78, 0.30] },
}

export type CoverRenderInput = {
  frame: AnalysisFrame
  playing: boolean
  theme: CoverTheme
  time: number
  sensitivity: number
  width: number
  height: number
}

export const render = (s: CoverState, input: CoverRenderInput) => {
  const gl = s.gl
  const f = input.frame
  const sens = input.sensitivity
  const bass = Math.min(1, f.smoothBass * sens)
  const mid = Math.min(1, f.smoothMid * sens)
  const treble = Math.min(1, f.smoothTreble * sens)
  const beatStr = input.playing ? f.beatStrength : 0
  const beat = input.playing && f.beat ? 1 : 0
  const rms = Math.min(1, f.rms * 4 * sens)
  const flux = Math.min(1, f.spectralFlux * 2.5)
  // map centroid (Hz) to ~0..1 over the typical music range
  const centroid = Math.max(0, Math.min(1, (f.spectralCentroid - 200) / 4500))
  const palette = PALETTES[input.theme]

  gl.useProgram(s.program)
  gl.bindVertexArray(s.vao)
  gl.uniform2f(s.uRes, input.width, input.height)
  gl.uniform1f(s.uTime, input.time)
  gl.uniform1f(s.uBass, bass)
  gl.uniform1f(s.uMid, mid)
  gl.uniform1f(s.uTreble, treble)
  gl.uniform1f(s.uBeat, beat)
  gl.uniform1f(s.uBeatStr, beatStr)
  gl.uniform1f(s.uRms, rms)
  gl.uniform1f(s.uFlux, flux)
  gl.uniform1f(s.uCentroid, centroid)
  gl.uniform3f(s.uPrimary, palette.primary[0], palette.primary[1], palette.primary[2])
  gl.uniform3f(s.uSecondary, palette.secondary[0], palette.secondary[1], palette.secondary[2])
  gl.uniform3f(s.uTertiary, palette.tertiary[0], palette.tertiary[1], palette.tertiary[2])
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  gl.bindVertexArray(null)
}
