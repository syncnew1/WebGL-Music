import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useData } from './DataProvider'

type Mode = 'repeat-one' | 'repeat-all' | 'shuffle'
type Track = { id: string; title: string; artist?: string; url?: string; storage_path?: string }

type PlayerCtx = {
  audioEl: HTMLAudioElement | null
  isPlaying: boolean
  volume: number
  mode: Mode
  current: Track | null
  queue: Track[]
  progress: number
  duration: number
  analyser: AnalyserNode | null
  liked: boolean
  playbackError: string | null
  setVolume: (v: number) => void
  rampVolume: (v: number, ms?: number) => void
  muted: boolean
  toggleMute: () => void
  play: (t?: Track) => void
  pause: () => void
  next: () => void
  prev: () => void
  seek: (p: number) => void
  setQueue: (q: Track[]) => void
  setMode: (m: Mode) => void
  attachFile: (file: File) => Promise<void>
  toggleLike: () => void
  addToQueue: (t: Track) => void
  rightOpen: boolean
  rightMode: 'visualizer' | 'queue' | 'lyrics'
  setRightOpen: (v: boolean) => void
  setRightMode: (m: 'visualizer' | 'queue' | 'lyrics') => void
  openRight: (m: 'visualizer' | 'queue' | 'lyrics') => void
  closeRight: () => void
  centerOpen: boolean
  openCenter: () => void
  closeCenter: () => void
  limiterEnabled?: boolean
  setLimiterEnabled?: (on: boolean) => void
  smartQueueEnabled: boolean
  toggleSmartQueue: () => void
}

const Ctx = createContext<PlayerCtx | null>(null)

export function PlayerProvider({ children }: { children: React.ReactNode }){
  const { songs, getNeteaseSongUrl } = useData()
  const neteaseBase = (import.meta.env.VITE_NETEASE_API_BASE || '').replace(/\/$/, '')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.8)
  const [mode, setModeState] = useState<Mode>('repeat-all')
  const [current, setCurrentState] = useState<Track | null>(null)
  const [queue, setQueueState] = useState<Track[]>([])
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [liked, setLiked] = useState(false)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [rightOpen, setRightOpen] = useState(false)
  const [rightMode, setRightMode] = useState<'visualizer' | 'queue' | 'lyrics'>('visualizer')
  const [centerOpen, setCenterOpen] = useState(false)
  const acRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const compRef = useRef<DynamicsCompressorNode | null>(null)
  const hpRef = useRef<BiquadFilterNode | null>(null)
  const signedUrlCache = useRef<Map<string, { url: string; exp: number }>>(new Map())
  const [muted, setMuted] = useState(false)
  const prevVolRef = useRef<number>(0.8)
  const [limiterEnabled, setLimiter] = useState(false)
  const [smartQueueEnabled, setSmartQueueEnabled] = useState(true)

  const currentRef = useRef<Track | null>(null)
  const queueRef = useRef<Track[]>([])
  const modeRef = useRef<Mode>('repeat-all')
  const handleEndedRef = useRef<() => void>(() => {})

  const setCurrent = (t: Track | null) => { currentRef.current = t; setCurrentState(t) }
  const setQueue = (q: Track[] | ((prev: Track[]) => Track[])) => {
    setQueueState(prev => {
      const next = typeof q === 'function' ? q(prev) : q
      queueRef.current = next
      return next
    })
  }
  const setMode = (m: Mode) => { modeRef.current = m; setModeState(m) }
  const uiToGain = (ui: number) => {
    const dB = -60 + 60 * Math.pow(ui, 2)
    return Math.pow(10, dB / 20)
  }

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    audio.addEventListener('timeupdate', () => setProgress(audio.currentTime))
    audio.addEventListener('durationchange', () => setDuration(audio.duration || 0))
    audio.addEventListener('error', () => setPlaybackError('音频加载失败，请检查音频地址或存储权限'))
    const endedListener = () => handleEndedRef.current()
    audio.addEventListener('ended', endedListener)
    audio.volume = 0.8
    return () => {
      audio.pause()
      audio.removeEventListener('ended', endedListener)
      acRef.current?.close()
    }
  }, [])

  const ensureAudioContext = () => {
    if (!acRef.current) acRef.current = new AudioContext()
    const ac = acRef.current
    const audio = audioRef.current!
    if (!sourceRef.current) sourceRef.current = ac.createMediaElementSource(audio)
    if (!gainRef.current) {
      gainRef.current = ac.createGain()
      gainRef.current.gain.setValueAtTime(uiToGain(volume), ac.currentTime)
    }
    if (!hpRef.current) {
      hpRef.current = ac.createBiquadFilter()
      hpRef.current.type = 'highpass'
      hpRef.current.frequency.setValueAtTime(30, ac.currentTime)
      hpRef.current.Q.setValueAtTime(0.707, ac.currentTime)
    }
    if (!compRef.current) {
      compRef.current = ac.createDynamicsCompressor()
      compRef.current.threshold.setValueAtTime(-1, ac.currentTime)
      compRef.current.knee.setValueAtTime(6, ac.currentTime)
      compRef.current.ratio.setValueAtTime(20, ac.currentTime)
      compRef.current.attack.setValueAtTime(0.005, ac.currentTime)
      compRef.current.release.setValueAtTime(0.1, ac.currentTime)
    }
    const newAnalyser = ac.createAnalyser()
    newAnalyser.fftSize = 1024
    newAnalyser.smoothingTimeConstant = 0.3
    sourceRef.current.connect(gainRef.current)
    gainRef.current.disconnect()
    hpRef.current.disconnect()
    if (limiterEnabled && compRef.current) {
      gainRef.current.connect(compRef.current)
      compRef.current.connect(hpRef.current)
    } else {
      gainRef.current.connect(hpRef.current)
    }
    hpRef.current.connect(newAnalyser)
    newAnalyser.connect(ac.destination)
    setAnalyser(newAnalyser)
  }

  const resolveSourceFromStorage = async (storagePath?: string) => {
    if (!storagePath || (window as any).supabaseClientAvailable === false) return null
    const { supabase } = await import('../lib/supabaseClient')
    if (!supabase) return null

    const cacheKey = storagePath
    const cached = signedUrlCache.current.get(cacheKey)
    if (cached && cached.exp > Date.now()) return cached.url

    const signed = await supabase.storage.from('audio').createSignedUrl(cacheKey, 60 * 60 * 24)
    if (!signed.error && signed.data?.signedUrl) {
      const url = signed.data.signedUrl
      signedUrlCache.current.set(cacheKey, { url, exp: Date.now() + 23 * 60 * 60 * 1000 })
      return url
    }

    const pub = supabase.storage.from('audio').getPublicUrl(cacheKey)
    if (pub?.data?.publicUrl) return pub.data.publicUrl

    try {
      const dl = await supabase.storage.from('audio').download(cacheKey)
      if (!dl.error && dl.data) return URL.createObjectURL(dl.data)
    } catch {}

    return null
  }

  const play = (t?: Track) => {
    const audio = audioRef.current!

    const startPlayback = async () => {
      ensureAudioContext()
      await acRef.current!.resume()
      try {
        if (gainRef.current) {
          const ac = acRef.current!
          const g = gainRef.current
          const now = ac.currentTime
          const target = uiToGain(volume)
          g.gain.cancelScheduledValues(now)
          g.gain.setValueAtTime(0.0, now)
          g.gain.linearRampToValueAtTime(target, now + 0.2)
        }
        await audio.play()
        setPlaybackError(null)
        setIsPlaying(true)

        import('../lib/supabaseClient').then(async ({ supabase }) => {
          const user = await supabase?.auth.getUser()
          const songId = t?.id || currentRef.current?.id
          if (supabase && user?.data.user && songId) {
            await supabase.from('playback_history').insert({
              user_id: user.data.user.id,
              song_id: songId,
              played_ms: audio.currentTime,
              device: 'browser',
            })
          }
        })

        return true
      } catch {
        setIsPlaying(false)
        return false
      }
    }

    const trySource = async (src: string) => {
      return await new Promise<boolean>((resolve) => {
        let done = false
        const cleanup = () => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          window.clearTimeout(timer)
        }
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          cleanup()
          resolve(ok)
        }
        const onCanPlay = async () => {
          const ok = await startPlayback()
          finish(ok)
        }
        const onError = () => finish(false)
        const timer = window.setTimeout(() => finish(false), 8000)

        audio.addEventListener('canplay', onCanPlay, { once: true })
        audio.addEventListener('error', onError, { once: true })
        audio.src = src
        audio.load()
      })
    }

    if (t) {
      setCurrent(t)
      setPlaybackError(null)
      audio.pause()
      setIsPlaying(false)
      audio.currentTime = 0

      ;(async () => {
        let resolvedUrl = t.url
        if (!resolvedUrl && t.id.startsWith('netease-') && neteaseBase) {
          try {
            resolvedUrl = await getNeteaseSongUrl(t.id)
          } catch {}
        }

        if (!resolvedUrl && !t.storage_path) {
          setPlaybackError('该歌曲缺少可用音频地址，请重新上传')
          return
        }
        const candidates: string[] = []
        const storageUrl = await resolveSourceFromStorage(t.storage_path)
        if (storageUrl) candidates.push(storageUrl)
        if (resolvedUrl) candidates.push(resolvedUrl)

        const uniq = Array.from(new Set(candidates.filter(Boolean)))
        for (const src of uniq) {
          const ok = await trySource(src)
          if (ok) return
        }

        if (uniq.length === 0) {
          const ok = await startPlayback()
          if (ok) return
        }

        setPlaybackError('音频加载失败，请检查音频地址或存储权限')
      })()
      return
    }

    void startPlayback()
  }
  const pause = () => { audioRef.current?.pause(); setIsPlaying(false) }

  const next = () => {
    const cur = currentRef.current; const q = queueRef.current; const m = modeRef.current
    if (!cur || q.length === 0) return
    const idx = q.findIndex(item => item.id === cur.id)
    if (m === 'shuffle') {
      const others = q.filter(item => item.id !== cur.id)
      const pool = others.length > 0 ? others : q
      play(pool[Math.floor(Math.random() * pool.length)])
    } else {
      play(q[(idx + 1) % q.length])
    }
  }
  const prev = () => {
    const cur = currentRef.current; const q = queueRef.current; const m = modeRef.current
    if (!cur || q.length === 0) return
    const idx = q.findIndex(item => item.id === cur.id)
    if (m === 'shuffle') {
      const others = q.filter(item => item.id !== cur.id)
      const pool = others.length > 0 ? others : q
      play(pool[Math.floor(Math.random() * pool.length)])
    } else {
      play(q[(idx - 1 + q.length) % q.length])
    }
  }

  const seek = (p: number) => { if (audioRef.current) audioRef.current.currentTime = p }
  const setVolume = (v: number) => {
    setVolumeState(v)
    const ac = acRef.current; const g = gainRef.current
    if (ac && g) { g.gain.setTargetAtTime(uiToGain(v), ac.currentTime, 0.05) }
    else if (audioRef.current) { audioRef.current.volume = v }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    const audio = audioRef.current!
    const cur = currentRef.current
    const m = modeRef.current
    import('../lib/supabaseClient').then(async ({ supabase }) => {
      if (supabase && cur?.id && isFinite(audio.duration)) {
        await supabase.from('songs').update({ duration: audio.duration }).eq('id', cur.id)
      }
    })
    // 单曲循环：重置到开头并重新播放
    if (m === 'repeat-one') {
      audio.currentTime = 0
      audio.play().then(() => setIsPlaying(true)).catch(() => {})
      return
    }
    next()
  }
  handleEndedRef.current = handleEnded

  const attachFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    const t: Track = { id: 'local', title: file.name, url }
    setQueue([t]); play(t)
  }
  const toggleLike = () => setLiked(v => !v)
  // 防止相同歌曲重复加入队列
  const addToQueue = (t: Track) => {
    setQueue(prev => {
      const next = prev.some(item => item.id === t.id) ? prev : [...prev, t]
      if (!currentRef.current) {
        queueRef.current = next
        play(t)
      }
      return next
    })
  }

  const toggleSmartQueue = () => setSmartQueueEnabled(v => !v)

  useEffect(() => {
    if (!smartQueueEnabled) return
    const q = queueRef.current
    if (q.length > 1) return
    if (!currentRef.current) return

    const cur = currentRef.current
    const candidates = songs
      .filter(s => s.id !== cur.id)
      .filter(s => !q.some(item => item.id === s.id))

    const sameArtist = candidates.filter(s => !!cur.artist && s.artist === cur.artist)
    const pool = sameArtist.length > 0 ? sameArtist : candidates
    if (pool.length === 0) return

    const pick = pool.slice(0, 12).sort(() => Math.random() - 0.5).slice(0, 5)
    const smart = pick.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      url: s.url,
      storage_path: s.storage_path,
    }))

    setQueue(prev => {
      const known = new Set(prev.map(x => x.id))
      const append = smart.filter(x => !known.has(x.id))
      if (append.length === 0) return prev
      return [...prev, ...append]
    })
  }, [songs, current, queue, smartQueueEnabled])

  const openRight = (m: 'visualizer' | 'queue' | 'lyrics') => {
    if (rightOpen && rightMode === m) { setRightOpen(false); return }
    setRightMode(m); setRightOpen(true)
  }
  const closeRight = () => setRightOpen(false)
  const openCenter = () => setCenterOpen(v => !v)
  const closeCenter = () => setCenterOpen(false)

  const rampId = useRef<number>(0)
  const rampVolume = (target: number, ms: number = 150) => {
    const clamped = Math.min(1, Math.max(0, target))
    const ac = acRef.current; const g = gainRef.current
    if (ac && g) {
      const now = ac.currentTime
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(uiToGain(clamped), now + ms / 1000)
      setVolumeState(clamped)
    } else {
      const start = performance.now(); const from = volume
      if (rampId.current) cancelAnimationFrame(rampId.current)
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / ms)
        setVolume(from + (clamped - from) * k)
        rampId.current = k < 1 ? requestAnimationFrame(step) : 0
      }
      rampId.current = requestAnimationFrame(step)
    }
  }

  const toggleMute = () => {
    const ac = acRef.current; const g = gainRef.current
    if (!ac || !g) { setMuted(m => !m); return }
    const now = ac.currentTime
    if (!muted) {
      prevVolRef.current = volume
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0.0, now + 0.1)
      setVolumeState(0); setMuted(true)
    } else {
      const target = uiToGain(prevVolRef.current)
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(target, now + 0.1)
      setVolumeState(prevVolRef.current); setMuted(false)
    }
  }

  const setLimiterEnabled = (on: boolean) => {
    setLimiter(on)
    const ac = acRef.current; const g = gainRef.current
    const hp = hpRef.current; const comp = compRef.current; const an = analyser
    if (!ac || !g || !hp || !an) return
    try { g.disconnect(); hp.disconnect() } catch {}
    if (on && comp) { g.connect(comp); comp.connect(hp) } else { g.connect(hp) }
    hp.connect(an)
  }

  const value = useMemo<PlayerCtx>(() => ({
    audioEl: audioRef.current,
    isPlaying, volume, mode, current, queue, progress, duration, analyser,
    liked, playbackError,
    setVolume, rampVolume, muted, toggleMute,
    play, pause, next, prev, seek,
    setQueue, setMode, attachFile, toggleLike, addToQueue,
    rightOpen, rightMode, setRightOpen, setRightMode, openRight, closeRight,
    centerOpen, openCenter, closeCenter,
    limiterEnabled, setLimiterEnabled,
    smartQueueEnabled, toggleSmartQueue,
  }), [
    isPlaying, volume, muted, mode, current, queue,
    progress, duration, analyser, liked, playbackError,
    rightOpen, rightMode, centerOpen, limiterEnabled, smartQueueEnabled,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePlayer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
