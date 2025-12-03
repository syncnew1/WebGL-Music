import React from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function SupabaseStatus(){
  if (isSupabaseConfigured()) return null
  return (
    <div className="text-xs text-muted" style={{padding:'6px 8px', background:'#2a2a2a', borderRadius:8}}>
      未检测到 Supabase 配置：请设置环境变量 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。
    </div>
  )
}