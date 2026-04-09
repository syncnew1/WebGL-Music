import React, { lazy, Suspense } from 'react'
import NavSidebar from './components/NavSidebar'
import TopBar from './components/TopBar'
import PlayerControls from './components/PlayerControls'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Search from './pages/Search'
import Library from './pages/Library'
import Playlist from './pages/Playlist'
import Playlists from './pages/Playlists'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Signup from './pages/Signup'
import FilenameTool from './pages/FilenameTool'
import BatchUpload from './pages/BatchUpload'
const InsightDashboard = lazy(() => import('./components/insight/InsightDashboard'))
import { usePlayer } from './providers/PlayerProvider'
import LyricsPanel from './components/LyricsPanel'
import { useLayout } from './providers/LayoutProvider'
import Button from './components/ui/Button'

export default function App(){
  const { rightOpen, rightMode, closeRight, queue, current, centerOpen, play } = usePlayer()
  const { leftOpen } = useLayout()

  return (
    <div
      className="app"
      data-left-open={leftOpen ? 'true' : 'false'}
      data-panel-open={rightOpen ? 'true' : 'false'}
      data-panel-mode={rightMode}
      style={{
        ['--rpw' as any]: rightOpen ? '340px' : '0px',
        ['--lw' as any]: leftOpen ? '240px' : '72px',
      }}
    >
      <NavSidebar />
      <TopBar />

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/playlists/:id" element={<Playlist />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/tools/filename" element={<FilenameTool />} />
          <Route path="/tools/batch-upload" element={<BatchUpload />} />
        </Routes>
      </main>

      {centerOpen && (
        <div style={{ position:'fixed', top:'var(--topbar-h, 64px)', left:leftOpen ? '240px' : '72px', right:rightOpen ? '340px' : 0, bottom:'var(--playerbar-h, 90px)', overflowY:'auto', padding:24, zIndex:35, background:'linear-gradient(180deg, rgba(9,13,24,0.98) 0%, rgba(8,11,20,0.98) 100%)', transition:'left 200ms,right 200ms' }}>
          <Suspense fallback={<div style={{ color:'var(--text-muted)', padding:24, fontSize:13 }}>加载中…</div>}>
            <InsightDashboard />
          </Suspense>
        </div>
      )}

      <div className="right-panel">
        {rightMode === 'queue' && (
          <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 16px 12px', flexShrink:0, borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'grid', gap:4 }}>
                <span style={{ fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--text-muted)' }}>Queue</span>
                <span style={{ fontSize:16, fontWeight:700 }}>播放队列</span>
              </div>
              <Button onClick={closeRight}>关闭</Button>
            </div>

            <div style={{ padding:'12px 16px', flexShrink:0, borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>正在播放</div>
              {current ? (
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:6, background:'linear-gradient(135deg,var(--surface) 0%,var(--surface-2) 100%)', flexShrink:0, overflow:'hidden' }} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{current.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-sub)', marginTop:2 }}>{current.artist ?? ''}</div>
                  </div>
                </div>
              ) : <div style={{ fontSize:13, color:'var(--text-muted)' }}>暂无播放</div>}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'8px 8px 4px' }}>
                接下来 · {queue.filter((q:any) => !current || q.id !== current.id).length} 首
              </div>
              {queue.filter((q:any) => !current || q.id !== current.id).map((item:any, i:number) => (
                <div key={item.id} onClick={() => play(item)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 8px', borderRadius:10, cursor:'pointer', transition:'background 150ms, border-color 150ms', border:'1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='var(--border)' }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent' }}>
                  <span style={{ width:20, textAlign:'right', fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>{i+1}</span>
                  <div style={{ width:36, height:36, borderRadius:6, background:'var(--surface)', flexShrink:0 }}></div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize:11, color:'var(--text-sub)', marginTop:1 }}>{item.artist ?? ''}</div>
                  </div>
                </div>
              ))}
              {queue.filter((q:any) => !current || q.id !== current.id).length === 0 && <div style={{ padding:'24px 8px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>队列为空</div>}
            </div>
          </div>
        )}

        {rightMode === 'lyrics' && (
          <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 16px 12px', flexShrink:0, borderBottom:'1px solid var(--border)', background:'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)' }}>
              <div style={{ display:'grid', gap:4 }}>
                <span style={{ fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--text-muted)' }}>Lyrics</span>
                <span style={{ fontSize:16, fontWeight:700 }}>歌词</span>
              </div>
              <Button onClick={closeRight}>关闭</Button>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              <LyricsPanel open={true} onClose={closeRight} inline={true} />
            </div>
          </div>
        )}
      </div>

      <PlayerControls />
    </div>
  )
}
