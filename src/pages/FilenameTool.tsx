import React from 'react'

function parseSongName(name: string){
  const n = name.trim()
  const hy = n.indexOf('-')
  const dot = n.lastIndexOf('.')
  if (hy >= 0) {
    const end = dot > hy ? dot : n.length
    const s = n.slice(hy + 1, end).trim()
    return s || n
  }
  return dot > 0 ? n.slice(0, dot).trim() : n
}

export default function FilenameTool(){
  const [input, setInput] = React.useState('方大同-爱在.mp3')
  const [fileName, setFileName] = React.useState('')
  const result = parseSongName(fileName || input)
  const tests = [
    '方大同-爱在.mp3',
    'Artist-Track.name.v2.flac',
    'NoHyphenSong.mp3',
    '歌手-很长很长很长很长的歌名版本扩展.wav',
    'Artist-Track',
    'Artist-Track.name.ext.extra.mp3'
  ]
  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">文件名解析</h2>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <input className="search-input flex-1" placeholder="输入文件名，如 歌手-歌曲.扩展名" value={input} onChange={e=>setInput(e.target.value)} />
          <input type="file" accept="audio/*" onChange={e=>{ const f = e.target.files?.[0]; setFileName(f ? f.name : '') }} />
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted mb-2">解析结果</div>
          <div className="text-2xl font-semibold truncate break-words">{result || '格式不符'}</div>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="text-sm text-muted">测试用例</div>
        <div className="card-grid">
          {tests.map((t, i) => (
            <div className="card" key={i}>
              <div className="text-xs text-muted">{t}</div>
              <div className="text-lg font-semibold truncate break-words">{parseSongName(t)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}