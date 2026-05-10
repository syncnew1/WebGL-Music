import React, { useRef, useState, useEffect, useCallback, useLayoutEffect, memo } from 'react'

type Props = {
  items: any[]
  minColumnWidth?: number
  gap?: number
  overscan?: number
  scrollOffset?: number
  renderItem: (item: any, index: number) => React.ReactNode
  onEndReached?: () => void
  endReachedThreshold?: number
  loading?: boolean
  loadingText?: string
}

export default function VirtualGrid({
  items,
  minColumnWidth = 168,
  gap = 16,
  overscan = 2,
  scrollOffset = 0,
  renderItem,
  onEndReached,
  endReachedThreshold = 400,
  loading = false,
  loadingText = '加载中...',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowHeightRef = useRef(260)
  const [range, setRange] = useState({ start: 0, end: 30 })
  const [cols, setCols] = useState(1)
  const endReachedRef = useRef(false)
  const rafRef = useRef(0)
  const colsRef = useRef(1)
  const itemsLenRef = useRef(items.length)
  const onEndReachedRef = useRef(onEndReached)

  useEffect(() => { itemsLenRef.current = items.length }, [items.length])
  useEffect(() => { onEndReachedRef.current = onEndReached }, [onEndReached])

  const recalc = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth
    const c = Math.max(1, Math.floor((w + gap) / (minColumnWidth + gap)))
    if (c !== colsRef.current) {
      colsRef.current = c
      setCols(c)
    }
  }, [minColumnWidth, gap])

  // 测量首行实际高度（仅在列数变化时）
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const firstRow = el.querySelector('[data-row="0"]') as HTMLElement
    if (firstRow) {
      const h = firstRow.getBoundingClientRect().height
      if (h > 0) rowHeightRef.current = h + gap
    }
  }, [cols, gap])

  useLayoutEffect(() => {
    recalc()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [recalc])

  // 用 rAF 节流的滚动处理
  const handleScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = containerRef.current
      if (!el) return
      const scrollTop = el.scrollTop
      const viewH = el.clientHeight
      const rh = rowHeightRef.current
      const c = colsRef.current
      const len = itemsLenRef.current

      const startRow = Math.max(0, Math.floor(scrollTop / rh) - overscan)
      const endRow = Math.ceil((scrollTop + viewH) / rh) + overscan
      setRange({ start: startRow * c, end: Math.min(endRow * c, len) })

      // 触底检测
      const cb = onEndReachedRef.current
      if (cb) {
        const totalRows = Math.ceil(len / c)
        const totalH = totalRows * rh
        if (scrollTop + viewH >= totalH - endReachedThreshold && !endReachedRef.current) {
          endReachedRef.current = true
          cb()
        }
        if (scrollTop + viewH < totalH - endReachedThreshold) {
          endReachedRef.current = false
        }
      }
    })
  }, [overscan, endReachedThreshold])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleScroll])

  // items 变化时重新计算可见范围，内容不满一屏时自动加载更多
  useEffect(() => {
    handleScroll()
    endReachedRef.current = false

    const el = containerRef.current
    const cb = onEndReachedRef.current
    if (!el || !cb) return
    // 延迟一帧，等行高测量完毕再判断
    const timer = requestAnimationFrame(() => {
      const rh = rowHeightRef.current
      const c = colsRef.current
      const totalRows = Math.ceil(items.length / c)
      const totalH = totalRows * rh
      if (totalH <= el.clientHeight) {
        endReachedRef.current = true
        cb()
      }
    })
    return () => cancelAnimationFrame(timer)
  }, [items.length, cols, handleScroll])

  const totalRows = Math.ceil(items.length / cols)
  const totalHeight = totalRows * rowHeightRef.current
  const start = Math.max(0, range.start)
  const end = Math.min(items.length, range.end)

  // 按行分组
  const visibleRows: { rowIdx: number; rowTop: number; cells: { item: any; idx: number }[] }[] = []
  for (let i = start; i < end; ) {
    const rowIdx = Math.floor(i / cols)
    const rowStart = rowIdx * cols
    const rowEnd = Math.min(rowStart + cols, items.length)
    const cells: { item: any; idx: number }[] = []
    for (let j = rowStart; j < rowEnd; j++) cells.push({ item: items[j], idx: j })
    visibleRows.push({ rowIdx, rowTop: rowIdx * rowHeightRef.current, cells })
    i = rowEnd
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: `calc(100vh - ${scrollOffset}px)`,
        overflow: 'auto',
        willChange: 'transform',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleRows.map(({ rowIdx, rowTop, cells }) => (
          <div
            key={rowIdx}
            data-row={rowIdx}
            style={{
              position: 'absolute',
              top: rowTop,
              left: 0,
              right: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap,
            }}
          >
            {cells.map(({ item, idx }) => renderItem(item, idx))}
          </div>
        ))}
      </div>
      {loading && (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          {loadingText}
        </div>
      )}
    </div>
  )
}
