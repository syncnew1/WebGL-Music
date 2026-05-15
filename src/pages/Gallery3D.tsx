import React, { useEffect, useMemo, useRef, useState } from 'react'
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
    floor: '#06100c', accent: '#31c27c', accentActive: '#fcc74d',
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

// 体积光锥：从画框上方斜向下罩住封面
const CONE_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const CONE_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  void main(){
    // uv.y 0=顶 1=底；中心列 uv.x=0.5
    float fade = smoothstep(1.0, 0.0, vUv.y);
    float center = 1.0 - abs(vUv.x - 0.5) * 2.0;
    center = smoothstep(0.0, 1.0, center);
    float dust = 0.85 + 0.15 * sin(vUv.y * 22.0 - uTime * 0.6);
    float a = fade * pow(center, 1.6) * dust * uIntensity * 0.32;
    gl_FragColor = vec4(uColor, a);
  }
`

// 反射地面在 Reflector 上叠加的 fbm "尘雾" + bass 同心波（着色叠层）
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
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  void main(){
    vec2 q = vWorldXZ - uCamXZ;
    float r = length(q);
    float ring = sin(r * 1.2 - uTime * 1.4 + uBass * 3.0);
    float ringMask = smoothstep(0.7, 1.0, ring) * smoothstep(34.0, 4.0, r);
    float shockR = 4.0 + uBeat * 18.0;
    float shock = smoothstep(0.6, 0.0, abs(r - shockR)) * uBeat;
    float dust = vnoise(vWorldXZ * 0.3 + vec2(0.0, uTime * 0.05)) * 0.06;
    float alpha = (ringMask * 0.30 + shock * 0.55 + dust) * smoothstep(60.0, 4.0, r);
    gl_FragColor = vec4(uAccent, alpha);
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
    camera.position.set(0, 1.65, 8)

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
    const coneShaders: THREE.ShaderMaterial[] = []
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

    const clearFrames = () => {
      hitMeshes.length = 0
      frameShaders.length = 0
      coneShaders.length = 0
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

      const spacing = 4.6
      const startZ = 0
      const list = items.slice(0, 70)

      for (let i = 0; i < list.length; i += 1) {
        const song = list[i]
        const isLeft = i % 2 === 0
        const frameX = isLeft ? -5.6 : 5.6
        const frameY = 1.85
        const frameZ = startZ - i * spacing
        const rotY = isLeft ? -Math.PI / 2 : Math.PI / 2
        const facing = isLeft ? 1 : -1   // 法线方向

        // 极薄金属边框（厚度只有 4cm）
        const borderMat = new THREE.MeshStandardMaterial({
          color: 0x12131a,
          emissive: accent.clone(),
          emissiveIntensity: 0.04,
          roughness: 0.32,
          metalness: 0.78,
        })
        const border = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 0.04), borderMat)
        border.position.set(frameX, frameY, frameZ)
        border.rotation.y = rotY
        ;(border as any).userData.songId = song.id
        ;(border as any).userData.borderMat = borderMat
        frameRoot.add(border)

        // 封面（贴在边框正面，比边框小一圈）
        const coverMat = new THREE.MeshBasicMaterial({
          map: makeFallbackTexture(song.title, song.artist),
          side: THREE.FrontSide,
          toneMapped: true,
        })
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(2.34, 2.34), coverMat)
        cover.position.set(frameX + facing * 0.025, frameY, frameZ)
        cover.rotation.y = rotY
        frameRoot.add(cover)

        // 边缘呼吸光（贴在封面前一层）
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
          side: THREE.FrontSide,
        })
        ;(glowMat as any).userData.songId = song.id
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), glowMat)
        glow.position.set(frameX + facing * 0.027, frameY, frameZ)
        glow.rotation.y = rotY
        frameRoot.add(glow)
        frameShaders.push(glowMat)

        // 标题铭牌：放在画框正下方
        const plateMat = new THREE.MeshBasicMaterial({
          map: makePlateTexture(song.title, song.artist),
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        })
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.50), plateMat)
        plate.position.set(frameX + facing * 0.025, frameY - 1.62, frameZ)
        plate.rotation.y = rotY
        frameRoot.add(plate)

        // 体积光锥（在画框外侧上方斜向下）
        const cone = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 4.2),
          new THREE.ShaderMaterial({
            vertexShader: CONE_VERT,
            fragmentShader: CONE_FRAG,
            uniforms: {
              uColor: { value: accent.clone() },
              uIntensity: { value: 1.0 },
              uTime: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
          }),
        )
        // 锥从画框上方 1.8m，往内侧倾斜 18°
        cone.position.set(frameX + facing * 0.55, frameY + 1.55, frameZ)
        cone.rotation.y = rotY
        cone.rotation.x = -0.30 * facing
        cone.scale.set(1, 1, 1)
        // 让锥的顶点对齐画框上方：用底心为基准向下伸展，所以位移再下移 1.6
        cone.position.y -= 0.5
        frameRoot.add(cone)
        coneShaders.push(cone.material as THREE.ShaderMaterial)
        ;(cone as any).userData.songId = song.id
        ;(cone as any).userData.coneMat = cone.material

        // SpotLight 真实打光（帮助封面 emissive 与反射地面）
        const spot = new THREE.SpotLight(palette.light, 0.85, 9, Math.PI / 6, 0.5, 1.4)
        spot.position.set(frameX + facing * 0.55, frameY + 2.0, frameZ)
        spot.target.position.set(frameX, frameY, frameZ)
        scene.add(spot, spot.target)
        spotLights.push(spot)
        ;(spot as any).userData.songId = song.id

        // 命中盒
        const hit = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 2.6),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
        )
        hit.position.set(frameX + facing * 0.04, frameY, frameZ)
        hit.rotation.y = rotY
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
      for (const cm of coneShaders) {
        ;(cm.uniforms.uColor.value as THREE.Color).copy(accent)
      }
      for (const sl of spotLights) sl.color.set(p.light)
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

        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -3.6, 3.6)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -150, 12)
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
      for (const cm of coneShaders) {
        cm.uniforms.uTime.value = elapsed
        cm.uniforms.uIntensity.value = 0.7 + bass * 0.4 + beat * 0.5
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
    <div className="grid gap-4">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-heading">
            <div className="page-kicker">IMMERSIVE GALLERY</div>
            <h2 className="page-title">漫游画廊</h2>
            <p className="page-subtitle">悬浮在虚空中的封面、镜面地面、顶光锥与音频呼应。WASD 移动，鼠标转向，准星对准任意封面左键播放。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn btn-primary" onClick={() => lockRef.current?.()}>进入漫游</button>
            <div className="status-chip">{tip}</div>
            <div className="status-chip">展厅藏品：{gallerySongs.length}</div>
          </div>
        </div>
      </section>

      <div style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 290px)',
        minHeight: 460,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#06070a',
        boxShadow: 'var(--shadow)',
      }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 42%, rgba(2,4,10,0.55) 100%)' }} />

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: '50%', border: '1.5px solid rgba(232,234,240,0.85)', boxShadow: '0 0 10px rgba(49,194,124,0.35)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, marginLeft: -2, marginTop: -2, borderRadius: '50%', background: 'var(--accent-bright)', pointerEvents: 'none' }} />

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
            background: 'rgba(14,19,34,0.88)',
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

        <div style={{
          position: 'absolute', left: 14, bottom: 12,
          padding: '6px 10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.78)',
          color: 'var(--text-sub)',
          fontSize: 12,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
        }}>
          WASD 移动 · 鼠标转向 · 左键播放 · Enter 快捷播放
        </div>

        <div style={{
          position: 'absolute', right: 14, top: 12,
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border)',
          background: 'rgba(14,19,34,0.78)',
          color: 'var(--text-sub)',
          fontSize: 11,
          letterSpacing: '0.08em',
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
        }}>
          IMMERSIVE HALL · {themeRef.current.toUpperCase()}
          <span style={{ marginLeft: 8, color: isLocked ? 'var(--accent-bright)' : 'var(--text-muted)' }}>
            {isLocked ? '• LOCKED' : '• FREE LOOK'}
          </span>
        </div>
      </div>
    </div>
  )
}
