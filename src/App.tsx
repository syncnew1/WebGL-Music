import React from 'react'
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
// removed right-panel visualizer; center uses InsightDashboard
import InsightDashboard from './components/insight/InsightDashboard'
import { usePlayer } from './providers/PlayerProvider'
import { useData } from './providers/DataProvider'
import LyricsPanel from './components/LyricsPanel'
import { useLayout } from './providers/LayoutProvider'

export default function App(){
  const { rightOpen, rightMode, closeRight, queue, current, centerOpen } = usePlayer() as any
  const { songs } = useData() as any
  const { leftOpen } = useLayout() as any
  return (
          <div className="app" data-left-open={leftOpen ? 'true' : 'false'} data-panel-open={rightOpen ? 'true' : 'false'} data-panel-mode={rightMode} style={{ ['--rpw' as any]: rightOpen ? '360px' : '0px', ['--lw' as any]: leftOpen ? '260px' : '64px' }}>
            <NavSidebar />
            <TopBar />
            <main className="content">
              {centerOpen && <InsightDashboard />}
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
            <div className="right-panel">
              {rightMode==='queue' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">播放队列</div>
                    <button className="btn" onClick={closeRight}>收起</button>
                  </div>
                  <div className="text-xs text-muted mb-2">当前播放</div>
                  {current ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="album-thumb" />
                      <div>
                        <div className="font-semibold">{current.title}</div>
                        <div className="text-xs text-muted">{current.artist ?? ''}</div>
                      </div>
                    </div>
                  ) : <div className="text-xs text-muted mb-4">暂无播放</div>}
                  <div className="text-xs text-muted mb-2">接下来</div>
                  <div className="space-y-2">
                    {queue.filter((q:any)=>!current || q.id!==current.id).map((item:any) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="album-thumb" />
                        <div>
                          <div className="font-semibold">{item.title}</div>
                          <div className="text-xs text-muted">{item.artist ?? ''}</div>
                        </div>
                      </div>
                    ))}
                    {queue.length<=1 && <div className="text-xs text-muted">队列为空</div>}
                  </div>
                </div>
              )}
              {rightMode==='lyrics' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">歌词</div>
                    <button className="btn" onClick={closeRight}>收起</button>
                  </div>
                  <LyricsPanel open={true} onClose={closeRight} inline={true} />
                </div>
              )}
            </div>
            <PlayerControls />
          </div>
  )
}