import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="max-w-sm">
      <h2 className="text-xl font-semibold mb-3">登录</h2>
      <input className="w-full px-4 py-2 mb-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full px-4 py-2 mb-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="密码" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="px-3 py-2 rounded-lg bg-accent text-black" onClick={async () => {
        console.log('login submit')
        setLoading(true)
        setError('')
        try {
          await signIn(email, password)
          const name = email.split('@')[0]
          nav('/', { state: { message: `欢迎回来，${name}` } })
        } catch (e:any) {
          setError(e?.message || '登录失败')
          setTimeout(() => setError(''), 3000)
        } finally { setLoading(false) }
      }}>登录</button>
      {loading && <div className="mt-2 text-xs text-muted">正在登录...</div>}
      {error && <div className="mt-2 text-xs" style={{color:'#ff4d4f'}}>{error}</div>}
      <div className="mt-2 text-xs text-muted">未配置 Supabase 将无法登录，但界面可用</div>
    </div>
  )
}