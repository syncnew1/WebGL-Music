import React from 'react'

export default function CoverImage({ path: _path, url, className }: { path?: string; url?: string; className?: string }) {
  const style = url
    ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined

  return (
    <div className={className || 'card-cover'} style={style}>
      {!url && <div className="text-xs text-muted p-2">被你发现啦！我们仍在努力获取这首歌的封面</div>}
    </div>
  )
}
