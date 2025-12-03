import React, { useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useNavigate } from 'react-router-dom'

export default function Signup(){
  const { signUp } = useAuth() as any
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isStrong = (p: string) => /(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}/.test(p)
  return (
    <div className="max-w-sm">
      <h2 className="text-xl font-semibold mb-3">注册 / 登录</h2>
      <input className="w-full px-4 py-2 mb-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="用户名" value={username} onChange={e=>setUsername(e.target.value)} />
      <input className="w-full px-4 py-2 mb-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="邮箱" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full px-4 py-2 mb-2 rounded-lg border border-borderc bg-[#151515] text-text" placeholder="密码" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="px-3 py-2 rounded-lg bg-accent text-black" onClick={async () => {
        console.log('signup submit')
        if (!isStrong(password)) { setMsg('密码需至少8位，包含大小写字母和数字'); return }
        setLoading(true); setError(''); setMsg('')
        try {
          await signUp(email, password, username)
          setMsg('验证邮件已发送至您的邮箱，请查收')
          setTimeout(() => nav('/login'), 1000)
        } catch (e:any) {
          setError(e?.message || '注册失败，可能为重复邮箱')
          setTimeout(() => setError(''), 3000)
        } finally { setLoading(false) }
      }}>提交</button>
      {loading && <div className="mt-2 text-xs text-muted">正在注册...</div>}
      {msg && <div className="mt-2 text-xs text-muted">{msg}</div>}
      {error && <div className="mt-2 text-xs" style={{color:'#ff4d4f'}}>{error}</div>}
      <div className="mt-2 text-xs text-muted">未配置 Supabase 将无法注册，仅登录逻辑测试</div>
    </div>
  )
}