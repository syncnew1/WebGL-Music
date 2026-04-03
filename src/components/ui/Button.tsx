import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
}

export default function Button({ variant = 'ghost', className = '', ...rest }: Props) {
  const variantClass = variant === 'primary' ? 'btn-primary' : ''
  return <button className={`btn ${variantClass} ${className}`} {...rest} />
}
