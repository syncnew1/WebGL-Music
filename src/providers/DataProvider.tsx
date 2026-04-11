import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Converter } from 'opencc-js/t2cn'
import { supabase } from '../lib/supabaseClient'

export type Song = { id: string; title: string; artist?: string; album?: string; tags?: string[]; url?: string; storage_path?: string; cover_storage_path?: string; cover_url?: string; lyrics?: string; owner_id?: string }
export type Playlist = { id: string; name: string; description?: string; is_public?: boolean; owner_id?: string; songs: string[] }

type DataCtx = {
  songs: Song[]
  playlists: Playlist[]
  history: Song[]
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

  useEffect(() => {
    try { localStorage.setItem('wm:songs', JSON.stringify(songs)) } catch {}
  }, [songs])

  useEffect(() => {
    try { localStorage.setItem('wm:playlists', JSON.stringify(playlists)) } catch {}
  }, [playlists])

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
    if (!supabase || !id) return
    const normalizedLyrics = t2s(lyrics || '')
    const { error } = await supabase.from('songs').update({ lyrics: normalizedLyrics }).eq('id', id)
    if (!error) setSongs(prev => prev.map(s => (s.id === id ? { ...s, lyrics: normalizedLyrics } : s)))
  }

  const traditionalHintChars = new Set(Array.from('們這個為來時會後發說對於與讓還點開關種麼裡愛聽樂畫體雲無線國專業號風實現應用設計系統資料庫廣場車門燈變當氣萬東葉龍圖書層數據網頁聲音視頻藝術'))
  const scoreSimplifiedPreference = (text: string) => {
    let traditionalHits = 0
    let simplifiedHits = 0
    for (const ch of text) {
      if (traditionalHintChars.has(ch)) traditionalHits += 1
      if (/^[\u4e00-\u9fff]$/.test(ch) && !traditionalHintChars.has(ch)) simplifiedHits += 1
    }
    return simplifiedHits - traditionalHits * 4
  }

  const pickPreferredLyrics = (items: any[]) => {
    const candidates = (Array.isArray(items) ? items : [])
      .map(item => {
        const lyrics = item?.syncedLyrics || item?.plainLyrics
        if (!lyrics || typeof lyrics !== 'string') return null
        const text = lyrics.replace(/\[[^\]]+\]/g, '')
        return {
          lyrics,
          score: scoreSimplifiedPreference(text),
          hasSynced: typeof item?.syncedLyrics === 'string' && item.syncedLyrics.length > 0,
          length: text.trim().length,
        }
      })
      .filter(Boolean) as { lyrics: string; score: number; hasSynced: boolean; length: number }[]

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.hasSynced !== b.hasSynced) return Number(b.hasSynced) - Number(a.hasSynced)
      return b.length - a.length
    })

    return candidates[0]?.lyrics || ''
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

    if (supabase) {
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
    if (!supabase) {
      return history.slice(page * pageSize, (page + 1) * pageSize).map((s, i) => ({ id: `${s.id}-${i}`, song: s, played_at: new Date().toISOString(), played_ms: 0 }))
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
    return data || []
  }

  const value: DataCtx = useMemo(
    () => ({
      songs,
      playlists,
      history,
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
    [songs, playlists, history, dataSource, cloudLatencyMs]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
