import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate, Link } from 'react-router-dom'

export default function Login() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    setStatus('正在验证账号...')

    try {
      await signIn(email.trim(), password)
      setStatus('登录成功，正在跳转...')
      const name = email.trim().split('@')[0]
      setTimeout(() => nav('/', { state: { message: `欢迎回来，${name}` } }), 300)
    } catch (e: any) {
      setError(e?.message || '登录失败')
      setTimeout(() => setError(''), 5000)
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
        <div className="page-kicker">Welcome Back</div>
        <h2 className="auth-title">欢迎回到你的声音宇宙</h2>
        <p className="auth-subtitle">进入 WebGL Music 控制台，在音乐、频谱与歌词之间继续你的沉浸式旅程。</p>

        <div className="auth-badge-row">
          <div className="auth-badge">实时频谱</div>
          <div className="auth-badge">沉浸歌词</div>
          <div className="auth-badge">私人播放队列</div>
        </div>

        <div className="auth-form">
          <input
            className="auth-input"
            placeholder="邮箱"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
            disabled={loading}
          />
          <input
            className="auth-input"
            placeholder="密码"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
            disabled={loading}
          />
          <button
            onClick={handleLogin}
            disabled={loading || !email.trim() || !password}
            className="auth-submit"
          >
            {loading ? '登录中...' : '进入工作台'}
          </button>
        </div>

        {status && <div className="auth-status">{status}</div>}
        {error && <div className="auth-error">{error}</div>}

        <div className="auth-switch">
          还没有账号？<Link to="/signup">立即注册</Link>
        </div>
      </div>
    </div>
  )
}
