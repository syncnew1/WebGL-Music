import React from 'react'
import { NavLink } from 'react-router-dom'
import { useLayout } from '../providers/LayoutProvider'
import { MdHome, MdLibraryMusic, MdQueueMusic, MdPerson, MdSearch, MdChevronLeft, MdChevronRight, MdBuildCircle } from 'react-icons/md'

const SpotifyLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--accent)">
    <circle cx="12" cy="12" r="11"/>
    <path d="M8 7.5C10.5 9 14.5 9.5 17 9" stroke="#000" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M7 12C10 13.5 14.5 14 17.5 12.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M8 16.5C10.5 17.5 14 17.8 17 16.5" stroke="#000" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function NavSidebar(){
  const { leftOpen, toggleLeft } = useLayout() as any

  const navItems = [
    { to: '/',        icon: <MdHome size={22}/>,         label: '首页' },
    { to: '/search',  icon: <MdSearch size={22}/>,       label: '搜索' },
    { to: '/library', icon: <MdLibraryMusic size={22}/>,  label: '音乐库' },
    { to: '/playlists',icon:<MdQueueMusic size={22}/>,   label: '歌单' },
    { to: '/profile', icon: <MdPerson size={22}/>,        label: '个人中心' },
  ]

  return (
    <aside className="sidebar">
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center',
        justifyContent: leftOpen ? 'space-between' : 'center',
        padding: leftOpen ? '12px 4px 20px 12px' : '12px 0 20px',
        flexShrink:0,
      }}>
        {leftOpen && (
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <SpotifyLogo />
            <span style={{fontWeight:700,fontSize:15,letterSpacing:'-0.3px',color:'var(--text)',whiteSpace:'nowrap'}}>
              WebGL Music
            </span>
          </div>
        )}
        {!leftOpen && <SpotifyLogo />}
        {leftOpen && (
          <button
            onClick={toggleLeft}
            style={{color:'var(--text-muted)',padding:4,borderRadius:4,transition:'color 150ms',flexShrink:0}}
            onMouseEnter={e=>(e.currentTarget.style.color='var(--text)')}
            onMouseLeave={e=>(e.currentTarget.style.color='var(--text-muted)')}
          >
            <MdChevronLeft size={22}/>
          </button>
        )}
        {!leftOpen && (
          <button
            onClick={toggleLeft}
            style={{position:'absolute',right:-12,top:20,width:24,height:24,borderRadius:'50%',background:'var(--surface-2)',border:'1px solid var(--border-2)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-sub)',boxShadow:'var(--shadow-sm)'}}
          >
            <MdChevronRight size={16}/>
          </button>
        )}
      </div>

      {/* Nav items */}
      <div style={{display:'flex',flexDirection:'column',gap:2,flex:1}}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span className="label">{item.label}</span>
          </NavLink>
        ))}

        <div style={{height:1,background:'var(--border)',margin:'12px 8px'}}/>

        <NavLink to="/tools/batch-upload" className={({isActive}) => `nav-item${isActive?' active':''}`}>
          <MdBuildCircle size={22}/>
          <span className="label">批量上传</span>
        </NavLink>
      </div>
    </aside>
  )
}
