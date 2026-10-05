import { useEffect, useState } from 'react'
import { prefersReducedMotion, useInView } from '../lib/hooks'

/** A number that counts up once when it scrolls into view. Final value is the first paint without
 *  IntersectionObserver and under reduced motion, so nothing depends on the animation. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const canAnimate = typeof IntersectionObserver !== 'undefined' && !prefersReducedMotion()
  const [ref, seen] = useInView<HTMLSpanElement>('0px 0px -10% 0px')
  const [shown, setShown] = useState(canAnimate ? 0 : value)
  useEffect(() => {
    if (!canAnimate) {
      setShown(value)
      return
    }
    if (!seen) return
    const start = performance.now()
    const dur = 700
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      setShown(value * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, value, canAnimate])
  // printing should never show a half-finished count
  useEffect(() => {
    const show = () => setShown(value)
    window.addEventListener('beforeprint', show)
    return () => window.removeEventListener('beforeprint', show)
  }, [value])
  return (
    <span ref={ref}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
