import React from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer, useProgress } from '../providers/PlayerProvider'
import { FaStepBackward as FaPrev, FaStepForward as FaNext, FaPlay, FaPause, FaRandom, FaHeart } from 'react-icons/fa'
import { MdRepeat, MdRepeatOne, MdQueueMusic, MdLyrics, MdGraphicEq, MdAutoAwesome, MdFullscreen, MdInsights } from 'react-icons/md'
import CoverImage from './CoverImage'
import { useData } from '../providers/DataProvider'
import Tooltip from './ui/Tooltip'
import VolumeControl from './ui/VolumeControl'
import MiniSpectrum from './MiniSpectrum'

const menuItemStyle = (): React.CSSProperties => ({
  display:'flex', alignItems:'center', gap:10,
  width:'100%',
  padding:'9px 10px',
  borderRadius:10,
  background:'transparent',
  border:'1px solid transparent',
  color:'var(--text)',
  cursor:'pointer',
  textAlign:'left',
  transition:'background 150ms, border-color 150ms',
})
const menuIconStyle = (bg: string, color: string): React.CSSProperties => ({
  width:30, height:30, borderRadius:8, flexShrink:0,
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  background: bg, color,
})
const menuHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
  e.currentTarget.style.borderColor = 'var(--border)'
}
const menuHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'transparent'
  e.currentTarget.style.borderColor = 'transparent'
}

export default function PlayerControls(){
  const {
    isPlaying, play, pause, prev, next,
    seek,
    volume, rampVolume, muted, toggleMute,
    current, mode, setMode,
    playbackError,
    rightOpen, rightMode, openRight,
    centerOpen, openCenter, closeCenter,
    smartQueueEnabled, toggleSmartQueue,
  } = usePlayer()
  const { progress, duration } = useProgress()
  const { songs, isSongLiked, toggleLikeSong } = useData()
  const navigate = useNavigate()
  const [visMenuOpen, setVisMenuOpen] = React.useState(false)
  const visMenuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!visMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!visMenuRef.current) return
      if (!visMenuRef.current.contains(e.target as Node)) setVisMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') setVisMenuOpen(false) }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [visMenuOpen])

  const pct = duration ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0
  const curSong = React.useMemo(() => songs.find((s:any) => s.id === current?.id), [songs, current?.id])
  const liked = React.useMemo(() => current?.id ? isSongLiked(current.id) : false, [isSongLiked, current?.id, songs])

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seek(((e.clientX - rect.left) / rect.width) * duration)
  }

  const isShuffle = mode === 'shuffle'
  const isRepeatOne = mode === 'repeat-one'

  return (
    <footer className="playerbar">
      <div style={{
        position:'absolute',
        left:0, right:0,
        bottom:'100%',
        height:96,
        pointerEvents:'none',
        opacity:0.9,
        maskImage:'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0) 100%)',
      }}>
        <MiniSpectrum height={96} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, minWidth:0, overflow:'hidden' }}>
        <div className="album-thumb">
          {curSong?.cover_storage_path || curSong?.cover_url
            ? <div style={{ width:'100%', height:'100%', overflow:'hidden', borderRadius:'inherit' }}><CoverImage path={curSong.cover_storage_path} url={curSong.cover_url} className="album-thumb" /></div>
            : <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,var(--surface-2) 0%,var(--surface-3) 100%)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:22 }}>♪</div>}
        </div>
        <div style={{ minWidth:0, flex:1, overflow:'hidden' }}>
          <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>
            {current?.title ?? <span style={{ color:'var(--text-muted)' }}>未选择曲目</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--text-sub)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>
            {current?.artist ?? '等待播放'}
          </div>
        </div>
        <button
          style={{ color: liked ? 'var(--accent)' : 'var(--text-muted)', flexShrink:0, transition:'color 150ms,transform 150ms', fontSize:16 }}
          onMouseEnter={e => (e.currentTarget.style.color = liked ? 'var(--accent-bright)' : 'var(--text-sub)')}
          onMouseLeave={e => (e.currentTarget.style.color = liked ? 'var(--accent)' : 'var(--text-muted)')}
          onClick={async () => { if (current?.id) await toggleLikeSong(current.id) }}
        >
          <FaHeart />
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:'100%' }}>
        {playbackError && <div className="status-chip status-chip--danger">{playbackError}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <Tooltip label={isShuffle ? '关闭随机' : '随机播放'}>
            <button className="btn-circle" style={{ color: isShuffle ? 'var(--accent)' : 'var(--text-muted)', fontSize:16, position:'relative' }} onClick={() => setMode(isShuffle ? 'repeat-all' : 'shuffle')}>
              <FaRandom />
              {isShuffle && <span style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'var(--accent)', display:'block' }} />}
            </button>
          </Tooltip>
          <button className="btn-circle" style={{ color:'var(--text-sub)', fontSize:18 }} onClick={prev}><FaPrev /></button>
          <button onClick={() => isPlaying ? pause() : play()} style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%)', color:'#03110a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0, boxShadow:'0 0 22px rgba(49,194,124,0.28)', transition:'transform 120ms, box-shadow 120ms' }} onMouseEnter={e => { e.currentTarget.style.transform='scale(1.06)'; e.currentTarget.style.boxShadow='0 0 28px rgba(49,194,124,0.40)' }} onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 22px rgba(49,194,124,0.28)' }}>
            {isPlaying ? <FaPause /> : <FaPlay style={{ marginLeft:2 }} />}
          </button>
          <button className="btn-circle" style={{ color:'var(--text-sub)', fontSize:18 }} onClick={next}><FaNext /></button>
          <Tooltip label={isRepeatOne ? '单曲循环' : '列表循环'}>
            <button className="btn-circle" style={{ color: isRepeatOne ? 'var(--accent)' : mode==='repeat-all' ? 'var(--text-sub)' : 'var(--text-muted)', fontSize:18, position:'relative' }} onClick={() => setMode(isRepeatOne ? 'repeat-all' : 'repeat-one')}>
              {isRepeatOne ? <MdRepeatOne /> : <MdRepeat />}
              {isRepeatOne && <span style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)', width:4, height:4, borderRadius:'50%', background:'var(--accent)', display:'block' }} />}
            </button>
          </Tooltip>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
          <span style={{ fontSize:11, color:'var(--text-muted)', width:36, textAlign:'right', flexShrink:0 }}>{fmt(progress)}</span>
          <div className="progress" onClick={handleSeek}>
            <div className="progress-fill" style={{ width: pct + '%' }} />
            <div className="progress-thumb" style={{ left: pct + '%' }} />
          </div>
          <span style={{ fontSize:11, color:'var(--text-muted)', width:36, flexShrink:0 }}>{fmt(duration)}</span>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
        <Tooltip label={smartQueueEnabled ? '智能队列：开启' : '智能队列：关闭'}>
          <button className="btn-circle" style={{ color: smartQueueEnabled ? 'var(--accent)' : 'var(--text-muted)', fontSize:18 }} onClick={toggleSmartQueue}><MdAutoAwesome /></button>
        </Tooltip>
        <div ref={visMenuRef} style={{ position:'relative' }}>
          <Tooltip label="可视化菜单">
            <button
              className="btn-circle"
              style={{
                color: (visMenuOpen || centerOpen) ? 'var(--accent)' : 'var(--text-muted)',
                fontSize:20,
                position:'relative',
              }}
              onClick={() => setVisMenuOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={visMenuOpen}
            >
              <MdGraphicEq />
            </button>
          </Tooltip>
          {visMenuOpen && (
            <div
              role="menu"
              style={{
                position:'absolute',
                bottom:'calc(100% + 10px)',
                right:0,
                width:240,
                padding:6,
                borderRadius:14,
                background:'rgba(14,19,34,0.96)',
                border:'1px solid var(--border-2)',
                boxShadow:'0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(49,194,124,0.06)',
                backdropFilter:'blur(14px)',
                zIndex:200,
              }}
            >
              <div style={{ padding:'8px 10px 6px', fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-muted)' }}>可视化</div>
              <button
                className="cursor-pointer"
                onClick={() => { setVisMenuOpen(false); if (centerOpen) closeCenter(); navigate('/visualizer') }}
                style={menuItemStyle()}
                onMouseEnter={menuHoverIn}
                onMouseLeave={menuHoverOut}
              >
                <span style={menuIconStyle('rgba(49,194,124,0.18)','var(--accent-bright)')}><MdFullscreen size={18} /></span>
                <span style={{ display:'grid', gap:2, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>全屏可视化</span>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>沉浸模式 · 快捷键 F</span>
                </span>
              </button>
              <button
                className="cursor-pointer"
                onClick={() => { setVisMenuOpen(false); if (centerOpen) closeCenter(); else openCenter() }}
                style={menuItemStyle()}
                onMouseEnter={menuHoverIn}
                onMouseLeave={menuHoverOut}
              >
                <span style={menuIconStyle('rgba(168,85,247,0.18)','#c4a3ff')}><MdInsights size={18} /></span>
                <span style={{ display:'grid', gap:2, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{centerOpen ? '关闭音频分析' : '音频分析面板'}</span>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>频段 / 节拍 / 和声 / 乐器</span>
                </span>
              </button>
            </div>
          )}
        </div>
        <Tooltip label="播放队列">
          <button className="btn-circle" style={{ color: rightOpen && rightMode==='queue' ? 'var(--accent)' : 'var(--text-muted)', fontSize:20 }} onClick={() => openRight('queue')}><MdQueueMusic /></button>
        </Tooltip>
        <Tooltip label="歌词">
          <button className="btn-circle" style={{ color: rightOpen && rightMode==='lyrics' ? 'var(--accent)' : 'var(--text-muted)', fontSize:20 }} onClick={() => openRight('lyrics')}><MdLyrics /></button>
        </Tooltip>
        <VolumeControl onChangeVolume={rampVolume} onToggleMute={toggleMute} value={volume} muted={muted} />
      </div>
    </footer>
  )
}
