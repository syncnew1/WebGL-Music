import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type Song = { id: string; title: string; artist?: string; album?: string; tags?: string[]; url?: string; storage_path?: string; cover_storage_path?: string; cover_url?: string; lyrics?: string }
export type Playlist = { id: string; name: string; description?: string; is_public?: boolean; songs: string[] }

type DataCtx = {
  songs: Song[]
  playlists: Playlist[]
  history: Song[]
  uploadSong: (file: File, meta: Partial<Song>) => Promise<void>
  removeSong: (id: string) => Promise<void>
  createPlaylist: (p: Omit<Playlist,'id'|'songs'>) => Promise<string>
  addToPlaylist: (playlistId: string, songId: string) => Promise<void>
  removeFromPlaylist: (playlistId: string, songId: string) => Promise<void>
  searchSongs: (q: string) => Promise<Song[]>
  recordHistory: (song: Song) => void
  fetchHistory: (page: number, pageSize: number) => Promise<any[]>
  getCoverUrl: (path?: string) => Promise<string | null>
  updateLyrics: (id: string, lyrics: string) => Promise<void>
  ensureLikedPlaylist: () => Promise<string>
  isSongLiked: (songId: string) => boolean
  toggleLikeSong: (songId: string) => Promise<void>
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }){
  const [songs, setSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [history, setHistory] = useState<Song[]>([])

  useEffect(() => {
    const load = async () => {
      if (supabase) {
        const { data: songRows } = await supabase.from('songs').select('*').order('created_at', { ascending: false })
        const { data: playlistRows } = await supabase.from('playlists').select('*').order('created_at', { ascending: false })
        setSongs((songRows || []).map(r => ({ id: r.id, title: r.title, artist: r.artist, album: r.album, tags: r.tags || [], storage_path: r.storage_path, url: r.url, cover_storage_path: r.cover_storage_path, cover_url: r.cover_url, lyrics: r.lyrics })))
        setPlaylists((playlistRows || []).map(p => ({ id: p.id, name: p.name, description: p.description, is_public: p.is_public, songs: [] })))
        for (const pl of playlistRows || []){
          const { data: rels } = await supabase.from('playlist_songs').select('song_id').eq('playlist_id', pl.id)
          const ids = (rels || []).map((x:any)=>x.song_id)
          setPlaylists(prev => prev.map(pp => pp.id === pl.id ? { ...pp, songs: ids } : pp))
        }
      }
    }
    load()
  }, [])

  const uploadSong = async (file: File, meta: Partial<Song>) => {
    const applyInsertLocal = (payload: Partial<Song>) => {
      const url = URL.createObjectURL(file)
      const s: Song = { id: `local-${Date.now()}`, title: payload.title || file.name, artist: payload.artist, album: payload.album, url, tags: payload.tags || [] }
      setSongs(prev => [s, ...prev])
    }
    const readTags = async () => {
      try {
        const mod = await import('jsmediatags/dist/jsmediatags.min.js') as any
        return await new Promise<Partial<Song>>((resolve) => {
          mod.default.read(file, {
            onSuccess: (tag: any) => {
              const t = tag.tags || {}
              resolve({ title: meta.title || t.title || file.name, artist: meta.artist || t.artist, album: meta.album || t.album, tags: [t.genre].filter(Boolean), cover_url: undefined })
            },
            onError: () => resolve({ title: meta.title || file.name, artist: meta.artist, album: meta.album })
          })
        })
      } catch { return { title: meta.title || file.name, artist: meta.artist, album: meta.album } }
    }
    const payload = await readTags()
    if (!supabase) { applyInsertLocal(payload); return }
    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('需要登录后才能上传到云端')
    const uid = user.id
    const ext = (file.name.match(/(\.[a-zA-Z0-9]+)$/)?.[1] || '').toLowerCase()
    const base = file.name.replace(/\.[^/.]+$/, '')
    const safeBase = base.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$|\./g, '$&')
    const finalBase = safeBase || `audio-${Date.now()}`
    const safeName = `${finalBase}${ext || '.mp3'}`
    const path = `${uid}/${Date.now()}-${safeName}`
    const up = await supabase.storage.from('audio').upload(path, file, { upsert: true, contentType: file.type || 'audio/mpeg', cacheControl: '3600' })
    if (up.error) throw new Error('上传到存储失败：' + up.error.message)
    let coverPath: string | undefined
    try {
      const mod = await import('jsmediatags/dist/jsmediatags.min.js') as any
      await new Promise<void>((resolve) => {
        mod.default.read(file, {
          onSuccess: async (tag: any) => {
            const pic = tag.tags?.picture
            if (pic && pic.data && pic.format) {
              const bytes = new Uint8Array(pic.data)
              const blob = new Blob([bytes], { type: pic.format })
              const coverSafe = `${finalBase}-cover.${pic.format.includes('png') ? 'png' : 'jpg'}`
              const coverKey = `${uid}/${Date.now()}-${coverSafe}`
              const up2 = await supabase.storage.from('covers').upload(coverKey, blob, { upsert: true, contentType: pic.format, cacheControl: '3600' })
              if (!up2.error) coverPath = coverKey
            }
            resolve()
          },
          onError: () => resolve()
        })
      })
    } catch {}
    const { data: insert, error: insErr } = await supabase.from('songs').insert({ title: payload.title, artist: payload.artist, album: payload.album, storage_path: path, tags: payload.tags || [], cover_storage_path: coverPath }).select().single()
    if (insErr) throw new Error('写入数据库失败：' + insErr.message)
    if (insert){
      setSongs(prev => [{ id: insert.id, title: insert.title, artist: insert.artist, album: insert.album, storage_path: insert.storage_path, tags: insert.tags || [], cover_storage_path: insert.cover_storage_path }, ...prev])
    }
  }

  const removeSong = async (id: string) => {
    if (!supabase) { setSongs(prev => prev.filter(s => s.id !== id)); return }
    const s = songs.find(x => x.id === id)
    if (s?.storage_path) await supabase.storage.from('audio').remove([s.storage_path])
    await supabase.from('songs').delete().eq('id', id)
    setSongs(prev => prev.filter(x => x.id !== id))
  }

  const createPlaylist = async (p: Omit<Playlist,'id'|'songs'>) => {
    if (!supabase){
      const id = `pl-${Date.now()}`
      setPlaylists(prev => [{ id, songs: [], ...p }, ...prev])
      return id
    }
    const { data } = await supabase.from('playlists').insert({ name: p.name, description: p.description, is_public: p.is_public }).select().single()
    setPlaylists(prev => [{ id: data.id, name: data.name, description: data.description, is_public: data.is_public, songs: [] }, ...prev])
    return data.id
  }

  const addToPlaylist = async (playlistId: string, songId: string) => {
    if (supabase) await supabase.from('playlist_songs').insert({ playlist_id: playlistId, song_id: songId })
    setPlaylists(prev => prev.map(pl => pl.id === playlistId ? { ...pl, songs: pl.songs.includes(songId) ? pl.songs : [...pl.songs, songId] } : pl))
  }

  const removeFromPlaylist = async (playlistId: string, songId: string) => {
    if (supabase) await supabase.from('playlist_songs').delete().eq('playlist_id', playlistId).eq('song_id', songId)
    setPlaylists(prev => prev.map(pl => pl.id === playlistId ? { ...pl, songs: pl.songs.filter(id => id !== songId) } : pl))
  }

  const ensureLikedPlaylist = async () => {
    const name = '已点赞歌曲'
    const existing = playlists.find(p => p.name === name)
    if (existing) return existing.id
    const id = await createPlaylist({ name, description: '你点赞的所有歌曲', is_public: false })
    return id
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
    if (supabase){
      const { data } = await supabase.from('songs').select('*').or(`title.ilike.%${q}%,artist.ilike.%${q}%,album.ilike.%${q}%`)
      return (data||[]).map(r => ({ id: r.id, title: r.title, artist: r.artist, album: r.album, storage_path: r.storage_path, tags: r.tags || [] }))
    }
    const qq = q.trim().toLowerCase()
    return songs.filter(s => [s.title, s.artist, s.album, (s.tags||[]).join(' ')].some(v => (v||'').toLowerCase().includes(qq)))
  }

  const recordHistory = (song: Song) => { setHistory(prev => [{...song}, ...prev].slice(0, 50)) }

  const getSignedUrl = async (path?: string) => {
    if (!supabase || !path) return null
    const { data, error } = await supabase.storage.from('audio').createSignedUrl(path, 60 * 60 * 24)
    if (error) return null
    return data?.signedUrl || null
  }

  const updateSongDuration = async (id: string, duration: number) => {
    if (!supabase || !id) return
    await supabase.from('songs').update({ duration }).eq('id', id)
  }

  const getCoverUrl = async (path?: string) => {
    if (!supabase || !path) return null
    const { data, error } = await supabase.storage.from('covers').createSignedUrl(path, 60 * 60 * 24)
    if (error) return null
    return data?.signedUrl || null
  }

  const updateLyrics = async (id: string, lyrics: string) => {
    if (!supabase || !id) return
    const { error } = await supabase.from('songs').update({ lyrics }).eq('id', id)
    if (!error) setSongs(prev => prev.map(s => s.id === id ? { ...s, lyrics } : s))
  }

  const fetchHistory = async (page: number, pageSize: number) => {
    if (!supabase){ return history.slice(page * pageSize, (page+1) * pageSize).map((s, i) => ({ id: `${s.id}-${i}`, song: s, played_at: new Date().toISOString(), played_ms: 0 })) }
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return []
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data } = await supabase.from('playback_history').select('*').eq('user_id', user.id).order('played_at', { ascending: false }).range(from, to)
    return data || []
  }

  const value: DataCtx = useMemo(() => ({ songs, playlists, history, uploadSong, removeSong, createPlaylist, addToPlaylist, removeFromPlaylist, searchSongs, recordHistory, fetchHistory, getCoverUrl, updateLyrics, ensureLikedPlaylist, isSongLiked, toggleLikeSong }), [songs, playlists, history])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}