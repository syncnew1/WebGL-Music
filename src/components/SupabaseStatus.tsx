import React from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useData } from '../providers/DataProvider'

export default function SupabaseStatus() {
  const { dataSource, cloudLatencyMs, reloadCloudData } = useData()

  if (!isSupabaseConfigured()) {
    return (
      <div className="text-xs text-muted" style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 8 }}>
        未检测到 Supabase 配置：请设置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。
      </div>
    )
  }

  const label =
    dataSource === 'loading'
      ? '数据源：加载中…'
      : dataSource === 'cloud'
      ? `数据源：云端${cloudLatencyMs != null ? ` · ${cloudLatencyMs}ms` : ''}`
      : '数据源：本地缓存（云端不可用）'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="text-xs text-muted" style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 8 }}>
        {label}
      </div>
      <button className="btn" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => reloadCloudData()}>
        刷新云端
      </button>
    </div>
  )
}
