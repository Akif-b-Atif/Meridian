import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** Measured width of an element. Charts draw in real pixels so their text never shrinks. */
export function useWidth<T extends HTMLElement>(fallback = 640): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const width = Math.floor(el.getBoundingClientRect().width)
      if (width > 0) setW(width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** True once the element has entered the viewport. Without IntersectionObserver it is always true. */
export function useInView<T extends HTMLElement>(margin = '0px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || seen || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen, margin])
  return [ref, seen]
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** Index of the last element whose top has passed a line 40% down the viewport, plus overall progress. */
export function useActiveChapter(ids: string[]): { active: number; progress: number } {
  const [state, setState] = useState({ active: 0, progress: 0 })
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const line = window.innerHeight * 0.4
      let active = 0
      let frac = 0
      ids.forEach((id, i) => {
        const el = document.getElementById(id)
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.top <= line) {
          active = i
          frac = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)))
        }
      })
      const progress = ids.length ? (active + frac) / ids.length : 0
      setState((s) =>
        s.active === active && Math.abs(s.progress - progress) < 0.002 ? s : { active, progress },
      )
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ids.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}
