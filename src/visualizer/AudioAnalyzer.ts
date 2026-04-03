
export type FreqBand = {
  name: string; label: string; lo: number; hi: number
  color: string; instrument: string; energy: number; peak: number
}
export type InstrumentHit = {
  name: string; icon: string; energy: number
  angle: number; distance: number; color: string
}
export type HarmonyNote = {
  midi: number; name: string; octave: number; energy: number; cents: number
}
export type AnalysisFrame = {
  bands: FreqBand[]; instruments: InstrumentHit[]; harmony: HarmonyNote[]
  rms: number; lufs: number; spectralCentroid: number; spectralFlux: number
}

const BAND_DEFS: Omit<FreqBand,'energy'|'peak'>[] = [
  { name:'sub',        label:'超低频',  lo:20,    hi:60,    color:'#6b21a8', instrument:'低音鼓/次低音' },
  { name:'kick',       label:'踢鼓',    lo:60,    hi:120,   color:'#9333ea', instrument:'踢鼓/低音吉他' },
  { name:'bass',       label:'低音',    lo:120,   hi:250,   color:'#3b82f6', instrument:'贝斯/大提琴' },
  { name:'low-mid',    label:'低中频',  lo:250,   hi:500,   color:'#06b6d4', instrument:'钢琴低音/吉他' },
  { name:'mid',        label:'中频',    lo:500,   hi:1000,  color:'#10b981', instrument:'人声/吉他/钢琴' },
  { name:'upper-mid',  label:'中高频',  lo:1000,  hi:2000,  color:'#84cc16', instrument:'人声谐波/小提琴' },
  { name:'presence',   label:'临场感',  lo:2000,  hi:4000,  color:'#eab308', instrument:'打击乐/嗖音' },
  { name:'brilliance', label:'明亮度',  lo:4000,  hi:8000,  color:'#f97316', instrument:'镲/高音弦乐' },
  { name:'air',        label:'空气感',  lo:8000,  hi:16000, color:'#ef4444', instrument:'镲尾音/混响' },
  { name:'ultra',      label:'超高频',  lo:16000, hi:20000, color:'#ec4899', instrument:'极高泛音' },
]

const PROFILES = [
  { name:'踢鼓',   icon:'🥁', color:'#9333ea', bands:['kick','sub'],                          thr:0.30, isLow:true  },
  { name:'军鼓',   icon:'🪘', color:'#a855f7', bands:['mid','presence'],                      thr:0.28, isLow:false },
  { name:'贝斯',   icon:'🎸', color:'#3b82f6', bands:['bass','low-mid'],                      thr:0.28, isLow:true  },
  { name:'人声',   icon:'🎤', color:'#1db954', bands:['mid','upper-mid'],                     thr:0.32, isLow:false },
  { name:'钢琴',   icon:'🎹', color:'#06b6d4', bands:['low-mid','mid','presence'],           thr:0.22, isLow:false },
  { name:'吉他',   icon:'🪕', color:'#eab308', bands:['mid','upper-mid','presence'],         thr:0.25, isLow:false },
  { name:'小提琴', icon:'🎻', color:'#f97316', bands:['upper-mid','presence','brilliance'],  thr:0.22, isLow:false },
  { name:'镲',     icon:'✨', color:'#ef4444', bands:['brilliance','air','ultra'],           thr:0.18, isLow:false },
  { name:'合成器', icon:'🎛', color:'#ec4899', bands:['mid','upper-mid','brilliance'],       thr:0.18, isLow:false },
]

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export class AudioAnalyzer {
  private an: AnalyserNode
  private sr: number
  private freqBuf: Uint8Array<ArrayBuffer>
  private floatBuf: Float32Array<ArrayBuffer>
  private prevFreq: Float32Array<ArrayBuffer>
  private angleMap = new Map<string, number>()
  // Smoothed energy per instrument (EMA)
  private smoothE = new Map<string, number>()
  // Hold counter: frames to keep instrument visible after signal drops
  private holdCount = new Map<string, number>()
  private static readonly HOLD_FRAMES = 18   // ~300ms @60fps
  private static readonly SMOOTH_UP   = 0.35  // fast attack
  private static readonly SMOOTH_DOWN = 0.12  // slow decay

  constructor(an: AnalyserNode) {
    this.an = an
    this.sr = an.context.sampleRate
    this.freqBuf = new Uint8Array(new ArrayBuffer(an.frequencyBinCount))
    this.floatBuf = new Float32Array(new ArrayBuffer(an.fftSize * 4))
    this.prevFreq = new Float32Array(new ArrayBuffer(an.frequencyBinCount * 4))
  }

  private idx(hz: number) {
    return Math.round(hz / (this.sr / 2) * this.an.frequencyBinCount)
  }

  private bandEnergy(lo: number, hi: number): number {
    const i0 = Math.max(0, this.idx(lo))
    const i1 = Math.min(this.an.frequencyBinCount - 1, this.idx(hi))
    if (i1 <= i0) return 0
    let s = 0
    for (let i = i0; i <= i1; i++) s += this.freqBuf[i]
    return s / ((i1 - i0 + 1) * 255)
  }

  private computeRMS(): number {
    this.an.getFloatTimeDomainData(this.floatBuf)
    let s = 0
    for (const v of this.floatBuf) s += v * v
    return Math.sqrt(s / this.floatBuf.length)
  }

  private computeCentroid(): number {
    let ws = 0, ts = 0
    for (let i = 0; i < this.an.frequencyBinCount; i++) {
      const hz = i * this.sr / (2 * this.an.frequencyBinCount)
      ws += hz * this.freqBuf[i]; ts += this.freqBuf[i]
    }
    return ts > 0 ? ws / ts : 0
  }

  private computeFlux(): number {
    let f = 0
    for (let i = 0; i < this.an.frequencyBinCount; i++) {
      const d = this.freqBuf[i] - this.prevFreq[i]
      if (d > 0) f += d
    }
    return f / (this.an.frequencyBinCount * 255)
  }

  private detectHarmony(): HarmonyNote[] {
    const seen = new Set<number>()
    const notes: HarmonyNote[] = []
    for (let i = 1; i < this.an.frequencyBinCount; i++) {
      const e = this.freqBuf[i] / 255
      if (e < 0.12) continue
      const hz = i * this.sr / (2 * this.an.frequencyBinCount)
      if (hz < 60 || hz > 4200) continue
      const midi = Math.round(69 + 12 * Math.log2(hz / 440))
      if (midi < 21 || midi > 108 || seen.has(midi)) continue
      seen.add(midi)
      const ref = 440 * Math.pow(2, (midi - 69) / 12)
      notes.push({ midi, name: NOTES[midi % 12], octave: Math.floor(midi / 12) - 1, energy: e, cents: 1200 * Math.log2(hz / ref) })
    }
    return notes.sort((a, b) => b.energy - a.energy).slice(0, 7)
  }

  private detectInstruments(bands: FreqBand[]): InstrumentHit[] {
    const bmap = new Map(bands.map(b => [b.name, b.energy]))
    const hits: InstrumentHit[] = []
    for (const p of PROFILES) {
      const rawE = p.bands.reduce((s, b) => s + (bmap.get(b) ?? 0), 0) / p.bands.length
      // Exponential moving average: fast attack, slow decay
      const prev = this.smoothE.get(p.name) ?? 0
      const alpha = rawE > prev ? AudioAnalyzer.SMOOTH_UP : AudioAnalyzer.SMOOTH_DOWN
      const smoothed = prev + alpha * (rawE - prev)
      this.smoothE.set(p.name, smoothed)
      // Update hold counter
      if (rawE >= p.thr) {
        this.holdCount.set(p.name, AudioAnalyzer.HOLD_FRAMES)
      } else {
        const h = (this.holdCount.get(p.name) ?? 0) - 1
        this.holdCount.set(p.name, Math.max(0, h))
      }
      // Only emit if hold active or smoothed energy above threshold
      const hold = this.holdCount.get(p.name) ?? 0
      if (smoothed < p.thr * 0.25 && hold === 0) continue
      if (!this.angleMap.has(p.name)) {
        const side = Math.random() > 0.5 ? 1 : -1
        this.angleMap.set(p.name, p.isLow ? 0 : side * (20 + Math.random() * 60))
      }
      hits.push({
        name: p.name, icon: p.icon, energy: smoothed, color: p.color,
        angle: this.angleMap.get(p.name)!,
        distance: Math.max(0.08, Math.min(0.92, 1 - smoothed * 1.1)),
      })
    }
    return hits.sort((a, b) => b.energy - a.energy)
  }

  analyze(): AnalysisFrame {
    this.an.getByteFrequencyData(this.freqBuf)
    const bands = BAND_DEFS.map(b => ({ ...b, energy: this.bandEnergy(b.lo, b.hi), peak: 0 }))
    const rms = this.computeRMS()
    const flux = this.computeFlux()
    this.prevFreq.set(this.freqBuf)
    return {
      bands,
      instruments: this.detectInstruments(bands),
      harmony: this.detectHarmony(),
      rms,
      lufs: 20 * Math.log10(Math.max(rms, 1e-8)),
      spectralCentroid: this.computeCentroid(),
      spectralFlux: flux,
    }
  }
}
