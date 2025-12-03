import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type AuthCtx = {
  user: any
  profile: any
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username?: string) => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (payload: { username?: string; avatar_url?: string }) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }){
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => { sub?.subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    (async () => {
      if (!supabase || !user) { setProfile(null); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(data || null)
    })()
  }, [user])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置 Supabase')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error){
      const msg = (error.message||'').toLowerCase()
      if (msg.includes('invalid login credentials')) throw new Error('密码错误')
      if (msg.includes('user not found')) throw new Error('用户不存在')
      throw new Error('登录失败：' + error.message)
    }
  }
  const signUp = async (email: string, password: string, username?: string) => {
    if (!supabase) throw new Error('未配置 Supabase')
    const opts: any = { data: { username }, emailRedirectTo: location.origin + '/login' }
    let attempt = 0, lastErr: any = null
    while (attempt < 3){
      attempt++
      const { data, error } = await supabase.auth.signUp({ email, password, options: opts })
      if (!error){
        return
      }
      lastErr = error
      await new Promise(r => setTimeout(r, 300 * attempt))
    }
    throw new Error('注册失败：' + (lastErr?.message || '未知错误'))
  }

  const refreshProfile = async () => {
    if (!supabase || !user) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(data || null)
  }

  const updateProfile = async (payload: { username?: string; avatar_url?: string }) => {
    if (!supabase || !user) return
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
    if (!error) await refreshProfile()
    else throw new Error(error.message)
  }

  return <Ctx.Provider value={{ user, profile, signIn, signUp, refreshProfile, updateProfile }}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}