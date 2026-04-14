import React from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useData } from '../providers/DataProvider'
import { useNavigate } from 'react-router-dom'
import { MdPerson, MdLogin } from 'react-icons/md'
import SupabaseStatus from './SupabaseStatus'

export default function TopBar() {
  const { user, profile } = useAuth()
  const {
    musicSource,
    setMusicSource,
    neteaseProfile,
    neteaseQrImage,
    neteaseQrStatus,
    startNeteaseQrLogin,
    checkNeteaseQrLogin,
    logoutNetease,
  } = useData()
  const nav = useNavigate()

  const displayName = user
    ? (profile?.username || user?.user_metadata?.username || (user?.email || '').split('@')[0])
    : null

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>WebGL Music</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(20,28,46,0.72)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>音源</span>
            <button
              onClick={() => setMusicSource('cloud')}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: musicSource === 'cloud' ? 'var(--accent)' : 'transparent', color: musicSource === 'cloud' ? '#04150f' : 'var(--text-muted)' }}
            >
              云端
            </button>
            <button
              onClick={() => setMusicSource('netease')}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 999, background: musicSource === 'netease' ? 'var(--accent)' : 'transparent', color: musicSource === 'netease' ? '#04150f' : 'var(--text-muted)' }}
            >
              网易云
            </button>
          </div>

          {musicSource === 'netease' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(20,28,46,0.72)' }}>
              {neteaseProfile ? (
                <>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>网易云：{neteaseProfile.nickname}</span>
                  <button onClick={logoutNetease} style={{ fontSize: 11, color: 'var(--text-muted)' }}>退出</button>
                </>
              ) : (
                <>
                  <button onClick={() => void startNeteaseQrLogin()} style={{ fontSize: 11, color: 'var(--text)' }}>扫码登录</button>
                  {neteaseQrImage && <button onClick={() => void checkNeteaseQrLogin()} style={{ fontSize: 11, color: 'var(--text-muted)' }}>检查状态</button>}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{neteaseQrStatus}</span>
                </>
              )}
            </div>
          )}

          {musicSource === 'netease' && neteaseQrImage && !neteaseProfile && (
            <div style={{ position: 'fixed', right: 24, top: 76, zIndex: 60, width: 180, padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(9,13,24,0.96)', boxShadow: 'var(--shadow)' }}>
              <img src={neteaseQrImage} alt="网易云扫码登录" style={{ width: '100%', borderRadius: 8 }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>{neteaseQrStatus}</div>
            </div>
          )}

          {musicSource === 'cloud' && <SupabaseStatus />}
          <div className="user-chip" onClick={() => nav(user ? '/profile' : '/login')}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: user ? 'linear-gradient(135deg, var(--accent) 0%, var(--rose) 100%)' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: user ? '0 0 16px rgba(49,194,124,0.22)' : 'none' }}>
              {user
                ? <span style={{ color: '#000', fontWeight: 800, fontSize: 11 }}>{(displayName || '?')[0].toUpperCase()}</span>
                : <MdPerson size={14} style={{ color: 'var(--text-muted)' }} />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: user ? 'var(--text)' : 'var(--text-muted)' }}>
              {user ? displayName : '未登录'}
            </span>
            {!user && <MdLogin size={14} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />}
          </div>
        </div>
      </div>
    </header>
  )
}
