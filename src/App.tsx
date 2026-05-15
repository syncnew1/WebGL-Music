import React, { lazy, Suspense, useEffect } from 'react'
import NavSidebar from './components/NavSidebar'
import TopBar from './components/TopBar'
import PlayerControls from './components/PlayerControls'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
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
import Gallery3D from './pages/Gallery3D'
import Visualizer from './pages/Visualizer'
const InsightDashboard = lazy(() => import('./components/insight/InsightDashboard'))
import { usePlayer } from './providers/PlayerProvider'
import LyricsPanel from './components/LyricsPanel'
import { useLayout } from './providers/LayoutProvider'
import Button from './components/ui/Button'
import FloatingAIAssistant from './components/FloatingAIAssistant'
import BackgroundVisualizer from './components/BackgroundVisualizer'

export default function App(){
  const { rightOpen, rightMode, closeRight, queue, current, centerOpen, play } = usePlayer()
  const { leftOpen } = useLayout()
  const navigate = useNavigate()
  const location = useLocation()

  // 全局 F 键直达 / 退出全屏可视化
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (location.pathname.startsWith('/visualizer')) return // 由 Visualizer 自己处理
        e.preventDefault()
        navigate('/visualizer')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, location.pathname])

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
      <BackgroundVisualizer />

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
          <Route path="/gallery-3d" element={<Gallery3D />} />
          <Route path="/visualizer" element={<Visualizer />} />
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
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--accent)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{current.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-sub)', marginTop:2 }}>{current.artist ?? ''}</div>
                </div>
              ) : <div style={{ fontSize:13, color:'var(--text-muted)' }}>暂无播放</div>}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
              {(() => {
                const curIdx = current ? queue.findIndex((q:any) => q.id === current.id) : -1
                const upcoming = curIdx >= 0 ? queue.slice(curIdx + 1) : queue
                return (
                  <>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', padding:'8px 8px 4px' }}>
                      接下来 · {upcoming.length} 首
                    </div>
                    {upcoming.map((item:any, i:number) => (
                      <div key={item.id} onClick={() => play(item)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 8px', borderRadius:10, cursor:'pointer', transition:'background 150ms, border-color 150ms', border:'1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='var(--border)' }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent' }}>
                        <span style={{ width:20, textAlign:'right', fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>{i+1}</span>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize:11, color:'var(--text-sub)', marginTop:1 }}>{item.artist ?? ''}</div>
                        </div>
                      </div>
                    ))}
                    {upcoming.length === 0 && <div style={{ padding:'24px 8px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>队列已到末尾</div>}
                  </>
                )
              })()}
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
      <FloatingAIAssistant />
    </div>
  )
}
