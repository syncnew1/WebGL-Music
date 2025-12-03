import React, { useRef } from 'react'
import { usePlayer } from '../providers/PlayerProvider'
import { FaStepBackward as FaPrev, FaStepForward as FaNext, FaPlay, FaPause, FaRandom, FaHeart } from 'react-icons/fa'
import { MdRepeat, MdQueueMusic, MdLyrics } from 'react-icons/md'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import QueuePanel from './QueuePanel'
import LyricsPanel from './LyricsPanel'
import CoverImage from './CoverImage'
import { useData } from '../providers/DataProvider'
import Tooltip from './ui/Tooltip'
import { MdGraphicEq } from 'react-icons/md'
import VolumeControl from './ui/VolumeControl'

export default function PlayerControls(){
  const { isPlaying, play, pause, prev, next, progress, duration, seek, volume, setVolume, rampVolume, muted, toggleMute, current, mode, setMode, playbackError, rightOpen, rightMode, openRight, centerOpen, openCenter, limiterEnabled, setLimiterEnabled } = usePlayer() as any
  const { songs, isSongLiked, toggleLikeSong } = useData() as any
  const pct = duration ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0
  const volPct = Math.min(100, Math.max(0, volume * 100))
  const uiToGain = (ui:number) => { const dB = -60 + 60*Math.pow(ui,2); return Math.pow(10,dB/20) }
  const volDb = (():string => { const g = uiToGain(volume); const db = 20*Math.log10(Math.max(1e-6,g)); return `${db.toFixed(1)} dB` })()
  const curSong = React.useMemo(() => songs.find((s:any)=>s.id===current?.id), [songs, current?.id])
  const liked = React.useMemo(() => current?.id ? isSongLiked(current.id) : false, [isSongLiked, current?.id, songs])
  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    return `${m}:${ss.toString().padStart(2,'0')}`
  }
  return (
    <footer className="playerbar">
      {playbackError && <div className="text-xs text-muted" style={{gridColumn:'1/3', padding:'4px 8px', background:'#2a2a2a', borderRadius:8}}>音频链接生成失败：{playbackError}</div>}
      <div className="flex items-center gap-4">
        <div className="album-thumb" style={{overflow:'hidden', borderRadius:8}}>
          {curSong?.cover_storage_path ? <CoverImage path={curSong.cover_storage_path} className="w-16 h-16" /> : <div className="w-16 h-16 rounded-lg bg-[#2a2a2a]"></div>}
        </div>
        <div>
          <div className="font-semibold">{current?.title ?? '未选择曲目'}</div>
          <div className="text-xs text-muted flex items-center gap-2">
            <span>{current?.artist ?? ''}</span>
            <button className={`btn-circle hover:scale-105 active:scale-95 transition ${liked ? 'bg-accent text-black' : ''}`} onClick={async () => { if (current?.id) await toggleLikeSong(current.id) }}><FaHeart /></button>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-3 justify-center">
          <button className={`btn-circle hover:scale-105 active:scale-95 transition ${mode==='shuffle' ? 'text-accent' : ''}`} onClick={() => setMode(mode==='shuffle' ? 'repeat-all' : 'shuffle')}><FaRandom /></button>
          <IconButton onClick={prev}><FaPrev /></IconButton>
          {isPlaying ? <IconButton onClick={pause}><FaPause /></IconButton> : <IconButton onClick={() => play()}><FaPlay /></IconButton>}
          <IconButton onClick={next}><FaNext /></IconButton>
          <button className={`btn-circle hover:scale-105 active:scale-95 transition ${mode==='repeat-one' ? 'text-accent' : ''}`} onClick={() => setMode(mode==='repeat-one' ? 'repeat-all' : 'repeat-one')}><MdRepeat /></button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{fmt(progress)}</span>
          <div className="flex-1 progress" onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = (e as any).clientX - rect.left
            const ratio = x / rect.width
            seek(ratio * duration)
          }}>
            <div style={{width: pct + '%'}}></div>
          </div>
          <span>{fmt(duration)}</span>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 justify-end">
          <Tooltip label="可视化">
            <button className={`btn-circle hover:scale-105 active:scale-95 transition ${centerOpen ? 'bg-accent text-black' : ''}`} onClick={() => openCenter()}><MdGraphicEq className="icon" /></button>
          </Tooltip>
          <Tooltip label="播放队列">
            <button className={`btn-circle hover:scale-105 active:scale-95 transition ${rightOpen && rightMode==='queue' ? 'bg-accent text-black' : ''}`} onClick={() => openRight('queue')}><MdQueueMusic className="icon" /></button>
          </Tooltip>
          <Tooltip label="歌词">
            <button className={`btn-circle hover:scale-105 active:scale-95 transition ${rightOpen && rightMode==='lyrics' ? 'bg-accent text-black' : ''}`} onClick={() => openRight('lyrics')}><MdLyrics className="icon" /></button>
          </Tooltip>
          <VolumeControl onChangeVolume={rampVolume} onToggleMute={toggleMute} value={volume} muted={muted} />
          <button className={`btn ${limiterEnabled ? 'bg-accent text-black' : ''}`} style={{padding:'8px 10px'}} onClick={() => setLimiterEnabled && setLimiterEnabled(!limiterEnabled)}>限幅器</button>
        </div>
      </div>
      
    </footer>
  )
}
