import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { IconSearch } from './icons'
import Button from './ui/Button'
import { useNavigate } from 'react-router-dom'
import SupabaseStatus from './SupabaseStatus'

export default function TopBar(){
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')

  const goSearch = () => {
    nav('/search', { state: { q } })
  }

  return (
    <header className="topbar">
      <Button className="gap-1.5" onClick={goSearch}><IconSearch /> 搜索</Button>
      <input
        className="search-input"
        placeholder="搜索歌曲、歌手、专辑"
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') goSearch() }}
      />
      <SupabaseStatus />
      <div className="user-chip">
        <div className="w-5 h-5 rounded-full inline-block" style={{background: user ? '#36c36c' : '#3a3a3a'}}></div>
        <div style={{fontSize:12}}>{user ? (profile?.username || user?.user_metadata?.username || (user?.email||'').split('@')[0]) : '未登录'}</div>
        {user ? <Button onClick={() => nav('/profile')}>我的</Button> : <Button onClick={() => nav('/login')}>登录</Button>}
      </div>
    </header>
  )
}
