import React from 'react'
import { useData } from '../providers/DataProvider'

export default function CoverImage({ path, className }: { path?: string; className?: string }){
  const { } = useData()
  const [url, setUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    (async () => {
      try {
        const mod = await import('../providers/DataProvider')
        const m: any = mod
        if (path && m && m.useData) {
          const ctx = m.useData()
          if ((ctx as any).getCoverUrl) {
            const u = await (ctx as any).getCoverUrl(path)
            setUrl(u)
          }
        }
      } catch {}
    })()
  }, [path])
  const style = url ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  return (
    <div className={className || 'card-cover'} style={style}>
      {!url && <div className="text-xs text-muted p-2">被你发现啦！我们仍在努力获取这首歌的封面</div>}
    </div>
  )
}