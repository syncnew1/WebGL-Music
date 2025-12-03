import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>
export default function IconButton({ className = '', ...rest }: Props){
  return <button className={`btn-circle hover:scale-105 active:scale-95 transition ${className}`} {...rest} />
}