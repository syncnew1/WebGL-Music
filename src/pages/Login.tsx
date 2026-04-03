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

    const timeoutMs = 30000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('登录超时，请检查网络或稍后重试')), timeoutMs)
    })

    try {
      await Promise.race([signIn(email.trim(), password), timeoutPromise])
      setStatus('登录成功，正在跳转...')
      const name = email.trim().split('@')[0]
      nav('/', { state: { message: `欢迎回来，${name}` } })
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
        <h2 className="auth-title">欢迎回来</h2>
        <p className="auth-subtitle">登录后继续你的 WebGL 音乐旅程</p>

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
            {loading ? '登录中...' : '登录'}
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
