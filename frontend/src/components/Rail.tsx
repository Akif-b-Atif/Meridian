import { useEffect, useRef } from 'react'
import { prefersReducedMotion, useActiveChapter } from '../lib/hooks'

export interface RailItem {
  id: string
  title: string
}

/** The "meridian": a line down the side (a bar on phones) that fills as you read. */
export function Rail({ items }: { items: RailItem[] }) {
  const ids = items.map((i) => i.id)
  const { active, progress } = useActiveChapter(ids)
  const listRef = useRef<HTMLOListElement>(null)
  // On phones the chapter list scrolls sideways; keep the current chapter in view.
  useEffect(() => {
    const ol = listRef.current
    const cur = ol?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!ol || !cur || ol.scrollWidth <= ol.clientWidth) return
    const left = cur.getBoundingClientRect().left - ol.getBoundingClientRect().left + ol.scrollLeft
    ol.scrollTo({
      left: left - ol.clientWidth / 2 + cur.offsetWidth / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [active])
  return (
    <nav className="rail" aria-label="Chapters">
      <div className="rail-list">
        <div className="rail-track" aria-hidden="true">
          <div style={{ height: `${progress * 100}%` }} />
        </div>
        <ol ref={listRef}>
          {items.map((it, i) => (
            <li key={it.id}>
              <a href={`#${it.id}`} aria-current={i === active ? 'location' : undefined}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                {it.title}
              </a>
            </li>
          ))}
        </ol>
      </div>
      <div className="rail-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p className="rail-hint">
        Press <kbd>/</kbd> to search, <kbd>j</kbd> and <kbd>k</kbd> to move between chapters.
      </p>
    </nav>
  )
}

export function jumpChapter(ids: string[], dir: 1 | -1) {
  const line = window.innerHeight * 0.4
  let cur = 0
  ids.forEach((id, i) => {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= line + 4) cur = i
  })
  const next = Math.min(ids.length - 1, Math.max(0, cur + dir))
  document.getElementById(ids[next])?.scrollIntoView({ behavior: 'smooth' })
}
