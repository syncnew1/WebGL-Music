import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { useData } from '../providers/DataProvider'
import { usePlayer } from '../providers/PlayerProvider'
import { toTrack } from '../lib/trackUtils'

export default function Gallery3D() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const lockRef = useRef<null | (() => void)>(null)
  const rebuildRef = useRef<null | ((items: any[]) => void)>(null)
  const focusedSongRef = useRef<any | null>(null)

  const { songs, getCoverUrl } = useData() as any
  const { play, setQueue } = usePlayer() as any

  const playRef = useRef(play)
  const setQueueRef = useRef(setQueue)
  const getCoverUrlRef = useRef(getCoverUrl)
  const songsRef = useRef<any[]>([])

  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { setQueueRef.current = setQueue }, [setQueue])
  useEffect(() => { getCoverUrlRef.current = getCoverUrl }, [getCoverUrl])

  const [tip, setTip] = useState('点击“进入漫游”，WASD 移动；准星对准画框后左键播放')
  const [focusedLabel, setFocusedLabel] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  const gallerySongs = useMemo(() => songs, [songs])

  useEffect(() => {
    const host = mountRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#2a211b')
    scene.fog = new THREE.Fog('#2a211b', 26, 185)

    const camera = new THREE.PerspectiveCamera(70, host.clientWidth / host.clientHeight, 0.1, 260)
    camera.position.set(0, 1.72, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.28
    host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.68))
    scene.add(new THREE.HemisphereLight(0xffefd8, 0x3b2a20, 1.08))
    const dir = new THREE.DirectionalLight(0xfff2de, 0.9)
    dir.position.set(6, 9, 4)
    scene.add(dir)

    const corridorLength = 150
    const corridorHalfWidth = 6

    const mkPlane = (w: number, h: number, color: string) =>
      new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }))

    const floor = mkPlane(corridorHalfWidth * 2, corridorLength, '#5a4638')
    floor.rotation.x = -Math.PI / 2
    floor.position.z = -corridorLength / 2 + 8
    scene.add(floor)

    const ceiling = mkPlane(corridorHalfWidth * 2, corridorLength, '#6f5946')
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(0, 4, -corridorLength / 2 + 8)
    scene.add(ceiling)

    const leftWall = mkPlane(corridorLength, 4, '#8a7159')
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.set(-corridorHalfWidth, 2, -corridorLength / 2 + 8)
    scene.add(leftWall)

    const rightWall = mkPlane(corridorLength, 4, '#8a7159')
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.set(corridorHalfWidth, 2, -corridorLength / 2 + 8)
    scene.add(rightWall)

    // 顶部轨道灯：增强“真实画廊”氛围
    for (let z = 6; z > -136; z -= 10) {
      const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 10)
      const railMat = new THREE.MeshStandardMaterial({ color: '#d8c0a1', emissive: '#2a1e16', roughness: 0.35, metalness: 0.82 })
      const railL = new THREE.Mesh(railGeo, railMat)
      railL.position.set(-4.9, 3.35, z)
      railL.rotation.z = Math.PI / 2
      const railR = railL.clone()
      railR.position.x = 4.9
      scene.add(railL, railR)

      const spotL = new THREE.SpotLight(0xffe1bd, 1.1, 20, Math.PI / 6, 0.48, 1)
      spotL.position.set(-4.9, 3.3, z)
      spotL.target.position.set(-5.9, 1.9, z)
      const spotR = new THREE.SpotLight(0xffe1bd, 1.1, 20, Math.PI / 6, 0.48, 1)
      spotR.position.set(4.9, 3.3, z)
      spotR.target.position.set(5.9, 1.9, z)
      scene.add(spotL, spotL.target, spotR, spotR.target)
    }

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
      setTip('漫游中：WASD 移动，鼠标转向；左键点击画框播放，ESC 退出')
    })
    controls.addEventListener('unlock', () => {
      setIsLocked(false)
      setTip('已退出漫游，点击“进入漫游”继续')
    })

    const raycaster = new THREE.Raycaster()
    const centerNDC = new THREE.Vector2(0, 0)
    const textureLoader = new THREE.TextureLoader()
    textureLoader.setCrossOrigin('anonymous')

    const frameRoot = new THREE.Group()
    scene.add(frameRoot)

    const hitMeshes: THREE.Mesh[] = []
    const disposableTextures: THREE.Texture[] = []

    const makeFallbackTexture = (title: string, artist?: string) => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 512
      const ctx = c.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, 512, 512)
      g.addColorStop(0, '#35537a')
      g.addColorStop(1, '#121d2c')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 512)
      ctx.fillStyle = '#e8f0ff'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText((title || '未知曲目').slice(0, 12), 24, 250)
      if (artist) {
        ctx.fillStyle = 'rgba(232,240,255,0.86)'
        ctx.font = '24px sans-serif'
        ctx.fillText(artist.slice(0, 16), 24, 294)
      }
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      disposableTextures.push(tex)
      return tex
    }

    const clearFrames = () => {
      hitMeshes.length = 0
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
      const spacing = 4.2
      const startZ = 1
      const list = items.slice(0, 70)

      for (let i = 0; i < list.length; i += 1) {
        const song = list[i]
        const isLeft = i % 2 === 0
        const frameX = isLeft ? -5.82 : 5.82
        const frameY = 1.82
        const frameZ = startZ - i * spacing
        const rotY = isLeft ? -Math.PI / 2 : Math.PI / 2

        const border = new THREE.Mesh(
          new THREE.BoxGeometry(2.66, 2.66, 0.14),
          new THREE.MeshStandardMaterial({ color: '#4a3a2f', roughness: 0.58, metalness: 0.2 })
        )
        border.position.set(frameX, frameY, frameZ)
        border.rotation.y = rotY
        frameRoot.add(border)

        const coverMat = new THREE.MeshBasicMaterial({ map: makeFallbackTexture(song.title, song.artist), side: THREE.DoubleSide })
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), coverMat)
        cover.position.set(isLeft ? frameX + 0.22 : frameX - 0.22, frameY, frameZ)
        cover.rotation.y = rotY
        frameRoot.add(cover)

        const hit = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 2.7),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
        )
        hit.position.set(isLeft ? frameX + 0.24 : frameX - 0.24, frameY - 0.12, frameZ)
        hit.rotation.y = rotY
        hit.userData.song = toTrack(song)
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
      setTip(hitMeshes.length > 0 ? '画框就绪：点击“进入漫游”后，对准画框左键即可播放' : '暂无歌曲可展示')
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

    let lastLabel = ''
    const clock = new THREE.Clock()
    let raf = 0
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05)

      if (controls.isLocked) {
        const speed = 4.2
        const forward = Number(keys.w) - Number(keys.s)
        const right = Number(keys.d) - Number(keys.a)
        if (forward !== 0) controls.moveForward(forward * speed * dt)
        if (right !== 0) controls.moveRight(right * speed * dt)

        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -4.2, 4.2)
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -136, 12)

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

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight)
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
        <div
          className="page-hero-inner grid gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(56,34,24,0.9), rgba(36,24,18,0.92))',
            border: '1px solid rgba(220,170,120,0.35)',
            boxShadow: '0 10px 32px rgba(33,19,14,0.34), inset 0 1px 0 rgba(255,224,190,0.1)',
          }}
        >
          <div className="page-heading">
            <div className="page-kicker" style={{ letterSpacing: '0.18em' }}>IMMERSIVE GALLERY</div>
            <h2 className="page-title">漫游画廊</h2>
            <p className="page-subtitle">像在深夜美术馆里听歌：准星对准封面，点击即可瞬时切歌。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="btn"
              onClick={() => lockRef.current?.()}
              style={{
                background: 'linear-gradient(135deg, rgba(23,42,84,0.85), rgba(15,33,72,0.95))',
                border: '1px solid rgba(126,171,255,0.48)',
                boxShadow: '0 6px 18px rgba(39,82,174,0.32)',
              }}
            >
              进入漫游
            </button>
            <div className="status-chip" style={{ borderColor: 'rgba(113,162,255,0.38)' }}>{tip}</div>
            <div className="status-chip" style={{ borderColor: 'rgba(91,133,214,0.32)', color: 'var(--text-muted)' }}>展厅藏品：{gallerySongs.length}</div>
          </div>
        </div>
      </section>

      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 290px)', minHeight: 460, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(220,175,128,0.42)', background: 'radial-gradient(120% 85% at 50% 100%, rgba(182,138,92,0.35) 0%, rgba(72,52,36,0.88) 56%, rgba(48,34,24,1) 100%)', boxShadow: 'inset 0 0 90px rgba(255,224,188,0.12), 0 18px 42px rgba(28,18,13,0.4)' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 34%, rgba(20,13,10,0.32) 100%)' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(to bottom, rgba(255,228,195,0.08), transparent 26%)' }} />

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', border: '2px solid rgba(235,245,255,0.94)', boxShadow: '0 0 20px rgba(127,177,255,0.65)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: '50%', background: 'rgba(230,244,255,0.92)', boxShadow: '0 0 10px rgba(130,180,255,0.9)', pointerEvents: 'none' }} />

        {focusedLabel && (
          <div style={{ position: 'absolute', left: 'calc(50% + 22px)', top: 'calc(50% - 10px)', transform: 'translateY(-50%)', maxWidth: 340, padding: '7px 12px', borderRadius: 12, border: '1px solid rgba(238,191,136,0.58)', background: 'linear-gradient(135deg, rgba(62,42,30,0.9), rgba(42,28,20,0.86))', color: '#ffe7cd', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', backdropFilter: 'blur(6px)', boxShadow: '0 8px 24px rgba(36,22,15,0.45)' }}>
            ♪ {focusedLabel}
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 12, padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(214,172,122,0.4)', background: 'rgba(46,31,22,0.62)', color: '#f0d7b6', fontSize: 12, pointerEvents: 'none' }}>
          WASD 移动 · 鼠标转向 · 左键播放 · Enter 快捷播放
        </div>

        <div style={{ position: 'absolute', right: 14, top: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(220,178,130,0.42)', background: 'rgba(50,35,24,0.56)', color: '#ffe8cf', fontSize: 11, letterSpacing: '0.06em', pointerEvents: 'none' }}>
          IMMERSIVE HALL
          <span style={{ marginLeft: 8, color: isLocked ? '#cbffe4' : 'var(--text-muted)' }}>
            {isLocked ? '• LOCKED' : '• FREE LOOK'}
          </span>
        </div>
      </div>
    </div>
  )
}
