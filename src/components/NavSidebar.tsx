import React from 'react'
import { NavLink } from 'react-router-dom'
import { IconHome, IconLibrary, IconPlaylist, IconUser } from './icons'
import { useLayout } from '../providers/LayoutProvider'
import { MdChevronLeft, MdChevronRight } from 'react-icons/md'

export default function NavSidebar(){
  const { leftOpen, toggleLeft } = useLayout() as any
  return (
    <aside className="sidebar space-y-1">
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-transparent">
        <div className="font-bold">WebGL Music</div>
        <button className={`btn-circle ${leftOpen ? 'bg-accent text-black' : ''}`} onClick={toggleLeft} aria-label={leftOpen ? '收起侧边栏' : '展开侧边栏'}>
          {leftOpen ? <MdChevronLeft /> : <MdChevronRight />}
        </button>
      </div>
      <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''} transition hover:translate-x-0.5`}><IconHome /><span className="label"> 首页</span></NavLink>
      <NavLink to="/library" className={({isActive}) => `nav-item ${isActive ? 'active' : ''} transition hover:translate-x-0.5`}><IconLibrary /><span className="label"> 音乐库</span></NavLink>
      <NavLink to="/playlists" className={({isActive}) => `nav-item ${isActive ? 'active' : ''} transition hover:translate-x-0.5`}><IconPlaylist /><span className="label"> 歌单</span></NavLink>
      <NavLink to="/profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''} transition hover:translate-x-0.5`}><IconUser /><span className="label"> 个人中心</span></NavLink>
    </aside>
  )
}