import React from 'react'

type Props = {
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: Props) {
  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {children}
    </div>
  )
}
