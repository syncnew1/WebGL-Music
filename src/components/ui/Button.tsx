import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }
export default function Button({ variant = 'ghost', className = '', ...rest }: Props){
  const base = 'btn hover:scale-[1.02] active:scale-[0.98] transition'
  const style = variant === 'primary' ? 'bg-accent text-black' : ''
  return <button className={`${base} ${style} ${className}`} {...rest} />
}