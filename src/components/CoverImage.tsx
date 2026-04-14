import React from 'react'

export default function CoverImage({ path: _path, url, className }: { path?: string; url?: string; className?: string }) {
  const [ok, setOk] = React.useState(!!url)

  React.useEffect(() => {
    setOk(!!url)
  }, [url])

  return (
    <div className={className || 'card-cover'}>
      {url && ok ? (
        <img
          src={url}
          alt="cover"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="text-xs text-muted p-2">被你发现啦！我们仍在努力获取这首歌的封面</div>
      )}
    </div>
  )
}
