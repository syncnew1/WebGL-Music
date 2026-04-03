import React from 'react'
import { usePlayer } from '../providers/PlayerProvider'
import { FaStepBackward as FaPrev, FaStepForward as FaNext, FaPlay, FaPause, FaRandom, FaHeart } from 'react-icons/fa'
import { MdRepeat, MdRepeatOne, MdQueueMusic, MdLyrics, MdGraphicEq, MdVolumeUp, MdVolumeOff } from 'react-icons/md'
import CoverImage from './CoverImage'
import { useData } from '../providers/DataProvider'
import Tooltip from './ui/Tooltip'
import VolumeControl from './ui/VolumeControl'

export default function PlayerControls(){
  const {
    isPlaying, play, pause, prev, next,
    progress, duration, seek,
    volume, rampVolume, muted, toggleMute,
    current, mode, setMode,
    playbackError,
    rightOpen, rightMode, openRight,
    centerOpen, openCenter,
    limiterEnabled, setLimiterEnabled,
  } = usePlayer()
  const { songs, isSongLiked, toggleLikeSong } = useData()

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
      {/* Left: Track info */}
      <div style={{display:'flex', alignItems:'center', gap:14, minWidth:0, overflow:'hidden'}} >
        <div className="album-thumb">
          {curSong?.cover_storage_path || curSong?.cover_url
            ? <div style={{width:'100%',height:'100%',overflow:'hidden',borderRadius:'inherit'}}><CoverImage path={curSong.cover_storage_path} url={curSong.cover_url} className="album-thumb" /></div>
            : <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#333 0%,#222 100%)',display:'flex',alignItems:'center',justifyContent:'center',color:'#666',fontSize:22}}>♪</div>
          }
        </div>
        <div style={{minWidth:0, flex:1, overflow:'hidden'}}>
          <div style={{fontSize:14,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text)'}}>
            {current?.title ?? <span style={{color:'var(--text-muted)'}}>未选择曲目</span>}
          </div>
          <div style={{fontSize:12,color:'var(--text-sub)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>
            {current?.artist ?? ''}
          </div>
        </div>
        <button
          style={{
            color: liked ? 'var(--accent)' : 'var(--text-muted)',
            flexShrink:0,
            transition:'color 150ms,transform 150ms',
            fontSize:16,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = liked ? 'var(--accent-bright)' : 'var(--text-sub)')}
          onMouseLeave={e => (e.currentTarget.style.color = liked ? 'var(--accent)' : 'var(--text-muted)')}
          onClick={async () => { if (current?.id) await toggleLikeSong(current.id) }}
        >
          <FaHeart />
        </button>
      </div>

      {/* Center: Controls + Progress */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,width:'100%'}}>
        {playbackError && (
          <div style={{fontSize:11,color:'#ff6b6b',background:'rgba(255,107,107,0.1)',padding:'2px 10px',borderRadius:4,marginBottom:4}}>
            {playbackError}
          </div>
        )}
        {/* Control buttons */}
        <div style={{display:'flex',alignItems:'center',gap:20}}>
          {/* Shuffle */}
          <Tooltip label={isShuffle ? '关闭随机' : '随机播放'}>
            <button
              className="btn-circle"
              style={{color: isShuffle ? 'var(--accent)' : 'var(--text-muted)', fontSize:16, position:'relative'}}
              onClick={() => setMode(isShuffle ? 'repeat-all' : 'shuffle')}
            >
              <FaRandom />
              {isShuffle && <span style={{position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:4,height:4,borderRadius:'50%',background:'var(--accent)',display:'block'}} />}
            </button>
          </Tooltip>
          {/* Prev */}
          <button className="btn-circle" style={{color:'var(--text-sub)',fontSize:18}} onClick={prev}><FaPrev /></button>
          {/* Play/Pause - big */}
          <button
            onClick={() => isPlaying ? pause() : play()}
            style={{
              width:40,height:40,borderRadius:'50%',
              background:'var(--text)',color:'#000',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:16,flexShrink:0,
              transition:'transform 120ms,background 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform='scale(1.06)')}
            onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}
          >
            {isPlaying ? <FaPause /> : <FaPlay style={{marginLeft:2}} />}
          </button>
          {/* Next */}
          <button className="btn-circle" style={{color:'var(--text-sub)',fontSize:18}} onClick={next}><FaNext /></button>
          {/* Repeat */}
          <Tooltip label={isRepeatOne ? '单曲循环' : '列表循环'}>
            <button
              className="btn-circle"
              style={{color: isRepeatOne ? 'var(--accent)' : mode==='repeat-all' ? 'var(--text-sub)' : 'var(--text-muted)', fontSize:18, position:'relative'}}
              onClick={() => setMode(isRepeatOne ? 'repeat-all' : 'repeat-one')}
            >
              {isRepeatOne ? <MdRepeatOne /> : <MdRepeat />}
              {isRepeatOne && <span style={{position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:4,height:4,borderRadius:'50%',background:'var(--accent)',display:'block'}} />}
            </button>
          </Tooltip>
        </div>
        {/* Progress bar */}
        <div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
          <span style={{fontSize:11,color:'var(--text-muted)',width:36,textAlign:'right',flexShrink:0}}>{fmt(progress)}</span>
          <div className="progress" onClick={handleSeek}>
            <div className="progress-fill" style={{width: pct + '%'}} />
            <div className="progress-thumb" style={{left: pct + '%'}} />
          </div>
          <span style={{fontSize:11,color:'var(--text-muted)',width:36,flexShrink:0}}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Right: Actions + Volume */}
      <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
        <Tooltip label="可视化">
          <button
            className="btn-circle"
            style={{color: centerOpen ? 'var(--accent)' : 'var(--text-muted)', fontSize:20}}
            onClick={openCenter}
          ><MdGraphicEq /></button>
        </Tooltip>
        <Tooltip label="播放队列">
          <button
            className="btn-circle"
            style={{color: rightOpen && rightMode==='queue' ? 'var(--accent)' : 'var(--text-muted)', fontSize:20}}
            onClick={() => openRight('queue')}
          ><MdQueueMusic /></button>
        </Tooltip>
        <Tooltip label="歌词">
          <button
            className="btn-circle"
            style={{color: rightOpen && rightMode==='lyrics' ? 'var(--accent)' : 'var(--text-muted)', fontSize:20}}
            onClick={() => openRight('lyrics')}
          ><MdLyrics /></button>
        </Tooltip>
        <VolumeControl onChangeVolume={rampVolume} onToggleMute={toggleMute} value={volume} muted={muted} />
      </div>
    </footer>
  )
}
