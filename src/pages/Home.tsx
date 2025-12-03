import React from 'react'
import { useLocation } from 'react-router-dom'
import ContentGrid from '../components/ContentGrid'

export default function Home(){
  const loc = useLocation() as any
  const [tip, setTip] = React.useState<string>('')
  React.useEffect(() => {
    if (loc?.state?.message){
      setTip(loc.state.message)
      setTimeout(() => setTip(''), 3000)
    }
  }, [loc?.state?.message])
  return (
    <div className="grid gap-4">
      {tip && <div className="text-xs" style={{padding:'6px 8px', background:'#2a2a2a', borderRadius:8}}>{tip}</div>}
      <h2 className="text-xl font-semibold">为你推荐</h2>
      <ContentGrid />
    </div>
  )
}