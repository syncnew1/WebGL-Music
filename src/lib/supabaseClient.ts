import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || (import.meta.env as any).REACT_APP_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env as any).REACT_APP_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
;(window as any).supabaseClientAvailable = !!(url && key)

export const isSupabaseConfigured = () => !!(url && key)