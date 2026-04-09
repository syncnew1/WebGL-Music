import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate, Link } from 'react-router-dom'

export default function Signup() {
  const { signUp } = useAuth() as any
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [msg, setMsg] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isStrong = (p: string) => /(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}/.test(p)

  const handleSignup = async () => {
    if (!isStrong(password)) {
      setMsg('密码需至少8位，包含大小写字母和数字')
      return
    }
    setLoading(true)
    setStatus('正在创建账号...')
    setError('')
    setMsg('')
    try {
      await signUp(email, password, username)
      setStatus('注册成功，正在跳转...')
      setTimeout(() => nav('/login'), 800)
    } catch (e: any) {
      setError(e?.message || '注册失败，可能为重复邮箱')
      setTimeout(() => setError(''), 3000)
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-green" />
      <div className="auth-orb auth-orb-blue" />

      <div className="auth-card">
        <div className="page-kicker">Create Account</div>
        <h2 className="auth-title">创建账号</h2>
        <p className="auth-subtitle">加入你的沉浸式音乐可视化空间，开始建立属于你的播放工作台。</p>

        <div className="auth-form">
          <input className="auth-input" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} disabled={loading} />
          <input className="auth-input" placeholder="邮箱" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
          <input className="auth-input" placeholder="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && handleSignup()} disabled={loading} />
          <button className="auth-submit" onClick={handleSignup} disabled={loading || !email.trim() || !password || !username.trim()}>{loading ? '注册中...' : '注册'}</button>
        </div>

        {status && <div className="auth-status">{status}</div>}
        {msg && <div className="auth-status">{msg}</div>}
        {error && <div className="auth-error">{error}</div>}

        <div className="auth-switch">已有账号？<Link to="/login">立即登录</Link></div>
        <div className="auth-note">未配置 Supabase 时无法注册</div>
      </div>
    </div>
  )
}
