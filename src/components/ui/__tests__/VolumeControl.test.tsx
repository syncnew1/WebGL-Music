import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import VolumeControl from '../VolumeControl'
import { PlayerProvider } from '../../../providers/PlayerProvider'

const wrap = (ui: React.ReactNode) => render(<PlayerProvider>{ui}</PlayerProvider>)

afterEach(() => cleanup())

describe('VolumeControl', () => {
  it('click sets volume ratio', () => {
    const ramp = vi.fn()
    const { getByRole } = wrap(<VolumeControl onChangeVolume={ramp} value={0.2} muted={false} />)
    const slider = getByRole('slider')
    const rect = { left: 0, width: 200 } as any
    Object.defineProperty(slider, 'getBoundingClientRect', { value: () => rect })
    fireEvent.click(slider, { clientX: 100 })
    expect(ramp).toHaveBeenCalled()
    const last = ramp.mock.calls.pop()
    expect(last[0]).toBeCloseTo(0.5, 2)
  })

  it('drag updates volume', () => {
    const ramp = vi.fn()
    const { getByRole } = wrap(<VolumeControl onChangeVolume={ramp} value={0.3} muted={false} />)
    const slider = getByRole('slider')
    const rect = { left: 0, width: 250 } as any
    Object.defineProperty(slider, 'getBoundingClientRect', { value: () => rect })
    fireEvent.mouseDown(slider, { clientX: 50 })
    fireEvent.mouseMove(window, { clientX: 200 })
    fireEvent.mouseUp(window)
    expect(ramp).toHaveBeenCalled()
    const last = ramp.mock.calls.pop()
    expect(last[0]).toBeCloseTo(0.8, 2)
  })

  it('keyboard adjusts and m toggles mute', () => {
    const ramp = vi.fn()
    const toggle = vi.fn()
    const { getByRole } = wrap(<VolumeControl onChangeVolume={ramp} onToggleMute={toggle} value={0.4} muted={false} />)
    const slider = getByRole('slider')
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(ramp).toHaveBeenCalled()
    const last = ramp.mock.calls.pop()
    expect(last[0]).toBeCloseTo(0.45, 2)
    fireEvent.keyDown(slider, { key: 'm' })
    expect(toggle).toHaveBeenCalled()
  })

  it('popover shows on hover', () => {
    const { container } = wrap(<VolumeControl value={0.2} muted={false} />)
    const root = container.querySelector('[aria-label="音量控制"]') as HTMLElement
    const pop = container.querySelector('.vc-pop') as HTMLElement
    expect(pop.className.includes('show')).toBe(false)
    fireEvent.mouseEnter(root)
    expect(pop.className.includes('show')).toBe(true)
    fireEvent.mouseLeave(root)
    expect(pop.className.includes('show')).toBe(false)
  })
})