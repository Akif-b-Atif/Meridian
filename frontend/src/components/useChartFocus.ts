import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'

/** Shared keyboard model: Left and Right step through values, Home and End jump. */
export function useChartFocus(length: number) {
  const [index, setIndex] = useState<number | null>(null)
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (length === 0) return
      const cur = index ?? -1
      let next: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(length - 1, cur + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = Math.max(0, cur < 0 ? 0 : cur - 1)
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = length - 1
      if (next !== null) {
        e.preventDefault()
        setIndex(next)
      }
    },
    [index, length],
  )
  return { index, setIndex, onKeyDown }
}
