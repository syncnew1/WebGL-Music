import React from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useData } from '../providers/DataProvider'
import Button from './ui/Button'

export default function SupabaseStatus() {
  const { dataSource, cloudLatencyMs, reloadCloudData } = useData()

  if (!isSupabaseConfigured()) {
    return (
      <div className="status-chip">
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div className={`status-chip ${dataSource === 'cloud' ? 'status-chip--accent' : ''}`}>
        {label}
      </div>
      <Button style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => reloadCloudData()}>
        刷新云端
      </Button>
    </div>
  )
}
