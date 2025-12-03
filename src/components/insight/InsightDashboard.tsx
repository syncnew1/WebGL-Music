import React from 'react'
import { usePlayer } from '../../providers/PlayerProvider'
 
import AnimatedCanvas from './AnimatedCanvas'
import * as Dot from '../../visualizer/gl/dot'
import * as Particle from '../../visualizer/gl/particle'
import * as Blur from '../../visualizer/gl/blur'
import * as Finalize from '../../visualizer/gl/finalize'

function useRaf(fn: () => void, deps: any[]){
  React.useEffect(() => { let id = 0; const loop = () => { fn(); id = requestAnimationFrame(loop) }; id = requestAnimationFrame(loop); return () => cancelAnimationFrame(id) }, deps)
}

function SpectrumPanel({ analyser }: { analyser: AnalyserNode }){
  const ref = React.useRef<HTMLCanvasElement | null>(null)
  const buf = React.useRef<Uint8Array | null>(null)
  useRaf(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const w = c.width = c.clientWidth; const h = c.height = c.clientHeight
    if (!buf.current) buf.current = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(buf.current)
    ctx.clearRect(0,0,w,h)
    ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1.5
    ctx.beginPath()
    const n = buf.current.length
    for (let i=0;i<n;i++){
      const x = (i/(n-1))*w
      const y = h - (buf.current[i]/255)*h
      if (i===0) { ctx.moveTo(x,y) } else { ctx.lineTo(x,y) }
    }
    ctx.stroke()
  }, [analyser])
  return <div className="card" style={{height:220}}><div className="text-xs text-muted mb-1">Spectrum</div><canvas className="visualizer-canvas" ref={ref} style={{height:'180px'}} /></div>
}

function LevelsPanel({ analyser }: { analyser: AnalyserNode }){
  const ref = React.useRef<HTMLCanvasElement | null>(null)
  const timeL = React.useRef<Float32Array | null>(null)
  const timeR = React.useRef<Float32Array | null>(null)
  const capL = React.useRef<number>(0)
  const capR = React.useRef<number>(0)
  useRaf(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const w = c.width = c.clientWidth; const h = c.height = c.clientHeight
    if (!timeL.current) timeL.current = new Float32Array(analyser.fftSize)
    if (!timeR.current) timeR.current = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(timeL.current)
    analyser.getFloatTimeDomainData(timeR.current) // 浏览器同数据，作为近似
    const rms = (arr: Float32Array) => Math.sqrt(arr.reduce((s,v)=>s+v*v,0)/arr.length)
    const l = rms(timeL.current); const r = rms(timeR.current)
    capL.current = Math.max(capL.current*0.98, l)
    capR.current = Math.max(capR.current*0.98, r)
    ctx.clearRect(0,0,w,h)
    const drawBar = (x:number,val:number,label:string) => {
      const bw = Math.min(60, w/4)
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x,10,bw,h-20)
      const hh = (h-20)*Math.min(1,val*1.5)
      ctx.fillStyle = '#52c41a'; ctx.fillRect(x, h-10-hh, bw, hh)
      const ch = (h-20)*Math.min(1,(label==='L'?capL.current:capR.current)*1.5)
      ctx.fillStyle = '#faad14'; ctx.fillRect(x, h-10-ch, bw, 2)
      ctx.fillStyle = '#b3b3b3'; ctx.font = '12px system-ui'; ctx.fillText(label, x+4, h-4)
    }
    drawBar(w*0.35, l, 'L'); drawBar(w*0.55, r, 'R')
  }, [analyser])
  return <div className="card" style={{height:220}}><div className="text-xs text-muted mb-1">Levels</div><canvas className="visualizer-canvas" ref={ref} style={{height:'180px'}} /></div>
}

function LoudnessPanel({ analyser }: { analyser: AnalyserNode }){
  const ref = React.useRef<HTMLCanvasElement | null>(null)
  const buf = React.useRef<Float32Array | null>(null)
  const integ = React.useRef<number>(0)
  const frames = React.useRef<number>(0)
  useRaf(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const w = c.width = c.clientWidth; const h = c.height = c.clientHeight
    if (!buf.current) buf.current = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf.current)
    const rms = Math.sqrt(buf.current.reduce((s,v)=>s+v*v,0)/buf.current.length)
    const shortTerm = 20*Math.log10(rms+1e-8)
    integ.current += shortTerm; frames.current += 1
    const integrated = integ.current / frames.current
    const drawValue = (x:number,title:string,val:number,color:string) => {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x,10, w/3-20, h-20)
      ctx.fillStyle = color; ctx.font = '24px system-ui'; ctx.fillText(`${val.toFixed(1)} dB`, x+16, h/2)
      ctx.fillStyle = '#b3b3b3'; ctx.font = '12px system-ui'; ctx.fillText(title, x+16, 26)
    }
    ctx.clearRect(0,0,w,h)
    drawValue(10,'Short Term', shortTerm, '#52c41a')
    drawValue(w/3+10,'Integrated', integrated, '#ff4d4f')
    drawValue((2*w)/3+10,'Momentary', shortTerm, '#faad14')
  }, [analyser])
  return <div className="card" style={{height:160}}><div className="text-xs text-muted mb-1">Loudness</div><canvas className="visualizer-canvas" ref={ref} style={{height:'120px'}} /></div>
}

export default function InsightDashboard(){
  const { analyser, isPlaying } = usePlayer() as any
  if (!analyser) return null
  return (
    <div className="grid insight-dashboard" style={{gap:12}}>
      <LoudnessPanel analyser={analyser} />
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <LevelsPanel analyser={analyser} />
        <SpectrumPanel analyser={analyser} />
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Panel title="Dot">
          <AnimatedCanvas contextType={'webgl2'} onInit={Dot.init} onResize={Dot.resize} onRender={(ctx,d,s,t)=>Dot.render(ctx,{analyser},s)} style={{height:220}} data={{}} isEnabled={true} />
        </Panel>
        <Panel title="Particle">
          <AnimatedCanvas contextType={'webgl2'} onInit={Particle.init} onResize={Particle.resize} onRender={(ctx,d,s,t)=>Particle.render(ctx,{analyser, playing: isPlaying},s)} style={{height:220}} data={{}} isEnabled={true} />
        </Panel>
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Panel title="Bars">
          <AnimatedCanvas contextType={'webgl2'} onInit={Blur.init} onResize={Blur.resize} onRender={(ctx,d,s,t)=>Blur.render(ctx,{analyser},s)} style={{height:220}} data={{}} isEnabled={true} />
        </Panel>
        <Panel title="Waveform">
          <AnimatedCanvas contextType={'webgl2'} onInit={Finalize.init} onResize={Finalize.resize} onRender={(ctx,d,s,t)=>Finalize.render(ctx,{analyser},s)} style={{height:220}} data={{}} isEnabled={true} />
        </Panel>
      </div>
    </div>
  )
}

 

function Panel({ title, children }: { title: string; children: React.ReactNode }){
  return <div className="card" style={{height:240}}><div className="text-xs text-muted mb-1">{title}</div>{children}</div>
}