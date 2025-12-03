import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

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
}

const Ctx = createContext<PlayerCtx | null>(null)

export function PlayerProvider({ children }: { children: React.ReactNode }){
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.8)
  const [mode, setMode] = useState<Mode>('repeat-all')
  const [current, setCurrent] = useState<Track | null>(null)
  const [queue, setQueue] = useState<Track[]>([])
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
  const [muted, setMuted] = useState(false)
  const prevVolRef = useRef<number>(volume)
  const [limiterEnabled, setLimiter] = useState(false)

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
    audio.addEventListener('ended', handleEnded)
    audio.volume = volume
    return () => {
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
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
    const analyser = ac.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.3
    // default chain: source -> gain -> highpass -> analyser
    sourceRef.current.connect(gainRef.current)
    gainRef.current.disconnect()
    hpRef.current.disconnect()
    if (limiterEnabled) {
      gainRef.current.connect(compRef.current)
      compRef.current.connect(hpRef.current)
    } else {
      gainRef.current.connect(hpRef.current)
    }
    hpRef.current.connect(analyser)
    analyser.connect(ac.destination)
    setAnalyser(analyser)
  }

  const play = (t?: Track) => {
    const audio = audioRef.current!
    const startPlayback = async () => {
      ensureAudioContext()
      await acRef.current!.resume()
      try {
        // power-on fade
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
        setIsPlaying(true)
      } catch (e) { /* ignore */ }
      import('../lib/supabaseClient').then(async ({ supabase }) => {
        const user = await supabase?.auth.getUser()
        if (supabase && user?.data.user && (t?.id || current?.id)) {
          await supabase.from('playback_history').insert({ user_id: user.data.user.id, song_id: (t?.id || current!.id), played_ms: audio.currentTime, device: 'browser' })
        }
      })
    }
    if (t) {
      setCurrent(t)
      setPlaybackError(null)
      audio.pause()
      setIsPlaying(false)
      audio.currentTime = 0
      if (t.url) {
        audio.src = t.url
        audio.load()
        startPlayback()
        return
      }
      if (t.storage_path && (window as any).supabaseClientAvailable !== false) {
        (async () => {
          try {
            const { supabase } = await import('../lib/supabaseClient')
            if (!supabase) throw new Error('Supabase未配置')
            const { data, error } = await supabase.storage.from('audio').createSignedUrl(t.storage_path!, 60 * 60 * 24)
            if (error || !data?.signedUrl) throw new Error('签名URL生成失败')
            audio.src = data.signedUrl
            audio.load()
            startPlayback()
          } catch (e:any) {
            setPlaybackError(e.message || '音频链接生成失败')
          }
        })()
        return
      }
    }
    startPlayback()
  }
  const pause = () => { audioRef.current?.pause(); setIsPlaying(false) }
  const next = () => {
    if (!current || queue.length === 0) return
    const idx = queue.findIndex(q => q.id === current.id)
    const pick = mode === 'shuffle'
      ? queue[Math.floor(Math.random() * queue.length)]
      : queue[(idx + 1) % queue.length]
    play(pick)
  }
  const prev = () => {
    if (!current || queue.length === 0) return
    const idx = queue.findIndex(q => q.id === current.id)
    const pick = mode === 'shuffle'
      ? queue[Math.floor(Math.random() * queue.length)]
      : queue[(idx - 1 + queue.length) % queue.length]
    play(pick)
  }
  const seek = (p: number) => { if (audioRef.current) audioRef.current.currentTime = p }
  const setVolume = (v: number) => {
    setVolumeState(v)
    const ac = acRef.current
    const g = gainRef.current
    const targetGain = uiToGain(v)
    if (ac && g) { g.gain.setTargetAtTime(targetGain, ac.currentTime, 0.05) } else if (audioRef.current) { audioRef.current.volume = v }
  }
  const handleEnded = () => {
    setIsPlaying(false)
    const audio = audioRef.current!
    import('../lib/supabaseClient').then(async ({ supabase }) => {
      if (supabase && current?.id && isFinite(audio.duration)) {
        await supabase.from('songs').update({ duration: audio.duration }).eq('id', current.id)
      }
    })
    next()
  }
  const attachFile = async (file: File) => {
    const url = URL.createObjectURL(file)
    const t: Track = { id: 'local', title: file.name, url }
    setQueue([t])
    play(t)
  }
  const toggleLike = () => setLiked(v => !v)
  const addToQueue = (t: Track) => { setQueue(prev => [...prev, t]) }

  const openRight = (m: 'visualizer' | 'queue' | 'lyrics') => {
    if (rightOpen && rightMode === m) { setRightOpen(false); return }
    setRightMode(m); setRightOpen(true)
  }
  const closeRight = () => setRightOpen(false)
  const openCenter = () => setCenterOpen(v => !v)
  const closeCenter = () => setCenterOpen(false)

  const rampId = React.useRef<number>(0)
  const rampVolume = (target: number, ms: number = 150) => {
    const clamped = Math.min(1, Math.max(0, target))
    const ac = acRef.current
    const g = gainRef.current
    if (ac && g) {
      const now = ac.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(uiToGain(clamped), now + ms/1000)
      setVolumeState(clamped)
    } else {
      const start = performance.now()
      const from = volume
      if (rampId.current) cancelAnimationFrame(rampId.current)
      const step = (t: number) => {
        const k = Math.min(1, (t-start)/ms)
        const v = from + (clamped - from) * k
        setVolume(v)
        rampId.current = k<1 ? requestAnimationFrame(step) : 0
      }
      rampId.current = requestAnimationFrame(step)
    }
  }

  const toggleMute = () => {
    const ac = acRef.current
    const g = gainRef.current
    if (!ac || !g) { setMuted(m => !m); return }
    const now = ac.currentTime
    if (!muted) {
      prevVolRef.current = volume
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0.0, now + 0.1)
      setVolumeState(0)
      setMuted(true)
    } else {
      const target = uiToGain(prevVolRef.current)
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(target, now + 0.1)
      setVolumeState(prevVolRef.current)
      setMuted(false)
    }
  }

  const setLimiterEnabled = (on: boolean) => {
    setLimiter(on)
    const ac = acRef.current
    const g = gainRef.current
    const hp = hpRef.current
    const comp = compRef.current
    const an = analyser
    if (!ac || !g || !hp || !an) return
    try {
      g.disconnect()
      hp.disconnect()
    } catch {}
    if (on && comp) {
      g.connect(comp)
      comp.connect(hp)
    } else {
      g.connect(hp)
    }
    hp.connect(an)
  }

  const value = useMemo<PlayerCtx>(() => ({
    audioEl: audioRef.current,
    isPlaying, volume, mode, current, queue, progress, duration, analyser,
    liked,
    playbackError,
    setVolume, rampVolume, muted, toggleMute, play, pause, next, prev, seek, setQueue, setMode, attachFile, toggleLike, addToQueue,
    rightOpen, rightMode, setRightOpen, setRightMode, openRight, closeRight,
    centerOpen, openCenter, closeCenter,
    limiterEnabled,
    setLimiterEnabled
  }), [isPlaying, volume, muted, mode, current, queue, progress, duration, analyser, liked, playbackError, rightOpen, rightMode, centerOpen, limiterEnabled])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePlayer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
