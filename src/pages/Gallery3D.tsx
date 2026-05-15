import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { useData } from '../providers/DataProvider'
import { usePlayer, useProgress } from '../providers/PlayerProvider'
import { useVisualizer } from '../providers/VisualizerProvider'
import { AudioAnalyzer, AnalysisFrame } from '../visualizer/AudioAnalyzer'
import { toTrack } from '../lib/trackUtils'

type Theme = 'rainbow' | 'amber-dark' | 'neon-grid' | 'deep-space'

// 重新设计：深色虚空 + 反射地面 + 悬浮金属薄边画框 + 顶光锥
const GALLERY_PALETTES: Record<Theme, {
  bg: string
  fog: string
  floor: string
  accent: string
  accentActive: string
  light: number
}> = {
  'amber-dark': {
    bg: '#08070a', fog: '#0c090e',
    floor: '#0a0810', accent: '#ff8a3c', accentActive: '#ffd06b',
    light: 0xffd9aa,
  },
  'neon-grid': {
    bg: '#04051a', fog: '#06081f',
    floor: '#06081e', accent: '#22d3ee', accentActive: '#a855f7',
    light: 0xc4d4ff,
  },
  'deep-space': {
    bg: '#040611', fog: '#06081a',
    floor: '#050714', accent: '#7dd3fc', accentActive: '#f472b6',
    light: 0xc7d4ff,
  },
  'rainbow': {
    bg: '#050d0a', fog: '#08110d',
    floor: '#06100c', accent: '#31c27c', accentActive: '#9bebbf',
    light: 0xc3ffe2,
  },
}

// 画框边缘呼吸光（保持极薄、活动框才明显）
const FRAME_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAME_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uAccent;
  uniform vec3 uActiveColor;
  uniform float uBass;
  uniform float uBeat;
  uniform float uTime;
  uniform float uActive;
  void main(){
    float dx = min(vUv.x, 1.0 - vUv.x);
    float dy = min(vUv.y, 1.0 - vUv.y);
    float edge = min(dx, dy);
    float ring = smoothstep(0.06, 0.0, edge);
    float band = smoothstep(0.015, 0.05, edge) * ring;

    float pulse = 0.08 + uBass * 0.18 + uBeat * 0.18;
    pulse += sin(uTime * 1.6) * 0.015;

    vec3 col = mix(uAccent, uActiveColor, uActive);
    float wave = uActive * (0.10 + 0.20 * sin(vUv.y * 14.0 - uTime * 2.4));
    col *= (pulse + wave);

    float baseAlpha = mix(0.10, 0.42, uActive);
    gl_FragColor = vec4(col, band * baseAlpha);
  }
`

// 反射地面上的六边形网格 + 节拍同心波
const FLOOR_OVERLAY_VERT = `
  varying vec2 vWorldXZ;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const FLOOR_OVERLAY_FRAG = `
  precision highp float;
  varying vec2 vWorldXZ;
  uniform vec3 uAccent;
  uniform vec2 uCamXZ;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  // hex 网格距边缘的距离，用于画线
  // 参考 IQ 的 hex grid 公式
  vec4 hexCoords(vec2 uv){
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float x = atan(gv.x, gv.y);
    float y = 0.5 - max(dot(gv, normalize(vec2(1.0, 1.732))),
                        max(dot(gv, normalize(vec2(1.0, -1.732))),
                            abs(gv.x)));
    return vec4(x, y, gv.x, gv.y);
  }
  void main(){
    vec2 q = vWorldXZ - uCamXZ;
    float r = length(q);

    // 1) hex 网格线（远处淡化）
    vec2 uv = vWorldXZ * 0.32;
    vec4 hc = hexCoords(uv);
    float line = smoothstep(0.04, 0.0, hc.y) * 0.55;
    line *= smoothstep(70.0, 6.0, r);

    // 2) bass 同心波
    float ring = sin(r * 0.9 - uTime * 1.2 + uBass * 3.0);
    float ringMask = smoothstep(0.78, 1.0, ring) * smoothstep(40.0, 4.0, r);

    // 3) beat shockwave
    float shockR = 4.0 + uBeat * 22.0;
    float shock = smoothstep(0.7, 0.0, abs(r - shockR)) * uBeat;

    float alpha = (line * 0.55 + ringMask * 0.32 + shock * 0.6) * smoothstep(80.0, 4.0, r);
    gl_FragColor = vec4(uAccent, alpha);
  }
`

// 远景星点 sprite
const STAR_VERT = `
  attribute float aSize;
  attribute float aTwinkle;
  varying float vTwinkle;
  uniform float uTime;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vTwinkle = 0.6 + 0.4 * sin(uTime * (0.4 + aTwinkle * 1.4) + aTwinkle * 6.28);
  }
`
const STAR_FRAG = `
  precision highp float;
  varying float vTwinkle;
  uniform vec3 uColor;
  void main(){
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q);
    float a = smoothstep(0.5, 0.0, r) * vTwinkle;
    gl_FragColor = vec4(uColor, a * 0.7);
  }
`

// 中央广场地面：4 道指向回廊的光带 + 圆形地纹
const PLAZA_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const PLAZA_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    // 圆形边缘
    float ringEdge = smoothstep(0.96, 0.92, r) * smoothstep(0.0, 0.04, 1.0 - r);
    // 内部呼吸圆
    float innerR = 0.55 + 0.05 * sin(uTime * 1.2);
    float innerRing = smoothstep(0.012, 0.0, abs(r - innerR));

    // 4 个方向（前后左右）的指向光带
    // 把 angle 映射到 4 段
    float beam = 0.0;
    for (int i = 0; i < 4; i++) {
      float a0 = float(i) * 1.5707963;
      float da = atan(sin(ang - a0), cos(ang - a0));
      float beamLine = smoothstep(0.05, 0.0, abs(da));
      // 沿径向流动
      float flow = 0.6 + 0.4 * sin(r * 6.0 - uTime * 1.6 - float(i) * 1.4);
      beamLine *= step(0.45, r) * smoothstep(0.98, 0.55, r) * flow;
      beam += beamLine;
    }

    float pulse = 0.45 + uBass * 0.5 + uBeat * 0.6;
    float alpha = (ringEdge * 0.7 + innerRing * 0.45 + beam * 0.55) * pulse;
    gl_FragColor = vec4(uAccent, alpha);
  }
`

// NOW PLAYING 舞台环：双层圆环呼吸
const HALO_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const HALO_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    // 主环
    float ring1 = smoothstep(0.04, 0.0, abs(r - 0.78));
    float ring2 = smoothstep(0.025, 0.0, abs(r - 0.92));
    // 角度刻度
    float ticks = step(0.94, abs(sin(ang * 32.0))) * smoothstep(0.04, 0.0, abs(r - 0.85));

    float pulse = 0.55 + uBass * 0.6 + uBeat * 0.7;
    pulse += 0.10 * sin(uTime * 1.4);

    float a = (ring1 * 0.85 + ring2 * 0.55 + ticks * 0.7) * pulse;
    gl_FragColor = vec4(uAccent, a);
  }
`

// 舞台底部地面光斑：跟着 bass 扩散
const STAGE_FLOOR_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const STAGE_FLOOR_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float core = smoothstep(0.55, 0.0, r) * (0.6 + uBass * 0.8);
    float wave = sin(r * 8.0 - uTime * 1.8 + uBass * 4.0);
    float ring = smoothstep(0.65, 0.85, wave) * smoothstep(0.95, 0.0, r) * (0.4 + uBeat * 0.7);
    float a = (core + ring) * smoothstep(1.0, 0.0, r);
    gl_FragColor = vec4(uAccent, a);
  }
`

// NOW PLAYING 频谱柱：32 段，立在舞台两侧
const STAGE_BAR_VERT = `
  attribute vec3 aInst;  // (x, theta, height)
  varying float vT;
  varying float vH;
  void main(){
    float x = aInst.x;
    float theta = aInst.y;
    float h = aInst.z;
    // 沿 y 拉伸：position.y 0..1 -> 实际 0..h
    float yScaled = position.y * h * 1.4;
    vec3 local = vec3(position.x * 0.06, yScaled, position.z * 0.06);
    // 绕 y 轴旋转到 theta 方向
    float c = cos(theta);
    float s = sin(theta);
    vec3 rotated = vec3(c * local.x + s * local.z, local.y, -s * local.x + c * local.z);
    rotated.x += x * c;
    rotated.z += x * (-s);
    vT = position.y;
    vH = h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(rotated, 1.0);
  }
`
const STAGE_BAR_FRAG = `
  precision highp float;
  varying float vT;
  varying float vH;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  void main(){
    vec3 col = mix(uPrimary, uSecondary, vT);
    float gain = 0.6 + vH * 1.0;
    gl_FragColor = vec4(col * gain, 0.85);
  }
`

export default function Gallery3D() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const lockRef = useRef<null | (() => void)>(null)
  const rebuildRef = useRef<null | ((items: any[]) => void)>(null)
  const focusedSongRef = useRef<any | null>(null)

  const { songs, getCoverUrl } = useData() as any
  const { play, setQueue, current } = usePlayer() as any
  const { analyser } = useProgress()
  const { theme } = useVisualizer()

  const playRef = useRef(play)
  const setQueueRef = useRef(setQueue)
  const getCoverUrlRef = useRef(getCoverUrl)
  const analyserRef = useRef<AnalyserNode | null>(analyser)
  const themeRef = useRef<Theme>(theme)
  const currentIdRef = useRef<string | null>(current?.id ?? null)
  const songsRef = useRef<any[]>([])

  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { setQueueRef.current = setQueue }, [setQueue])
  useEffect(() => { getCoverUrlRef.current = getCoverUrl }, [getCoverUrl])
  useEffect(() => { analyserRef.current = analyser }, [analyser])
  useEffect(() => { themeRef.current = theme }, [theme])
  useEffect(() => { currentIdRef.current = current?.id ?? null }, [current?.id])

  const [tip, setTip] = useState('点击"进入漫游"，WASD 移动；准星对准画框后左键播放')
  const [focusedLabel, setFocusedLabel] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  const gallerySongs = useMemo(() => songs, [songs])

  useEffect(() => {
    const host = mountRef.current
    if (!host) return

    const palette0 = GALLERY_PALETTES[themeRef.current]

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(palette0.bg)
    scene.fog = new THREE.FogExp2(palette0.fog, 0.022)

    const camera = new THREE.PerspectiveCamera(68, host.clientWidth / host.clientHeight, 0.1, 320)
    camera.position.set(0, 1.65, 6.5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.78
    host.appendChild(renderer.domElement)

    // ── lights ──────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(palette0.light, 0.10)
    scene.add(ambient)
    const hemi = new THREE.HemisphereLight(palette0.light, 0x05060a, 0.18)
    scene.add(hemi)

    // ── reflective floor ───────────────────────────────────────────
    const floorSize = 220
    const reflector = new Reflector(
      new THREE.PlaneGeometry(floorSize, floorSize),
      {
        clipBias: 0.003,
        textureWidth: Math.min(1024, host.clientWidth),
        textureHeight: Math.min(1024, host.clientHeight),
        color: new THREE.Color(palette0.floor),
      },
    )
    reflector.rotation.x = -Math.PI / 2
    reflector.position.y = 0
    scene.add(reflector)

    // 在反射地面上方覆盖一层主色调 overlay，叠加 fbm 尘雾与 bass 同心波
    const floorOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.ShaderMaterial({
        vertexShader: FLOOR_OVERLAY_VERT,
        fragmentShader: FLOOR_OVERLAY_FRAG,
        uniforms: {
          uAccent: { value: new THREE.Color(palette0.accent) },
          uCamXZ: { value: new THREE.Vector2(0, 0) },
          uTime: { value: 0 },
          uBass: { value: 0 },
          uBeat: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    floorOverlay.rotation.x = -Math.PI / 2
    floorOverlay.position.y = 0.001
    scene.add(floorOverlay)

    // ── 远景星点 ─────────────────────────────────────────────────
    const STAR_COUNT = 800
    const starPositions = new Float32Array(STAR_COUNT * 3)
    const starSizes = new Float32Array(STAR_COUNT)
    const starTwinkle = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      // 球壳分布，远离玩家，偏上半球
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(1 - Math.random() * 1.4) // 偏上
      const radius = 80 + Math.random() * 90
      starPositions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * radius
      starPositions[i * 3 + 1] = Math.cos(phi) * radius * 0.6 + 12
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius - 60
      starSizes[i] = 0.7 + Math.random() * 1.8
      starTwinkle[i] = Math.random()
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1))
    starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(starTwinkle, 1))
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(palette0.light) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // ── 中央广场地面（圆盘 + 4 道指向光带）─────────────────────────
    const PLAZA_RADIUS = 8
    const plazaMat = new THREE.ShaderMaterial({
      vertexShader: PLAZA_VERT,
      fragmentShader: PLAZA_FRAG,
      uniforms: {
        uAccent: { value: new THREE.Color(palette0.accent) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(PLAZA_RADIUS * 2.2, PLAZA_RADIUS * 2.2), plazaMat)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.y = 0.0035
    scene.add(plaza)

    // ── NOW PLAYING 中央舞台 ──────────────────────────────────────
    const stage = new THREE.Group()
    stage.position.set(0, 0, 0)
    scene.add(stage)

    // 1) 巨型封面（4×4m，浮空 2.4m）
    const stageCoverMat = new THREE.MeshBasicMaterial({
      map: null,
      side: THREE.DoubleSide,
      toneMapped: true,
      transparent: true,
      opacity: 1.0,
    })
    const stageCover = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), stageCoverMat)
    stageCover.position.set(0, 2.6, 0)
    stage.add(stageCover)

    // 2) 双层 halo 环（始终面向相机的 billboard）
    const stageHaloMat = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: {
        uAccent: { value: new THREE.Color(palette0.accentActive) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    })
    const stageHalo = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), stageHaloMat)
    stageHalo.position.set(0, 2.6, 0)
    stage.add(stageHalo)

    // 3) 舞台底部地面光斑
    const stageFloorMat = new THREE.ShaderMaterial({
      vertexShader: STAGE_FLOOR_VERT,
      fragmentShader: STAGE_FLOOR_FRAG,
      uniforms: {
        uAccent: { value: new THREE.Color(palette0.accent) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uBeat: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    const stageFloor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), stageFloorMat)
    stageFloor.rotation.x = -Math.PI / 2
    stageFloor.position.y = 0.006
    stage.add(stageFloor)

    // 4) 舞台两侧频谱立柱（左右各 16 根）
    const STAGE_BAR_COUNT = 32
    const barInst = new Float32Array(STAGE_BAR_COUNT * 3)
    for (let i = 0; i < STAGE_BAR_COUNT; i++) {
      const half = i < 16 ? i : i - 16
      const isLeft = i < 16
      const t = half / 15
      // 在两侧弧线上：theta 0 朝向相机方向（+Z），所以左 = -PI/2, 右 = +PI/2
      const theta = (isLeft ? -1 : 1) * (Math.PI / 2) + (t - 0.5) * 0.9
      const radius = 2.5
      barInst[i * 3 + 0] = radius
      barInst[i * 3 + 1] = theta
      barInst[i * 3 + 2] = 0.05
    }
    const barGeo = new THREE.InstancedBufferGeometry()
    const barBox = new THREE.BoxGeometry(1, 1, 1)
    barGeo.index = barBox.index
    barGeo.attributes.position = barBox.attributes.position
    barGeo.attributes.normal = barBox.attributes.normal
    barGeo.attributes.uv = barBox.attributes.uv
    barGeo.setAttribute('aInst', new THREE.InstancedBufferAttribute(barInst, 3))
    barGeo.instanceCount = STAGE_BAR_COUNT
    const barMat = new THREE.ShaderMaterial({
      vertexShader: STAGE_BAR_VERT,
      fragmentShader: STAGE_BAR_FRAG,
      uniforms: {
        uPrimary: { value: new THREE.Color(palette0.accent) },
        uSecondary: { value: new THREE.Color(palette0.accentActive) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const stageBars = new THREE.Mesh(barGeo, barMat)
    stageBars.position.y = 0.05
    stage.add(stageBars)

    // 5) NOW PLAYING 铭牌
    const stageNamePlateMat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    const stageNamePlate = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.7), stageNamePlateMat)
    stageNamePlate.position.set(0, 0.65, 0)
    stage.add(stageNamePlate)

    // 6) 顶部 NOW PLAYING 标签（小）
    const stageLabelMat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    const stageLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.36), stageLabelMat)
    stageLabel.position.set(0, 5.0, 0)
    stage.add(stageLabel)

    // ── controls ───────────────────────────────────────────────────
    const controls = new PointerLockControls(camera, renderer.domElement)
    scene.add(controls.object)
    lockRef.current = () => controls.lock()

    const keys = { w: false, a: false, s: false, d: false }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.w = true
      if (e.code === 'KeyA') keys.a = true
      if (e.code === 'KeyS') keys.s = true
      if (e.code === 'KeyD') keys.d = true
      if (e.code === 'Enter' && controls.isLocked && focusedSongRef.current) {
        setQueueRef.current(songsRef.current.map((s: any) => toTrack(s)))
        playRef.current(focusedSongRef.current)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keys.w = false
      if (e.code === 'KeyA') keys.a = false
      if (e.code === 'KeyS') keys.s = false
      if (e.code === 'KeyD') keys.d = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    controls.addEventListener('lock', () => {
      setIsLocked(true)
      setTip('漫游中：WASD 移动，鼠标转向；左键播放，ESC 退出')
    })
    controls.addEventListener('unlock', () => {
      setIsLocked(false)
      setTip('已退出漫游，点击"进入漫游"继续')
    })

    // ── frames ─────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const centerNDC = new THREE.Vector2(0, 0)
    const textureLoader = new THREE.TextureLoader()
    textureLoader.setCrossOrigin('anonymous')

    const frameRoot = new THREE.Group()
    scene.add(frameRoot)

    const hitMeshes: THREE.Mesh[] = []
    const disposableTextures: THREE.Texture[] = []
    const frameShaders: THREE.ShaderMaterial[] = []
    const spotLights: THREE.SpotLight[] = []

    const makeFallbackTexture = (title: string, artist?: string) => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 512
      const ctx = c.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, 512, 512)
      g.addColorStop(0, '#1a1d2c')
      g.addColorStop(1, '#0a0b14')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 512)
      ctx.fillStyle = 'rgba(232,234,240,0.9)'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText((title || '未知曲目').slice(0, 12), 24, 250)
      if (artist) {
        ctx.fillStyle = 'rgba(232,234,240,0.55)'
        ctx.font = '24px sans-serif'
        ctx.fillText(artist.slice(0, 16), 24, 294)
      }
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      disposableTextures.push(tex)
      return tex
    }

    // 标题铭牌：用 canvas 画文字 + 一道下划线
    const makePlateTexture = (title: string, artist?: string) => {
      const c = document.createElement('canvas')
      c.width = 1024
      c.height = 256
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(235,238,250,0.92)'
      ctx.font = '600 64px Poppins, sans-serif'
      ctx.fillText((title || '未知曲目').slice(0, 24), c.width / 2, 100)
      ctx.fillStyle = 'rgba(180,196,224,0.62)'
      ctx.font = '34px Poppins, sans-serif'
      ctx.fillText((artist || '').slice(0, 32), c.width / 2, 168)
      // 下划线
      ctx.fillStyle = 'rgba(255,255,255,0.20)'
      ctx.fillRect(c.width / 2 - 130, 210, 260, 1.6)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      disposableTextures.push(tex)
      return tex
    }

    // NOW PLAYING 大铭牌（带主色调下划线）
    const makeStagePlateTexture = (title: string, artist: string, accentHex: string) => {
      const c = document.createElement('canvas')
      c.width = 1536
      c.height = 256
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(244,247,255,0.95)'
      ctx.font = '700 80px Poppins, sans-serif'
      ctx.fillText((title || '未在播放').slice(0, 22), c.width / 2, 92)
      ctx.fillStyle = 'rgba(190,206,236,0.66)'
      ctx.font = '40px Poppins, sans-serif'
      ctx.fillText((artist || '').slice(0, 30), c.width / 2, 172)
      // 渐变下划线
      const grad = ctx.createLinearGradient(c.width / 2 - 220, 0, c.width / 2 + 220, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, accentHex)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(c.width / 2 - 220, 220, 440, 2.5)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      return tex
    }

    // NOW PLAYING 小标签（顶部）
    const makeStageLabelTexture = (accentHex: string) => {
      const c = document.createElement('canvas')
      c.width = 1024
      c.height = 160
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = accentHex
      ctx.font = '700 60px Righteous, Poppins, sans-serif'
      const text = 'NOW   PLAYING'
      ctx.fillText(text, c.width / 2, c.height / 2)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      return tex
    }

    // 初始化舞台铭牌
    const stageNamePlateTextures: THREE.Texture[] = []
    const refreshStagePlate = (title: string, artist: string) => {
      const accentHex = GALLERY_PALETTES[themeRef.current].accentActive
      const old = (stageNamePlateMat.map as THREE.Texture | null)
      stageNamePlateMat.map = makeStagePlateTexture(title, artist, accentHex)
      stageNamePlateMat.needsUpdate = true
      if (old) { old.dispose() }
      stageNamePlateTextures.push(stageNamePlateMat.map as THREE.Texture)
      const oldLabel = (stageLabelMat.map as THREE.Texture | null)
      stageLabelMat.map = makeStageLabelTexture(accentHex)
      stageLabelMat.needsUpdate = true
      if (oldLabel) oldLabel.dispose()
      stageNamePlateTextures.push(stageLabelMat.map as THREE.Texture)
    }
    refreshStagePlate('未在播放', '请走向任意回廊选择曲目')

    const clearFrames = () => {
      hitMeshes.length = 0
      frameShaders.length = 0
      // remove spot lights from scene
      for (const sl of spotLights) {
        scene.remove(sl)
        scene.remove(sl.target)
      }
      spotLights.length = 0
      while (frameRoot.children.length > 0) {
        const obj = frameRoot.children.pop()!
        const g = (obj as any).geometry
        const m = (obj as any).material
        if (Array.isArray(m)) m.forEach((x: any) => x?.dispose?.())
        else m?.dispose?.()
        g?.dispose?.()
      }
      for (const t of disposableTextures.splice(0)) t.dispose()
    }

    const coverUrlWithTimeout = async (song: any, timeoutMs = 3200): Promise<string> => {
      if (song.cover_url) return song.cover_url
      if (!song.cover_storage_path) return ''
      try {
        const p = getCoverUrlRef.current(song.cover_storage_path)
        const t = new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs))
        return (await Promise.race([p, t])) || ''
      } catch {
        return ''
      }
    }

    rebuildRef.current = (items: any[]) => {
      clearFrames()
      const palette = GALLERY_PALETTES[themeRef.current]
      const accent = new THREE.Color(palette.accent)
      const accentActive = new THREE.Color(palette.accentActive)

      // ── 十字四回廊布局 ─────────────────────────────────────────
      // 4 条回廊（北/东/南/西），每条回廊两侧悬挂画框
      // 回廊参数
      const CORRIDOR_HALF_WIDTH = 5.6  // 画框中心距走廊中线
      const CORRIDOR_START = 11        // 距广场中心多远开始第一幅
      const SPACING = 4.6              // 同侧相邻画框纵深间距
      const FRAME_Y = 1.85
      // 每条回廊容纳的画框对数（左+右）
      const PAIRS_PER_CORRIDOR = 9     // 每条回廊 18 幅，4 条共 72 幅
      const list = items.slice(0, 4 * PAIRS_PER_CORRIDOR * 2)

      // 4 个方向：+Z 北、+X 东、-Z 南、-X 西
      // 对每个方向，沿正向远离中心摆放
      const DIRS: { dir: THREE.Vector3; rotY: number; name: string }[] = [
        { dir: new THREE.Vector3(0, 0, -1), rotY: 0, name: '北' },
        { dir: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2, name: '东' },
        { dir: new THREE.Vector3(0, 0, 1), rotY: Math.PI, name: '南' },
        { dir: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2, name: '西' },
      ]

      const placeFrame = (song: any, frameX: number, frameY: number, frameZ: number, faceRotY: number, normal: THREE.Vector3) => {
        // border: 极薄金属
        const borderMat = new THREE.MeshStandardMaterial({
          color: 0x12131a,
          emissive: accent.clone(),
          emissiveIntensity: 0.04,
          roughness: 0.32,
          metalness: 0.78,
        })
        const border = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 0.04), borderMat)
        border.position.set(frameX, frameY, frameZ)
        border.rotation.y = faceRotY
        ;(border as any).userData.songId = song.id
        ;(border as any).userData.borderMat = borderMat
        frameRoot.add(border)

        // 封面：贴在边框正面（沿法线 +0.025）
        const coverPos = new THREE.Vector3(frameX, frameY, frameZ).add(normal.clone().multiplyScalar(0.025))
        const coverMat = new THREE.MeshBasicMaterial({
          map: makeFallbackTexture(song.title, song.artist),
          side: THREE.DoubleSide,
          toneMapped: true,
        })
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 2.34), coverMat)
        cover.position.copy(coverPos)
        cover.rotation.y = faceRotY
        frameRoot.add(cover)

        // 边缘呼吸光
        const glowMat = new THREE.ShaderMaterial({
          vertexShader: FRAME_VERT,
          fragmentShader: FRAME_FRAG,
          uniforms: {
            uAccent: { value: accent.clone() },
            uActiveColor: { value: accentActive.clone() },
            uBass: { value: 0 },
            uBeat: { value: 0 },
            uTime: { value: 0 },
            uActive: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
        ;(glowMat as any).userData.songId = song.id
        const glowPos = new THREE.Vector3(frameX, frameY, frameZ).add(normal.clone().multiplyScalar(0.027))
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), glowMat)
        glow.position.copy(glowPos)
        glow.rotation.y = faceRotY
        frameRoot.add(glow)
        frameShaders.push(glowMat)

        // 标题铭牌
        const plateMat = new THREE.MeshBasicMaterial({
          map: makePlateTexture(song.title, song.artist),
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        })
        const platePos = coverPos.clone(); platePos.y = frameY - 1.62
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.50), plateMat)
        plate.position.copy(platePos)
        plate.rotation.y = faceRotY
        frameRoot.add(plate)

        // SpotLight：从画框前上方向画框打光
        const spotPos = new THREE.Vector3(frameX, frameY + 2.0, frameZ).add(normal.clone().multiplyScalar(0.55))
        const spot = new THREE.SpotLight(palette.light, 0.85, 9, Math.PI / 6, 0.5, 1.4)
        spot.position.copy(spotPos)
        spot.target.position.set(frameX, frameY, frameZ)
        scene.add(spot, spot.target)
        spotLights.push(spot)
        ;(spot as any).userData.songId = song.id

        // 命中盒
        const hitPos = new THREE.Vector3(frameX, frameY, frameZ).add(normal.clone().multiplyScalar(0.04))
        const hit = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 2.6),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
        )
        hit.position.copy(hitPos)
        hit.rotation.y = faceRotY
        hit.userData.song = toTrack(song)
        hit.userData.songId = song.id
        frameRoot.add(hit)
        hitMeshes.push(hit)

        void (async () => {
          const url = await coverUrlWithTimeout(song)
          if (!url) return
          textureLoader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace
            disposableTextures.push(tex)
            coverMat.map = tex
            coverMat.needsUpdate = true
          })
        })()
      }

      // 把 list 切成 4 段，每段铺一条回廊
      let idx = 0
      for (let d = 0; d < DIRS.length; d++) {
        const { dir } = DIRS[d]
        // 回廊方向单位向量 fwd（指向远处），left/right 是垂直方向
        const fwd = dir.clone()
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x) // 右手坐标，绕 +Y 旋转 90°
        for (let pair = 0; pair < PAIRS_PER_CORRIDOR; pair++) {
          const along = CORRIDOR_START + pair * SPACING
          // 左侧画框
          if (idx < list.length) {
            const songL = list[idx++]
            const baseL = fwd.clone().multiplyScalar(along).add(right.clone().multiplyScalar(-CORRIDOR_HALF_WIDTH))
            // 左侧画框法线指向走廊中心：+right 方向
            const normalL = right.clone()
            // 面朝向：法线方向决定 rotY
            const rotL = Math.atan2(normalL.x, normalL.z)
            placeFrame(songL, baseL.x, FRAME_Y, baseL.z, rotL, normalL)
          }
          // 右侧画框
          if (idx < list.length) {
            const songR = list[idx++]
            const baseR = fwd.clone().multiplyScalar(along).add(right.clone().multiplyScalar(CORRIDOR_HALF_WIDTH))
            // 右侧画框法线指向走廊中心：-right 方向
            const normalR = right.clone().multiplyScalar(-1)
            const rotR = Math.atan2(normalR.x, normalR.z)
            placeFrame(songR, baseR.x, FRAME_Y, baseR.z, rotR, normalR)
          }
        }
      }

      focusedSongRef.current = null
      setFocusedLabel('')
      setTip(hitMeshes.length > 0 ? '画框就绪：进入漫游后准星对准封面左键播放' : '暂无歌曲可展示')
    }


    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !controls.isLocked) return
      const s = focusedSongRef.current
      if (!s) return
      setQueueRef.current(songsRef.current.map((x: any) => toTrack(x)))
      playRef.current(s)
      setTip(`正在播放：${s.title}${s.artist ? ` - ${s.artist}` : ''}`)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    // ── post-processing ────────────────────────────────────────────
    const composer = new EffectComposer(renderer)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    composer.setSize(host.clientWidth, host.clientHeight)
    composer.addPass(new RenderPass(scene, camera))
    const bloomBase = 0.20
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(host.clientWidth, host.clientHeight),
      bloomBase, 0.55, 0.78,
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    let analyzer: AudioAnalyzer | null = null
    let lastAnalyserId: AnalyserNode | null = null
    const ensureAnalyzer = () => {
      const an = analyserRef.current
      if (an !== lastAnalyserId) {
        lastAnalyserId = an
        analyzer = an ? new AudioAnalyzer(an) : null
      }
      return analyzer
    }
    const EMPTY_FRAME: AnalysisFrame = {
      bands: [], instruments: [], harmony: [],
      rms: 0, lufs: -60, spectralCentroid: 0, spectralFlux: 0,
      beat: false, beatStrength: 0,
      smoothBass: 0, smoothMid: 0, smoothTreble: 0,
    }

    let activeTheme: Theme = themeRef.current
    const applyTheme = (next: Theme) => {
      const p = GALLERY_PALETTES[next]
      ;(scene.background as THREE.Color).set(p.bg)
      ;(scene.fog as THREE.FogExp2).color.set(p.fog)
      ambient.color.set(p.light)
      hemi.color.set(p.light)
      ;((reflector as any).getRenderTarget?.() ? null : null)
      // Reflector 的 color 通过 uniform tDiffuse 调，简化处理：直接重设 background tint
      ;(floorOverlay.material as THREE.ShaderMaterial).uniforms.uAccent.value.set(p.accent)
      const accent = new THREE.Color(p.accent)
      const accentActive = new THREE.Color(p.accentActive)
      for (const sm of frameShaders) {
        ;(sm.uniforms.uAccent.value as THREE.Color).copy(accent)
        ;(sm.uniforms.uActiveColor.value as THREE.Color).copy(accentActive)
      }
      for (const sl of spotLights) sl.color.set(p.light)
      ;(starMat.uniforms.uColor.value as THREE.Color).set(p.light)
      for (const obj of frameRoot.children) {
        const ud = (obj as any).userData
        if (ud?.borderMat) (ud.borderMat as THREE.MeshStandardMaterial).emissive.copy(accent)
      }
      activeTheme = next
    }

    let lastLabel = ''
    let lastActiveId: string | null = null
    const clock = new THREE.Clock()
    let elapsed = 0
    let raf = 0

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed += dt

      if (themeRef.current !== activeTheme) applyTheme(themeRef.current)

      const an = ensureAnalyzer()
      const frame: AnalysisFrame = an ? an.analyze() : EMPTY_FRAME

      if (controls.isLocked) {
        const speed = 4.4
        const forward = Number(keys.w) - Number(keys.s)
        const right = Number(keys.d) - Number(keys.a)
        if (forward !== 0) controls.moveForward(forward * speed * dt)
        if (right !== 0) controls.moveRight(right * speed * dt)

        // 圆形漫游边界（半径 60m），高度固定
        const MAX_R = 60
        const dx = camera.position.x
        const dz = camera.position.z
        const r2 = dx * dx + dz * dz
        if (r2 > MAX_R * MAX_R) {
          const r = Math.sqrt(r2)
          camera.position.x = (dx / r) * MAX_R
          camera.position.z = (dz / r) * MAX_R
        }
        camera.position.y = 1.65

        raycaster.setFromCamera(centerNDC, camera)
        const hits = raycaster.intersectObjects(hitMeshes, false)
        const s = (hits[0]?.object as any)?.userData?.song || null
        focusedSongRef.current = s

        const label = s ? `${s.title}${s.artist ? ` - ${s.artist}` : ''}` : ''
        if (label !== lastLabel) {
          lastLabel = label
          setFocusedLabel(label)
        }
      }

      // 音频驱动
      const beat = frame.beat ? frame.beatStrength : 0
      const bass = frame.smoothBass
      const mid = frame.smoothMid
      const trebleBoost = frame.smoothTreble

      ;(floorOverlay.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed
      ;(floorOverlay.material as THREE.ShaderMaterial).uniforms.uBass.value = bass
      ;(floorOverlay.material as THREE.ShaderMaterial).uniforms.uBeat.value = beat
      ;((floorOverlay.material as THREE.ShaderMaterial).uniforms.uCamXZ.value as THREE.Vector2).set(camera.position.x, camera.position.z)

      ;(starMat.uniforms.uTime.value as number) = elapsed

      ambient.intensity = 0.10 + mid * 0.10
      hemi.intensity = 0.18 + bass * 0.08

      // 聚光灯小幅呼吸
      const baseSpot = 0.85
      const spotI = baseSpot + bass * 0.30 + beat * 0.40
      for (const sl of spotLights) sl.intensity = spotI

      bloom.strength = bloomBase + bass * 0.10 + beat * 0.18 + trebleBoost * 0.05

      const activeId = currentIdRef.current
      if (activeId !== lastActiveId) {
        for (const obj of frameRoot.children) {
          const ud = (obj as any).userData
          if (ud?.borderMat && ud.songId !== undefined) {
            (ud.borderMat as THREE.MeshStandardMaterial).emissiveIntensity = (ud.songId === activeId) ? 0.18 : 0.04
          }
        }
        lastActiveId = activeId
      }
      for (const sm of frameShaders) {
        const isActive = (sm as any).userData.songId === activeId ? 1 : 0
        sm.uniforms.uTime.value = elapsed
        sm.uniforms.uBass.value = bass
        sm.uniforms.uBeat.value = beat
        sm.uniforms.uActive.value = isActive
      }

      composer.render()
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight)
      composer.setSize(host.clientWidth, host.clientHeight)
      bloom.setSize(host.clientWidth, host.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      lockRef.current = null
      rebuildRef.current = null
      focusedSongRef.current = null

      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)

      clearFrames()
      starGeo.dispose()
      starMat.dispose()
      reflector.dispose()
      ;(floorOverlay.material as THREE.Material).dispose()
      composer.dispose()
      bloom.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    songsRef.current = gallerySongs
    rebuildRef.current?.(gallerySongs)
  }, [gallerySongs])

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 200px)', minHeight: 540 }}>
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#040508',
        boxShadow: 'var(--shadow)',
      }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* 边缘渐隐遮罩，让 HUD 在画面边角更清晰 */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(circle at 50% 55%, rgba(0,0,0,0) 38%, rgba(2,4,10,0.55) 100%)' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(180deg, rgba(2,4,10,0.55) 0%, transparent 18%, transparent 78%, rgba(2,4,10,0.55) 100%)' }} />

        {/* 顶部 HUD：标题 + 状态 */}
        <div style={{
          position: 'absolute', left: 18, top: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(14,19,34,0.72)',
            border: '1px solid var(--border-2)',
            backdropFilter: 'blur(10px)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 21V8l9-5 9 5v13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" style={{ color: 'var(--accent-bright)' }} />
              <path d="M9 21v-9h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" style={{ color: 'var(--accent-bright)' }} />
            </svg>
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent-bright)', fontWeight: 700 }}>IMMERSIVE GALLERY</div>
            <div style={{ fontFamily: 'Righteous, sans-serif', fontSize: 19, color: 'var(--text)', letterSpacing: '0.04em' }}>漫游画廊</div>
          </div>
          <div style={{
            marginLeft: 10,
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border)',
            background: 'rgba(14,19,34,0.72)',
            color: 'var(--text-sub)',
            fontSize: 11,
            letterSpacing: '0.06em',
            backdropFilter: 'blur(10px)',
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: isLocked ? 'var(--accent-bright)' : 'var(--text-muted)',
              boxShadow: isLocked ? '0 0 6px var(--accent)' : 'none',
              marginRight: 6, verticalAlign: 'middle',
            }} />
            {isLocked ? 'LOCKED' : 'FREE LOOK'} · {themeRef.current.toUpperCase()} · {gallerySongs.length} 件
          </div>
        </div>

        {/* 右上：进入漫游 / 操作提示 */}
        <div style={{
          position: 'absolute', right: 18, top: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border)',
            background: 'rgba(14,19,34,0.72)',
            color: 'var(--text-sub)',
            fontSize: 11,
            backdropFilter: 'blur(10px)',
            pointerEvents: 'none',
          }}>
            WASD · 鼠标 · 左键播放 · ESC 退出
          </div>
          <button
            onClick={() => lockRef.current?.()}
            className="cursor-pointer"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(49,194,124,0.45)',
              background: 'linear-gradient(135deg, rgba(49,194,124,0.18) 0%, rgba(49,194,124,0.10) 100%)',
              color: 'var(--accent-bright)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              backdropFilter: 'blur(10px)',
              transition: 'background 200ms ease, border-color 200ms ease',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(49,194,124,0.28) 0%, rgba(49,194,124,0.16) 100%)') }}
            onMouseLeave={e => { (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(49,194,124,0.18) 0%, rgba(49,194,124,0.10) 100%)') }}
          >
            进入漫游
          </button>
        </div>

        {/* 中央准星 */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', border: '1.5px solid rgba(232,234,240,0.78)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, marginLeft: -2, marginTop: -2, borderRadius: '50%', background: 'var(--accent-bright)', boxShadow: '0 0 6px var(--accent)', pointerEvents: 'none' }} />

        {/* 焦点信息卡 */}
        {focusedLabel && (
          <div style={{
            position: 'absolute',
            left: 'calc(50% + 22px)',
            top: 'calc(50% - 10px)',
            transform: 'translateY(-50%)',
            maxWidth: 340,
            padding: '7px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-2)',
            background: 'rgba(14,19,34,0.84)',
            color: 'var(--text)',
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            backdropFilter: 'blur(12px)',
            boxShadow: 'var(--shadow)',
          }}>
            ♪ {focusedLabel}
          </div>
        )}

        {/* 底部 tip */}
        <div style={{
          position: 'absolute', left: 18, bottom: 16,
          padding: '7px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.72)',
          color: 'var(--text-sub)',
          fontSize: 12,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
          maxWidth: 'calc(100% - 36px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {tip}
        </div>
      </div>
    </div>
  )
}
