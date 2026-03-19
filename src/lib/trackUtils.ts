import type { Song } from '../providers/DataProvider'

// 将 Song 对象转换为播放器所需的 Track 格式，消除各页面重复代码
export function toTrack(s: Song) {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    url: s.url,
    storage_path: s.storage_path,
  }
}
