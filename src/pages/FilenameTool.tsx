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
    <div className="grid gap-5">
      <section className="page-hero">
        <div className="page-hero-inner grid gap-4">
          <div className="page-header">
            <div className="page-heading">
              <div className="page-kicker">Filename Tool</div>
              <h2 className="page-title">文件名解析</h2>
              <p className="page-subtitle">快速从文件名中提取歌曲标题，辅助上传流程中的基础元信息预处理。</p>
            </div>
            <div className="status-chip status-chip--accent">即时解析</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input className="search-input flex-1" placeholder="输入文件名，如 歌手-歌曲.扩展名" value={input} onChange={e => setInput(e.target.value)} />
            <label style={{ cursor:'pointer' }}><span className="btn">选择文件</span><input type="file" accept="audio/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; setFileName(f ? f.name : '') }} /></label>
          </div>
        </div>
      </section>

      <div className="panel-shell" style={{ padding: 24 }}>
        <div className="page-kicker" style={{ marginBottom: 10 }}>Result</div>
        <div className="text-sm text-muted mb-2">解析结果</div>
        <div className="page-title" style={{ fontSize: 26 }}>{result || '格式不符'}</div>
      </div>

      <div className="page-heading">
        <div className="page-kicker">Examples</div>
        <h3 className="page-title" style={{ fontSize: 24 }}>测试用例</h3>
      </div>
      <div className="card-grid">
        {tests.map((t, i) => (
          <div className="card" key={i}>
            <div className="text-xs text-muted">{t}</div>
            <div className="text-lg font-semibold truncate break-words">{parseSongName(t)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
