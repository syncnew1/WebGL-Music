import React from 'react'
import { NavLink } from 'react-router-dom'
import { useLayout } from '../providers/LayoutProvider'
import { MdHome, MdLibraryMusic, MdQueueMusic, MdPerson, MdSearch, MdChevronLeft, MdChevronRight, MdBuildCircle } from 'react-icons/md'

const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <defs>
      <linearGradient id="logo-g" x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#31c27c" />
        <stop offset="100%" stopColor="#4e6ef2" />
      </linearGradient>
    </defs>
    <rect width="30" height="30" rx="9" fill="url(#logo-g)" />
    <path d="M10 20V13l11-3.5v9" stroke="#0a1020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="8" cy="20" r="3" fill="#0a1020" />
    <circle cx="19" cy="17" r="3" fill="#0a1020" />
  </svg>
)

export default function NavSidebar() {
  const { leftOpen, toggleLeft } = useLayout() as any

  const navItems = [
    { to: '/',          icon: <MdHome size={20} />,         label: '首页' },
    { to: '/search',    icon: <MdSearch size={20} />,       label: '搜索' },
    { to: '/library',   icon: <MdLibraryMusic size={20} />, label: '音乐库' },
    { to: '/playlists', icon: <MdQueueMusic size={20} />,   label: '歌单' },
    { to: '/profile',   icon: <MdPerson size={20} />,       label: '个人中心' },
  ]

  return (
    <aside className="sidebar">
      {/* Logo header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: leftOpen ? 'space-between' : 'center',
        padding: leftOpen ? '14px 4px 22px 10px' : '14px 0 22px',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        {leftOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo />
            <span style={{
              fontFamily: 'Righteous, sans-serif',
              fontSize: 15, letterSpacing: '0.05em',
              color: '#e8eaf0',
              whiteSpace: 'nowrap',
            }}>WebGL Music</span>
          </div>
        ) : <Logo />}

        {leftOpen ? (
          <button onClick={toggleLeft} style={{
            color: 'var(--text-muted)', padding: 4, borderRadius: 6,
            transition: 'color 150ms, background 150ms', flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(49,194,124,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          ><MdChevronLeft size={20} /></button>
        ) : (
          <button onClick={toggleLeft} style={{
            position: 'absolute', right: -12, top: 18,
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--surface-2)', border: '1px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-sub)', boxShadow: 'var(--shadow-sm)',
            transition: 'background 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
          ><MdChevronRight size={14} /></button>
        )}
      </div>

      {/* Section label */}
      {leftOpen && (
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          padding: '0 12px 8px', position: 'relative', zIndex: 1,
        }}>导航</div>
      )}

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, position: 'relative', zIndex: 1 }}>
        {navItems.map(item => (
          <NavLink
            key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span className="label">{item.label}</span>
          </NavLink>
        ))}

        <div style={{ height: 1, background: 'var(--border)', margin: '10px 8px' }} />

        {leftOpen && (
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
            padding: '0 12px 8px',
          }}>工具</div>
        )}

        <NavLink to="/tools/batch-upload" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <MdBuildCircle size={20} />
          <span className="label">批量上传</span>
        </NavLink>
      </div>

      {leftOpen && (
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', textAlign: 'center',
          padding: '8px 0 4px', letterSpacing: '0.06em',
          position: 'relative', zIndex: 1,
        }}>v0.1.0</div>
      )}
    </aside>
  )
}
