import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>
export default function Input({ className = '', ...rest }: Props){
  return <input className={`search-input focus:outline-none focus:ring-2 focus:ring-accent/80 ${className}`} {...rest} />
}