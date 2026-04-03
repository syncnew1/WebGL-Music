import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type AuthCtx = {
  user: any
  profile: any
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (payload: { username?: string; avatar_url?: string }) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setUser(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      setUser(session?.user ?? null)
    })
    return () => { alive = false; sub?.subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setProfile(null); return }
    ;(async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        setProfile(data || null)
      } catch {
        setProfile(null)
      }
    })()
  }, [user])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置 Supabase')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) throw new Error('邮箱或密码错误')
        if (msg.includes('user not found')) throw new Error('用户不存在')
        if (msg.includes('email not confirmed')) throw new Error('邮箱未验证，请查收验证邮件')
        throw new Error('登录失败：' + error.message)
      }
      setUser(data.session?.user ?? data.user ?? null)
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('timeout')) {
        throw new Error('网络无法连接到 Supabase，请检查网络/VPN 后重试')
      }
      throw e
    }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    if (!supabase) throw new Error('未配置 Supabase')
    const opts: any = { data: { username } }

    try {
      const timeoutMs = 30000
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('注册超时，请检查网络或稍后重试')), timeoutMs)
      })

      const result = await Promise.race([
        supabase.auth.signUp({ email: email.trim(), password, options: opts }),
        timeoutPromise,
      ])

      const { error } = result as any
      if (error) throw new Error('注册失败：' + error.message)
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase()
      if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('timeout')) {
        throw new Error('网络无法连接到 Supabase，请检查网络/VPN 后重试')
      }
      throw e
    }
  }

  const signOut = async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: 'local' })
    } catch (_) {
      // 忽略网络错误，强制本地清除
    } finally {
      setUser(null)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (!supabase || !user) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(data || null)
  }

  const updateProfile = async (payload: { username?: string; avatar_url?: string }) => {
    if (!supabase || !user) throw new Error('未登录')
    // 用 upsert 确保没有记录时也能创建
    const { error } = await supabase.from('profiles').upsert(
      { id: user.id, ...payload },
      { onConflict: 'id' }
    )
    if (error) throw new Error('保存失败：' + error.message)
    await refreshProfile()
  }

  return (
    <Ctx.Provider value={{ user, profile, signIn, signUp, signOut, refreshProfile, updateProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
