import type { ReactNode } from 'react'
import { usePrefs } from '../state/preferences'
import { CountUp } from './CountUp'

export interface Stat {
  /** numeric stats count up; text stats are shown as given */
  value: number | string
  format?: (n: number) => string
  label: string
}

interface ChapterProps {
  id: string
  num: number
  title: string
  question: string
  stats?: Stat[]
  children: ReactNode
}

/** Every section of the report has the same shape: a question, a few headline numbers, then the
 *  chart and its plain-language reading. */
export function Chapter({ id, num, title, question, stats, children }: ChapterProps) {
  return (
    <section id={id} className="chapter" aria-labelledby={`${id}-h`}>
      <header className="ch-head">
        <span className="ch-num" aria-hidden="true">
          {String(num).padStart(2, '0')}
        </span>
        <h2 id={`${id}-h`}>{title}</h2>
        <p className="ch-question">{question}</p>
      </header>
      {stats && stats.length > 0 && (
        <dl className="stats">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <dd className="v" style={{ margin: 0 }}>
                {typeof s.value === 'number' ? (
                  <CountUp value={s.value} format={s.format ?? ((n) => String(Math.round(n)))} />
                ) : (
                  s.value
                )}
              </dd>
              <dt className="l">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}
      <div className="stack-lg">{children}</div>
    </section>
  )
}

export function Takeaway({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="takeaway">
      <span className="t">What this shows</span>
      {children}
    </p>
  )
}

export function HowTo({ children }: { children: ReactNode }) {
  return (
    <details className="howto">
      <summary>How to read this</summary>
      <div className="stack">{children}</div>
    </details>
  )
}

/** Technical detail. Open by default in Detailed reading mode, closed in Plain mode. */
export function Curious({
  title = 'For the curious',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const { mode } = usePrefs()
  return (
    <details className="curious" key={mode} open={mode === 'detail'}>
      <summary>{title}</summary>
      <div className="stack-lg">{children}</div>
    </details>
  )
}

export interface LegendItem {
  label: string
  kind: 'line' | 'dash' | 'box' | 'lineB'
}
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend" role="list" aria-label="Legend">
      {items.map((i) => (
        <span className="k" role="listitem" key={i.label}>
          <span
            aria-hidden="true"
            className={`sw ${i.kind === 'dash' ? 'dash' : ''} ${i.kind === 'box' || i.kind === 'lineB' ? 'b' : ''} ${i.kind === 'box' ? 'box' : ''}`}
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
