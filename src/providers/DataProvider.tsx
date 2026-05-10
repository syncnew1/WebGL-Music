import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Converter } from 'opencc-js/t2cn'
import { supabase } from '../lib/supabaseClient'

export type Song = { id: string; title: string; artist?: string; album?: string; tags?: string[]; url?: string; storage_path?: string; cover_storage_path?: string; cover_url?: string; lyrics?: string; owner_id?: string }
export type MusicSource = 'cloud' | 'netease'
export type NeteaseProfile = { nickname: string; avatarUrl?: string }
export type Playlist = { id: string; name: string; description?: string; is_public?: boolean; owner_id?: string; songs: string[] }

type DataCtx = {
  songs: Song[]
  playlists: Playlist[]
  history: Song[]
  musicSource: MusicSource
  setMusicSource: (s: MusicSource) => void
  neteaseProfile: NeteaseProfile | null
  neteaseQrImage: string
  neteaseQrStatus: string
  startNeteaseQrLogin: () => Promise<void>
  checkNeteaseQrLogin: () => Promise<void>
  logoutNetease: () => void
  fetchNeteaseLyricBySongId: (id: string) => Promise<string>
  fetchNeteasePlaylists: () => Promise<any[]>
  fetchNeteasePlaylistTracks: (playlistId: string) => Promise<Song[]>
  loadMoreNeteaseSongs: () => Promise<void>
  fetchNeteasePage: (page: number) => Promise<boolean>
  prefetchNeteasePage: (page: number) => Promise<void>
  neteaseHasMore: boolean
  dataSource: 'loading' | 'cloud' | 'local'
  cloudLatencyMs: number | null
  reloadCloudData: () => Promise<void>
  uploadSong: (file: File, meta: Partial<Song>) => Promise<void>
  removeSong: (id: string) => Promise<void>
  createPlaylist: (p: Omit<Playlist, 'id' | 'songs'>) => Promise<string>
  removePlaylist: (playlistId: string) => Promise<void>
  addToPlaylist: (playlistId: string, songId: string) => Promise<void>
  removeFromPlaylist: (playlistId: string, songId: string) => Promise<void>
  searchSongs: (q: string) => Promise<Song[]>
  recordHistory: (song: Song) => void
  fetchHistory: (page: number, pageSize: number) => Promise<any[]>
  getCoverUrl: (path?: string) => Promise<string | null>
  updateLyrics: (id: string, lyrics: string) => Promise<void>
  autoFillSongMeta: (id: string, opts?: { cover?: boolean; lyrics?: boolean }) => Promise<{ cover: boolean; lyrics: boolean }>
  ensureLikedPlaylist: () => Promise<string>
  isSongLiked: (songId: string) => boolean
  toggleLikeSong: (songId: string) => Promise<void>
}

const Ctx = createContext<DataCtx | null>(null)
const t2s = Converter({ from: 't', to: 'cn' })

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>(() => {
    try {
      const raw = localStorage.getItem('wm:songs')
      return raw ? (JSON.parse(raw) as Song[]) : []
    } catch {
      return []
    }
  })
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const raw = localStorage.getItem('wm:playlists')
      return raw ? (JSON.parse(raw) as Playlist[]) : []
    } catch {
      return []
    }
  })
  const [history, setHistory] = useState<Song[]>([])
  const [dataSource, setDataSource] = useState<'loading' | 'cloud' | 'local'>('loading')
  const [cloudLatencyMs, setCloudLatencyMs] = useState<number | null>(null)
  const [musicSource, setMusicSourceState] = useState<MusicSource>(() => {
    try {
      const v = localStorage.getItem('wm:music-source')
      return v === 'netease' ? 'netease' : 'cloud'
    } catch {
      return 'cloud'
    }
  })
  const [neteaseProfile, setNeteaseProfile] = useState<NeteaseProfile | null>(null)
  const [neteaseQrImage, setNeteaseQrImage] = useState('')
  const [neteaseQrStatus, setNeteaseQrStatus] = useState('未登录')
  const [neteasePolling, setNeteasePolling] = useState(false)
  const neteaseQrKeyRef = useRef('')
  const neteaseUidRef = useRef<number | null>(null)
  const neteaseSongUrlCache = useRef<Map<string, { url: string; exp: number }>>(new Map())
  const [neteaseHasMore, setNeteaseHasMore] = useState(true)
  const neteaseLoadingMoreRef = useRef(false)
  const neteaseChartIdsRef = useRef<number[]>([])
  const neteaseChartIdxRef = useRef(0)
  const neteaseChartOffsetRef = useRef(0)
  const neteasePageCache = useRef<Map<number, Song[]>>(new Map())

  // debounce localStorage 写入，避免大数组序列化阻塞主线程
  const songsTimerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    clearTimeout(songsTimerRef.current)
    songsTimerRef.current = setTimeout(() => {
      try { localStorage.setItem('wm:songs', JSON.stringify(songs)) } catch {}
    }, 2000)
    return () => clearTimeout(songsTimerRef.current)
  }, [songs])

  useEffect(() => {
    try { localStorage.setItem('wm:playlists', JSON.stringify(playlists)) } catch {}
  }, [playlists])

  useEffect(() => {
    try { localStorage.setItem('wm:music-source', musicSource) } catch {}
  }, [musicSource])

  const setMusicSource = (s: MusicSource) => {
    setMusicSourceState(s)
    if (s === 'cloud') {
      void loadCloudData().catch(() => {})
    } else {
      void fetchNeteaseHotSongs()
    }
  }

  const neteaseBase = (import.meta.env.VITE_NETEASE_API_BASE || '').replace(/\/$/, '')
  const hasNetease = neteaseBase.length > 0

  const neteaseFetch = (path: string, timeoutMs = 10000) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    return fetch(`${neteaseBase}${path}${path.includes('?') ? '&' : '?'}timestamp=${Date.now()}`, {
      credentials: 'include',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
  }

  const normalizeNeteaseCover = (u?: string) => (u || '').replace(/^http:\/\//i, 'https://')

  const syncNeteaseProfile = async () => {
    if (!hasNetease) return
    try {
      const r = await neteaseFetch('/login/status')
      if (!r.ok) return
      const j = await r.json()
      const p = j?.data?.profile
      if (p?.userId) {
        neteaseUidRef.current = Number(p.userId)
        setNeteaseProfile({ nickname: p.nickname, avatarUrl: p.avatarUrl })
        setNeteaseQrStatus('已登录')
        setNeteaseQrImage('')
      }
    } catch {}
  }

  const startNeteaseQrLogin = async () => {
    if (!hasNetease) {
      setNeteaseQrStatus('未配置 VITE_NETEASE_API_BASE')
      return
    }
    setNeteaseQrStatus('二维码生成中...')
    try {
      const keyResp = await neteaseFetch('/login/qr/key')
      if (!keyResp.ok) {
        setNeteaseQrStatus(`获取二维码 key 失败 (${keyResp.status})`)
        return
      }
      const keyJson = await keyResp.json()
      const key = keyJson?.data?.unikey || ''
      if (!key) {
        setNeteaseQrStatus('二维码 key 无效')
        return
      }

      const createResp = await neteaseFetch(`/login/qr/create?key=${encodeURIComponent(key)}&qrimg=true`)
      if (!createResp.ok) {
        setNeteaseQrStatus(`生成二维码失败 (${createResp.status})`)
        return
      }
      const createJson = await createResp.json()
      const qr = createJson?.data?.qrimg || ''
      if (!qr) {
        setNeteaseQrStatus('二维码图片为空')
        return
      }

      neteaseQrKeyRef.current = key
      setNeteaseQrImage(qr)
      setNeteaseQrStatus('请使用网易云音乐 App 扫码')
      setNeteasePolling(true)
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? '请求超时，API 服务可能不可用' : (e?.message || '网络错误')
      setNeteaseQrStatus(`登录失败：${msg}`)
    }
  }

  const checkNeteaseQrLogin = async () => {
    if (!hasNetease) return
    const key = neteaseQrKeyRef.current
    if (!key) return
    try {
      const resp = await neteaseFetch(`/login/qr/check?key=${encodeURIComponent(key)}`)
      if (!resp.ok) return
      const j = await resp.json()
      const code = j?.code
      if (code === 803) {
        // 直接从 check 响应中提取用户信息
        const nickname = j?.nickname || j?.profile?.nickname || ''
        const avatarUrl = j?.avatarUrl || j?.profile?.avatarUrl || ''
        if (nickname) {
          neteaseUidRef.current = Number(j?.userId || j?.profile?.userId || 0)
          setNeteaseProfile({ nickname, avatarUrl: normalizeNeteaseCover(avatarUrl) })
        }
        setNeteaseQrStatus('登录成功')
        setNeteasePolling(false)
        setNeteaseQrImage('')
        // 也尝试通过 syncNeteaseProfile 补充信息（不阻塞）
        void syncNeteaseProfile()
        return
      }
      if (code === 802) setNeteaseQrStatus('已扫码，请在手机确认')
      else if (code === 801) setNeteaseQrStatus('等待扫码')
      else if (code === 800) {
        setNeteaseQrStatus('二维码已过期，请重新生成')
        setNeteasePolling(false)
      }
    } catch {}
  }

  const logoutNetease = () => {
    setNeteaseProfile(null)
    setNeteaseQrImage('')
    setNeteaseQrStatus('未登录')
    setNeteasePolling(false)
    neteaseQrKeyRef.current = ''
    void neteaseFetch('/logout').catch(() => {})
  }

  const getNeteaseSongUrl = async (id: string) => {
    if (!hasNetease || !id) return ''
    const pureId = id.replace('netease-', '')
    const cache = neteaseSongUrlCache.current.get(pureId)
    if (cache && cache.exp > Date.now()) return cache.url
    const resp = await neteaseFetch(`/song/url/v1?id=${encodeURIComponent(pureId)}&level=standard`)
    if (!resp.ok) return ''
    const j = await resp.json()
    const url = j?.data?.[0]?.url || ''
    if (url) neteaseSongUrlCache.current.set(pureId, { url, exp: Date.now() + 30 * 60 * 1000 })
    return url
  }

  const fetchNeteasePlaylists = async () => {
    if (!hasNetease) return []
    let uid = neteaseUidRef.current
    if (!uid) {
      try {
        const status = await neteaseFetch('/login/status')
        if (status.ok) {
          const j = await status.json()
          const p = j?.data?.profile
          if (p?.userId) {
            uid = Number(p.userId)
            neteaseUidRef.current = uid
          }
        }
      } catch {}
    }
    if (!uid) return []

    const resp = await neteaseFetch(`/user/playlist?uid=${encodeURIComponent(String(uid))}&limit=50`)
    if (!resp.ok) return []
    const j = await resp.json()
    const rows = Array.isArray(j?.playlist) ? j.playlist : []
    return rows.map((p: any) => ({
      id: `netease-pl-${p.id}`,
      rawId: String(p.id),
      name: p.name || '未命名歌单',
      description: p.description || '',
      cover_url: normalizeNeteaseCover(p.coverImgUrl),
      trackCount: Number(p.trackCount || 0),
      source: 'netease',
    }))
  }

  const fetchNeteasePlaylistTracks = async (playlistId: string) => {
    if (!hasNetease || !playlistId) return []
    const pureId = playlistId.replace('netease-pl-', '')
    const resp = await neteaseFetch(`/playlist/track/all?id=${encodeURIComponent(pureId)}&limit=200`)
    if (!resp.ok) return []
    const j = await resp.json()
    const rows = Array.isArray(j?.songs) ? j.songs : []
    const mapped = rows.map((r: any) => toNeteaseSong(r))
    setSongs(prev => {
      const m = new Map(prev.map(s => [s.id, s]))
      for (const s of mapped) m.set(s.id, { ...(m.get(s.id) || {}), ...s })
      return Array.from(m.values())
    })
    return mapped
  }

  const fetchNeteaseLyricBySongId = async (id: string) => {
    if (!hasNetease || !id) return ''
    const pureId = id.replace('netease-', '')
    const resp = await neteaseFetch(`/lyric?id=${encodeURIComponent(pureId)}`)
    if (!resp.ok) return ''
    const j = await resp.json()
    const lrc = (j?.lrc?.lyric || '').trim()
    const yrc = (j?.yrc?.lyric || '').trim()
    const tlyric = (j?.tlyric?.lyric || '').trim()
    return lrc || yrc || tlyric
  }

  const toNeteaseSong = (r: any): Song => ({
    id: `netease-${r?.id || r?.song?.id}`,
    title: r?.name || r?.song?.name || '',
    artist: (r?.ar || r?.artists || r?.song?.ar || r?.song?.artists || []).map((x: any) => x?.name).filter(Boolean).join(' / '),
    album: r?.al?.name || r?.album?.name || r?.song?.al?.name || r?.song?.album?.name || '',
    cover_storage_path: undefined,
    cover_url: normalizeNeteaseCover(r?.al?.picUrl || r?.album?.picUrl || r?.song?.al?.picUrl || r?.song?.album?.picUrl || r?.picUrl || r?.coverImgUrl || r?.song?.picUrl || r?.song?.coverImgUrl),
    url: undefined,
    tags: ['netease'],
  })

  const fetchNeteasePlaylistIds = async (): Promise<number[]> => {
    // 尝试 /toplist 获取排行榜
    try {
      const lr = await neteaseFetch('/toplist')
      if (lr.ok) {
        const lj = await lr.json()
        const charts = Array.isArray(lj?.list) ? lj.list : []
        const ids = charts.map((c: any) => c?.id).filter(Boolean)
        if (ids.length > 0) return ids
      }
    } catch {}

    // 回退：获取热门歌单
    try {
      const pr = await neteaseFetch('/top/playlist?limit=20&order=hot')
      if (pr.ok) {
        const pj = await pr.json()
        const playlists = Array.isArray(pj?.playlists) ? pj.playlists : []
        const ids = playlists.map((p: any) => p?.id).filter(Boolean)
        if (ids.length > 0) return ids
      }
    } catch {}

    return []
  }

  const fetchNeteaseHotSongs = async () => {
    if (!hasNetease) return
    neteaseChartIdsRef.current = []
    neteaseChartIdxRef.current = 0
    neteaseChartOffsetRef.current = 0
    neteasePageCache.current.clear()
    setNeteaseHasMore(true)

    const playlistIds = await fetchNeteasePlaylistIds()
    neteaseChartIdsRef.current = playlistIds

    // 加载第一批并缓存为第 0 页
    if (playlistIds.length > 0) {
      try {
        const r = await neteaseFetch(`/playlist/track/all?id=${playlistIds[0]}&limit=30&offset=0`)
        if (r.ok) {
          const j = await r.json()
          const rows = Array.isArray(j?.songs) ? j.songs : []
          if (rows.length > 0) {
            const page0 = rows.map(toNeteaseSong)
            neteasePageCache.current.set(0, page0)
            neteaseChartOffsetRef.current = 30
            setSongs(page0)
            return
          }
        }
      } catch {}
    }

    // 回退
    try {
      const r = await neteaseFetch('/top/song?type=0')
      if (r.ok) {
        const j = await r.json()
        const rows = Array.isArray(j?.data) ? j.data : []
        if (rows.length > 0) {
          const page0 = rows.slice(0, 30).map(toNeteaseSong)
          neteasePageCache.current.set(0, page0)
          setSongs(page0)
          return
        }
      }
    } catch {}

    try {
      const r = await neteaseFetch('/personalized/newsong?limit=30')
      if (!r.ok) return
      const j = await r.json()
      const rows = (Array.isArray(j?.result) ? j.result : [])
      if (rows.length > 0) {
        const page0 = rows.slice(0, 30).map(toNeteaseSong)
        neteasePageCache.current.set(0, page0)
        setSongs(page0)
      }
    } catch {}
  }

  const loadMoreNeteaseSongs = async () => {
    if (!hasNetease || neteaseLoadingMoreRef.current || !neteaseHasMore) return
    const chartIds = neteaseChartIdsRef.current
    if (chartIds.length === 0) {
      const ids = await fetchNeteasePlaylistIds()
      if (ids.length === 0) { setNeteaseHasMore(false); return }
      neteaseChartIdsRef.current = ids
    }

    neteaseLoadingMoreRef.current = true
    try {
      const LIMIT = 30
      const ids = neteaseChartIdsRef.current
      let chartIdx = neteaseChartIdxRef.current
      let offset = neteaseChartOffsetRef.current

      while (chartIdx < ids.length) {
        const chartId = ids[chartIdx]
        const r = await neteaseFetch(`/playlist/track/all?id=${chartId}&limit=${LIMIT}&offset=${offset}`)
        if (!r.ok) break
        const j = await r.json()
        const rows: any[] = Array.isArray(j?.songs) ? j.songs : []

        if (rows.length > 0) {
          const newSongs = rows.map(toNeteaseSong)
          offset += rows.length
          neteaseChartOffsetRef.current = offset
          // 将新一批歌曲缓存到下一页
          const nextPage = neteasePageCache.current.size
          neteasePageCache.current.set(nextPage, newSongs)
          if (rows.length >= LIMIT) break
        }

        chartIdx++
        offset = 0
        neteaseChartIdxRef.current = chartIdx
        neteaseChartOffsetRef.current = 0
        if (chartIdx >= ids.length) { setNeteaseHasMore(false); break }
      }
    } catch {} finally {
      neteaseLoadingMoreRef.current = false
    }
  }

  // 预加载：只缓存到内存，不触发 re-render
  const prefetchNeteasePage = async (page: number): Promise<void> => {
    if (!hasNetease || neteasePageCache.current.has(page)) return
    if (neteasePageCache.current.size === 0) {
      await fetchNeteaseHotSongs()
    }
    if (!neteasePageCache.current.has(page) && neteaseHasMore && !neteaseLoadingMoreRef.current) {
      await loadMoreNeteaseSongs()
    }
  }

  // 按页加载：从缓存取并更新 songs（触发 re-render）
  const fetchNeteasePage = async (page: number): Promise<boolean> => {
    if (!hasNetease) return false
    if (neteasePageCache.current.size === 0) {
      await fetchNeteaseHotSongs()
    }
    const cached = neteasePageCache.current.get(page)
    if (cached) {
      setSongs(cached)
      return true
    }
    if (neteaseHasMore && !neteaseLoadingMoreRef.current) {
      await loadMoreNeteaseSongs()
      const retry = neteasePageCache.current.get(page)
      if (retry) {
        setSongs(retry)
        return true
      }
    }
    return false
  }

  useEffect(() => {
    if (musicSource !== 'netease') return
    void syncNeteaseProfile()
    void fetchNeteaseHotSongs()
  }, [musicSource])

  useEffect(() => {
    if (!neteasePolling) return
    const timer = window.setInterval(() => {
      void checkNeteaseQrLogin()
    }, 1800)
    return () => window.clearInterval(timer)
  }, [neteasePolling])

  const loadCloudData = async () => {
    if (!supabase) {
      setDataSource('local')
      setCloudLatencyMs(null)
      return
    }

    const t0 = performance.now()

    const { data: songRows } = await supabase
      .from('songs')
      .select('id, title, artist, album, tags, storage_path, url, cover_storage_path, cover_url, lyrics')
      .order('created_at', { ascending: false })

    const { data: playlistRows } = await supabase
      .from('playlists')
      .select('id, name, description, is_public, owner_id')
      .order('created_at', { ascending: false })

    const sb = supabase
    const remoteSongs: Song[] = (songRows || []).map(r => {
      const fallbackUrl = r.url || (r.storage_path ? sb.storage.from('audio').getPublicUrl(r.storage_path).data.publicUrl : undefined)
      return {
        id: r.id,
        title: r.title,
        artist: r.artist,
        album: r.album,
        tags: r.tags || [],
        storage_path: r.storage_path,
        url: fallbackUrl,
        cover_storage_path: r.cover_storage_path,
        cover_url: r.cover_url,
        lyrics: r.lyrics,
      }
    })
    if (remoteSongs.length > 0) setSongs(remoteSongs)

    const remotePlaylists: Playlist[] = (playlistRows || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      is_public: p.is_public,
      owner_id: p.owner_id,
      songs: [],
    }))
    if (remotePlaylists.length > 0) setPlaylists(remotePlaylists)

    const playlistIds = (playlistRows || []).map(p => p.id)
    if (playlistIds.length > 0) {
      const { data: allRels } = await supabase
        .from('playlist_songs')
        .select('playlist_id, song_id')
        .in('playlist_id', playlistIds)

      if (allRels) {
        const relMap = new Map<string, string[]>()
        for (const r of allRels) {
          const arr = relMap.get(r.playlist_id) ?? []
          arr.push(r.song_id)
          relMap.set(r.playlist_id, arr)
        }
        setPlaylists(prev => prev.map(pp => ({ ...pp, songs: relMap.get(pp.id) ?? [] })))
      }
    }

    setCloudLatencyMs(Math.round(performance.now() - t0))
    setDataSource('cloud')

    void (async () => {
      const legacy = remoteSongs.filter(s => !s.cover_url && !!s.cover_storage_path).slice(0, 20)
      for (const s of legacy) {
        try {
          const { data } = await supabase.storage.from('covers').createSignedUrl(s.cover_storage_path!, 60 * 60 * 24 * 365)
          const signed = data?.signedUrl
          if (!signed) continue
          await supabase.from('songs').update({ cover_url: signed }).eq('id', s.id)
          setSongs(prev => prev.map(x => (x.id === s.id ? { ...x, cover_url: signed } : x)))
        } catch {}
      }
    })()
  }

  useEffect(() => {
    loadCloudData().catch(() => {
      setDataSource('local')
      setCloudLatencyMs(null)
    })
  }, [])

  const uploadSong = async (file: File, meta: Partial<Song>) => {
    const applyInsertLocal = (payload: Partial<Song>) => {
      const url = URL.createObjectURL(file)
      const s: Song = {
        id: `local-${Date.now()}`,
        title: payload.title || file.name,
        artist: payload.artist,
        album: payload.album,
        url,
        tags: payload.tags || [],
        cover_url: (payload as any).cover_url,
      }
      setSongs(prev => [s, ...prev])
    }

    const readTags = async () => {
      try {
        const mod = await import('jsmediatags/dist/jsmediatags.min.js') as any
        return await new Promise<Partial<Song>>((resolve) => {
          mod.default.read(file, {
            onSuccess: (tag: any) => {
              const t = tag.tags || {}
              const pic = t.picture
              let coverUrl: string | undefined
              if (pic?.data && pic?.format) {
                try {
                  const bytes = new Uint8Array(pic.data)
                  let binary = ''
                  for (const b of bytes) binary += String.fromCharCode(b)
                  const base64 = btoa(binary)
                  coverUrl = `data:${pic.format};base64,${base64}`
                } catch {}
              }
              resolve({
                title: meta.title || t.title || file.name,
                artist: meta.artist || t.artist,
                album: meta.album || t.album,
                tags: [t.genre].filter(Boolean),
                cover_url: coverUrl,
              })
            },
            onError: () => resolve({ title: meta.title || file.name, artist: meta.artist, album: meta.album }),
          })
        })
      } catch {
        return { title: meta.title || file.name, artist: meta.artist, album: meta.album }
      }
    }

    const payload = await readTags()
    if (!supabase) {
      applyInsertLocal(payload)
      return
    }

    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('需要登录后才能上传到云端')

    const uid = user.id
    const ext = (file.name.match(/(\.[a-zA-Z0-9]+)$/)?.[1] || '').toLowerCase()
    const base = file.name.replace(/\.[^/.]+$/, '')
    const safeBase = base.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-')
    const finalBase = safeBase || `audio-${Date.now()}`
    const safeName = `${finalBase}${ext || '.mp3'}`
    const path = `${uid}/${Date.now()}-${safeName}`

    const up = await supabase.storage.from('audio').upload(path, file, {
      upsert: true,
      contentType: file.type || 'audio/mpeg',
      cacheControl: '3600',
    })
    if (up.error) throw new Error('上传到存储失败：' + up.error.message)

    const publicAudioUrl = supabase.storage.from('audio').getPublicUrl(path).data.publicUrl || null

    const { data: insert, error: insErr } = await supabase
      .from('songs')
      .insert({
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        storage_path: path,
        url: publicAudioUrl,
        is_public: true,
        tags: payload.tags || [],
        cover_url: (payload as any).cover_url || null,
      })
      .select()
      .single()

    if (insErr) throw new Error('写入数据库失败：' + insErr.message)

    if (insert) {
      setSongs(prev => [{ id: insert.id, title: insert.title, artist: insert.artist, album: insert.album, storage_path: insert.storage_path, url: insert.url || publicAudioUrl || undefined, tags: insert.tags || [], cover_storage_path: insert.cover_storage_path, cover_url: insert.cover_url }, ...prev])
    }
  }

  const removeSong = async (id: string) => {
    if (!supabase) {
      setSongs(prev => prev.filter(s => s.id !== id))
      return
    }
    const s = songs.find(x => x.id === id)
    if (s?.storage_path) await supabase.storage.from('audio').remove([s.storage_path])
    await supabase.from('songs').delete().eq('id', id)
    setSongs(prev => prev.filter(x => x.id !== id))
  }

  const createPlaylist = async (p: Omit<Playlist, 'id' | 'songs'>) => {
    if (!supabase) {
      const id = `pl-${Date.now()}`
      setPlaylists(prev => [{ id, songs: [], owner_id: 'local-user', ...p }, ...prev])
      return id
    }

    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('请先登录后再创建歌单')

    const { data, error } = await supabase
      .from('playlists')
      .insert({ name: p.name, description: p.description, is_public: p.is_public })
      .select('id, name, description, is_public, owner_id')
      .single()

    if (error || !data) throw new Error(error?.message || '创建歌单失败')

    setPlaylists(prev => [{ id: data.id, name: data.name, description: data.description, is_public: data.is_public, owner_id: data.owner_id || user.id, songs: [] }, ...prev])
    return data.id
  }

  const removePlaylist = async (playlistId: string) => {
    const target = playlists.find(p => p.id === playlistId)
    if (!target) return
    if (target.name === '已点赞歌曲') throw new Error('“已点赞歌曲”不能删除')

    if (supabase) {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('请先登录')
      if (target.owner_id && target.owner_id !== user.id) throw new Error('仅歌单拥有者可删除')
      await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId)
      const { error } = await supabase.from('playlists').delete().eq('id', playlistId)
      if (error) throw new Error(error.message)
    }

    setPlaylists(prev => prev.filter(p => p.id !== playlistId))
  }

  const addToPlaylist = async (playlistId: string, songId: string) => {
    const target = playlists.find(p => p.id === playlistId)
    if (!target) throw new Error('歌单不存在')
    if (target.name === '已点赞歌曲') {
      // 允许点赞歌单由系统逻辑写入
    }
    if (supabase) {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('请先登录')
      if (target.owner_id && target.owner_id !== user.id) throw new Error('仅歌单拥有者可编辑')
      await supabase.from('playlist_songs').insert({ playlist_id: playlistId, song_id: songId })
    }
    setPlaylists(prev => prev.map(pl => (pl.id === playlistId ? { ...pl, songs: pl.songs.includes(songId) ? pl.songs : [...pl.songs, songId] } : pl)))
  }

  const removeFromPlaylist = async (playlistId: string, songId: string) => {
    const target = playlists.find(p => p.id === playlistId)
    if (!target) throw new Error('歌单不存在')
    if (supabase) {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('请先登录')
      if (target.owner_id && target.owner_id !== user.id) throw new Error('仅歌单拥有者可编辑')
      await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId).eq('song_id', songId)
    }
    setPlaylists(prev => prev.map(pl => (pl.id === playlistId ? { ...pl, songs: pl.songs.filter(id => id !== songId) } : pl)))
  }

  const ensureLikedPlaylist = async () => {
    const name = '已点赞歌曲'
    const existing = playlists.find(p => p.name === name)
    if (existing) {
      if (supabase && existing.is_public) {
        await supabase.from('playlists').update({ is_public: false }).eq('id', existing.id)
      }
      setPlaylists(prev => prev.map(p => (p.id === existing.id ? { ...p, is_public: false } : p)))
      return existing.id
    }
    return await createPlaylist({ name, description: '你点赞的所有歌曲', is_public: false })
  }

  const isSongLiked = (songId: string) => {
    const lp = playlists.find(p => p.name === '已点赞歌曲')
    return !!lp && lp.songs.includes(songId)
  }

  const toggleLikeSong = async (songId: string) => {
    const pid = await ensureLikedPlaylist()
    const lp = playlists.find(p => p.id === pid)
    if (!lp) return
    if (lp.songs.includes(songId)) await removeFromPlaylist(pid, songId)
    else await addToPlaylist(pid, songId)
  }

  const searchSongs = async (q: string) => {
    if (musicSource === 'netease' && hasNetease) {
      const qq = q.trim() || '热门'
      const resp = await neteaseFetch(`/search?keywords=${encodeURIComponent(qq)}&type=1&limit=30`)
      if (!resp.ok) return []
      const j = await resp.json()
      const rows = j?.result?.songs || []
      let mapped = rows.map((r: any) => toNeteaseSong(r))

      const missingIds = mapped
        .filter((s: Song) => !s.cover_url)
        .map((s: Song) => s.id.replace('netease-', ''))
        .filter(Boolean)

      if (missingIds.length > 0) {
        try {
          const detailResp = await neteaseFetch(`/song/detail?ids=${encodeURIComponent(missingIds.slice(0, 60).join(','))}`)
          if (detailResp.ok) {
            const detailJson = await detailResp.json()
            const detailRows = Array.isArray(detailJson?.songs) ? detailJson.songs : []
            const coverMap = new Map<string, string>()
            for (const d of detailRows) {
              const id = String(d?.id || '')
              const cover = normalizeNeteaseCover(d?.al?.picUrl || d?.album?.picUrl || d?.picUrl)
              if (id && cover) coverMap.set(id, cover)
            }
            mapped = mapped.map((s: Song) => {
              if (s.cover_url) return s
              const cover = coverMap.get(s.id.replace('netease-', ''))
              return cover ? { ...s, cover_url: cover } : s
            })
          }
        } catch {}
      }

      setSongs(prev => {
        const m = new Map(prev.map(s => [s.id, s]))
        for (const s of mapped) m.set(s.id, { ...(m.get(s.id) || {}), ...s })
        return Array.from(m.values())
      })
      return mapped
    }

    if (supabase) {
      const { data } = await supabase.from('songs').select('*').or(`title.ilike.%${q}%,artist.ilike.%${q}%,album.ilike.%${q}%`)
      return (data || []).map(r => ({ id: r.id, title: r.title, artist: r.artist, album: r.album, storage_path: r.storage_path, tags: r.tags || [], cover_storage_path: r.cover_storage_path, cover_url: r.cover_url, lyrics: r.lyrics }))
    }
    const qq = q.trim().toLowerCase()
    return songs.filter(s => [s.title, s.artist, s.album, (s.tags || []).join(' ')].some(v => (v || '').toLowerCase().includes(qq)))
  }

  const recordHistory = (song: Song) => {
    setHistory(prev => [{ ...song }, ...prev].slice(0, 50))
  }

  const coverUrlCache = useRef<Map<string, { url: string; exp: number }>>(new Map())
  const getCoverUrl = async (path?: string) => {
    if (!supabase || !path) return null
    const cached = coverUrlCache.current.get(path)
    if (cached && cached.exp > Date.now()) return cached.url
    const { data, error } = await supabase.storage.from('covers').createSignedUrl(path, 60 * 60 * 24)
    if (error || !data?.signedUrl) return null
    coverUrlCache.current.set(path, { url: data.signedUrl, exp: Date.now() + 23 * 60 * 60 * 1000 })
    return data.signedUrl
  }

  const updateLyrics = async (id: string, lyrics: string) => {
    if (!id) return
    const normalizedLyrics = t2s(lyrics || '')

    if (id.startsWith('netease-') || !supabase) {
      setSongs(prev => {
        const idx = prev.findIndex(s => s.id === id)
        if (idx >= 0) return prev.map(s => (s.id === id ? { ...s, lyrics: normalizedLyrics } : s))
        return [{ id, title: id.replace('netease-', ''), lyrics: normalizedLyrics, tags: ['netease'] }, ...prev]
      })
      return
    }

    const { error } = await supabase.from('songs').update({ lyrics: normalizedLyrics }).eq('id', id)
    if (!error) setSongs(prev => prev.map(s => (s.id === id ? { ...s, lyrics: normalizedLyrics } : s)))
  }

  const autoFillSongMeta = async (id: string, opts?: { cover?: boolean; lyrics?: boolean }) => {
    const song = songs.find(s => s.id === id)
    if (!song) throw new Error('歌曲不存在')
    const title = (song.title || '').trim()
    const artist = (song.artist || '').trim()
    const album = (song.album || '').trim()
    if (!title) throw new Error('歌曲标题为空，无法自动补全')

    const fillCover = opts?.cover ?? true
    const fillLyrics = opts?.lyrics ?? true

    if (!fillLyrics && !fillCover) {
      return { cover: false, lyrics: false }
    }

    let foundLyrics = !!song.lyrics
    let foundCover = !!song.cover_url || !!song.cover_storage_path
    let lyricsText = song.lyrics || ''
    let coverUrl = song.cover_url || ''
    let coverStoragePath = song.cover_storage_path || ''
    let lyricsError = ''
    let coverError = ''

    const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        return await fetch(url, { signal: ctrl.signal })
      } finally {
        clearTimeout(t)
      }
    }

    if (fillLyrics) {
      if (musicSource === 'netease' && hasNetease && id.startsWith('netease-')) {
        try {
          const lyric = await fetchNeteaseLyricBySongId(id)
          if (lyric) {
            lyricsText = t2s(lyric)
            foundLyrics = true
          } else {
            lyricsError = '歌词接口返回为空'
          }
        } catch (e: any) {
          lyricsError = e?.name === 'AbortError' ? '歌词接口超时' : '歌词接口请求失败'
        }
      } else {
        try {
          const q = new URLSearchParams({ title, album, artist }).toString()
          const resp = await fetchWithTimeout(`/lrc/lyrics?${q}`, 15000)
          if (resp.ok) {
            const text = (await resp.text()).trim()
            if (text) {
              lyricsText = t2s(text)
              foundLyrics = true
            } else {
              lyricsError = '歌词接口返回为空'
            }
          } else {
            lyricsError = `歌词接口请求失败 (${resp.status})`
          }

          if (!foundLyrics) {
            const adv = await fetchWithTimeout(`/lrc/jsonapi?${q}`, 15000)
            if (adv.ok) {
              const arr = await adv.json()
              const pick = (Array.isArray(arr) ? arr : []).find((x: any) => typeof x?.lyrics === 'string' && x.lyrics.trim().length > 0)
              if (pick?.lyrics) {
                lyricsText = t2s(pick.lyrics)
                foundLyrics = true
                lyricsError = ''
              }
            } else {
              lyricsError = lyricsError || `歌词接口请求失败 (${adv.status})`
            }
          }
        } catch (e: any) {
          lyricsError = e?.name === 'AbortError' ? '歌词接口超时' : '歌词接口请求失败'
        }
      }
    }

    if (fillCover) {
      try {
        const q = new URLSearchParams({ title, album, artist }).toString()
        const resp = await fetchWithTimeout(`/lrc/cover/music?${q}`, 12000)
        if (resp.ok) {
          const j = await resp.json()
          const img = j?.img
          if (img && typeof img === 'string') {
            coverUrl = img
            foundCover = true
            coverStoragePath = ''
          } else {
            coverError = '封面接口返回为空'
          }
        } else {
          coverError = `封面接口请求失败 (${resp.status})`
        }
      } catch (e: any) {
        coverError = e?.name === 'AbortError' ? '封面接口超时' : '封面接口请求失败'
      }

      if (!foundCover && (title || album || artist)) {
        try {
          const q = new URLSearchParams({ title, album, artist }).toString()
          const resp = await fetchWithTimeout(`/lrc/cover/album?${q}`, 12000)
          if (resp.ok) {
            const j = await resp.json()
            const img = j?.img
            if (img && typeof img === 'string') {
              coverUrl = img
              foundCover = true
              coverStoragePath = ''
              coverError = ''
            }
          }
        } catch {}
      }
    }

    if (!foundLyrics && !foundCover) {
      const err = [lyricsError, coverError].filter(Boolean).join('；') || '未获取到歌词或封面'
      throw new Error(err)
    }

    if (supabase && !id.startsWith('netease-')) {
      const patch: any = {}
      if (foundLyrics) patch.lyrics = lyricsText
      if (foundCover) {
        patch.cover_storage_path = coverStoragePath || null
        patch.cover_url = coverUrl || null
      }
      const { error } = await supabase.from('songs').update(patch).eq('id', id)
      if (error) throw new Error('写入自动补全结果失败：' + error.message)
    }

    setSongs(prev => prev.map(s => {
      if (s.id !== id) return s
      return {
        ...s,
        lyrics: foundLyrics ? lyricsText : s.lyrics,
        cover_storage_path: foundCover ? (coverStoragePath || s.cover_storage_path) : s.cover_storage_path,
        cover_url: foundCover ? (coverUrl || '') : s.cover_url,
      }
    }))

    return { cover: foundCover, lyrics: foundLyrics }
  }

  const fetchHistory = async (page: number, pageSize: number) => {
    if (musicSource === 'netease' && hasNetease) {
      const start = page * pageSize
      const list = songs.slice(start, start + pageSize)
      return list.map((s, i) => ({
        id: `netease-h-${s.id}-${start + i}`,
        song_id: s.id,
        song: s,
        played_at: new Date(Date.now() - i * 60 * 1000).toISOString(),
        played_ms: 0,
        source: 'netease',
      }))
    }

    if (!supabase) {
      return history.slice(page * pageSize, (page + 1) * pageSize).map((s, i) => ({ id: `${s.id}-${i}`, song: s, song_id: s.id, played_at: new Date().toISOString(), played_ms: 0, source: 'local' }))
    }
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return []
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data } = await supabase
      .from('playback_history')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .range(from, to)
    return (data || []).map((x: any) => ({ ...x, source: 'cloud' }))
  }

  const value: DataCtx = useMemo(
    () => ({
      songs,
      playlists,
      history,
      musicSource,
      setMusicSource,
      neteaseProfile,
      neteaseQrImage,
      neteaseQrStatus,
      startNeteaseQrLogin,
      checkNeteaseQrLogin,
      logoutNetease,
      getNeteaseSongUrl,
      fetchNeteaseLyricBySongId,
      fetchNeteasePlaylists,
      fetchNeteasePlaylistTracks,
      loadMoreNeteaseSongs,
      fetchNeteasePage,
      prefetchNeteasePage,
      neteaseHasMore,
      dataSource,
      cloudLatencyMs,
      reloadCloudData: loadCloudData,
      uploadSong,
      removeSong,
      createPlaylist,
      removePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      searchSongs,
      recordHistory,
      fetchHistory,
      getCoverUrl,
      updateLyrics,
      autoFillSongMeta,
      ensureLikedPlaylist,
      isSongLiked,
      toggleLikeSong,
    }),
    [songs, playlists, history, musicSource, dataSource, cloudLatencyMs, neteaseProfile, neteaseQrImage, neteaseQrStatus, neteaseHasMore]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
