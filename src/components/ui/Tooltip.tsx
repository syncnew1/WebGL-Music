import React from 'react'

type Props = { label: string; children: React.ReactNode }
export default function Tooltip({ label, children }: Props){
  const [show, setShow] = React.useState(false)
  const enterRef = React.useRef<number | null>(null)
  const leaveRef = React.useRef<number | null>(null)
  const onEnter = () => {
    if (leaveRef.current) { window.clearTimeout(leaveRef.current); leaveRef.current = null }
    enterRef.current = window.setTimeout(() => setShow(true), 300)
  }
  const onLeave = () => {
    if (enterRef.current) { window.clearTimeout(enterRef.current); enterRef.current = null }
    leaveRef.current = window.setTimeout(() => setShow(false), 200)
  }
  return (
    <span className="relative inline-flex" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      <span className={`tooltip ${show ? 'show' : ''}`}>{label}</span>
    </span>
  )
}