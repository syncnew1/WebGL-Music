import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate } from 'react-router-dom'
import { MdSearch, MdPerson, MdLogin } from 'react-icons/md'
import SupabaseStatus from './SupabaseStatus'

export default function TopBar() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)

  const goSearch = () => { if (q.trim()) nav('/search', { state: { q } }) }

  const displayName = user
    ? (profile?.username || user?.user_metadata?.username || (user?.email || '').split('@')[0])
    : null

  return (
    <header className="topbar">
      {/* Search */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        background: focused ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${focused ? 'var(--border-2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-full)',
        padding: '0 14px', height: 38,
        transition: 'background 150ms, border-color 150ms, box-shadow 150ms',
        boxShadow: focused ? '0 0 0 3px var(--accent-glow)' : 'none',
        maxWidth: 480,
      }}>
        <MdSearch size={18} style={{
          color: focused ? 'var(--accent)' : 'var(--text-muted)',
          flexShrink: 0, transition: 'color 150ms',
        }} />
        <input
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
          }}
          placeholder="搜索歌曲、歌手、专辑"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter') goSearch() }}
        />
        {q && (
          <button onClick={() => setQ('')}
            style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, transition: 'color 120ms' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >×</button>
        )}
      </div>

      <div style={{ flex: 1 }} />
      <SupabaseStatus />

      {/* User chip */}
      <div className="user-chip" onClick={() => nav(user ? '/profile' : '/login')}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: user
            ? 'linear-gradient(135deg, var(--accent) 0%, var(--rose) 100%)'
            : 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {user
            ? <span style={{ color: '#000', fontWeight: 700, fontSize: 11 }}>
                {(displayName || '?')[0].toUpperCase()}
              </span>
            : <MdPerson size={14} style={{ color: 'var(--text-muted)' }} />
          }
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: user ? 'var(--text)' : 'var(--text-muted)' }}>
          {user ? displayName : '未登录'}
        </span>
        {!user && <MdLogin size={14} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />}
      </div>
    </header>
  )
}
