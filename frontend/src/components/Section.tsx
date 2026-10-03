import type { ReactNode } from 'react'
import { useModule } from '../api/hooks'
import type { Envelope } from '../api/types'
import { note, stale as staleText, REFRESHING, unavailable } from '../copy'
import { usePrefs } from '../state/preferences'

type Result<T> = ReturnType<typeof useModule<T>>

const RETRY_CODES = new Set([
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_DATA',
  'INITIALISING',
  'BUSY',
  'HOURLY_LIMIT',
  'RATE_LIMITED',
  'INTERNAL',
])
const WAIT_CODES = new Set(['RATE_LIMITED', 'HOURLY_LIMIT', 'BUSY'])

export function Notes({ env, only }: { env: Envelope<unknown>; only?: string[] }) {
  const { units } = usePrefs()
  const cov = (env.data as { coverageStart?: string | null } | null)?.coverageStart
  const lines = env.notes
    .filter((c) => !only || only.includes(c))
    .map((c) => note(c, { coverageStart: cov, units }))
    .filter(Boolean)
  return (
    <>
      {lines.map((l) => (
        <p key={l} className="note">
          {l}
        </p>
      ))}
      {env.stale && (
        <p className="note">
          {staleText(env.computedAt)}
          {env.refreshing && REFRESHING}
        </p>
      )}
    </>
  )
}

export function SourceLine({ env }: { env: Envelope<unknown> | undefined }) {
  if (!env || env.sources.length === 0) return null
  return (
    <p className="note">
      {env.sources.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.text}
          </a>
        </span>
      ))}
    </p>
  )
}

/**
 * Renders the loading, computing, error and unavailable states of a module and calls
 * `children` with the envelope when data exists. An error here never affects other sections.
 */
export function ModuleView<T>({
  q,
  title,
  height,
  children,
}: {
  q: Result<T>
  title: string
  height: number
  children: (env: Envelope<T> & { data: T }) => ReactNode
}) {
  const r = q.result
  const now = useNow(r?.kind === 'error' ? r.at : 0)
  if (!r || q.isFetching) {
    const p = q.progress
    return (
      <div className="skeleton" style={{ minHeight: height }} aria-live="polite">
        {p ? `Step ${p.step} of ${p.steps}: ${p.label}` : 'Loading...'}
      </div>
    )
  }
  if (r.kind === 'network') {
    return (
      <div className="skeleton" style={{ minHeight: height }}>
        Waiting for the server.
      </div>
    )
  }
  if (r.kind === 'error') {
    const code = r.error.code
    const canRetry = RETRY_CODES.has(code)
    const waitS = WAIT_CODES.has(code) ? (r.error.retryAfterSeconds ?? 60) : 0
    const remaining = Math.max(0, Math.ceil(waitS - (now - r.at) / 1000))
    return (
      <div className="stack" role="alert" style={{ minHeight: height }}>
        <p>{r.error.message || 'Something went wrong. Please try again.'}</p>
        {canRetry && (
          <button type="button" onClick={() => q.refetch()} disabled={remaining > 0}>
            {remaining > 0 ? `Retry in ${remaining} s` : 'Retry'}
          </button>
        )}
      </div>
    )
  }
  const env = r.envelope
  if (env.status === 'unavailable' || env.data === null) {
    return (
      <div className="stack">
        <p>{unavailable(title)}</p>
        <Notes env={env} />
      </div>
    )
  }
  return <>{children(env as Envelope<T> & { data: T })}</>
}

import { useEffect, useState } from 'react'
function useNow(active: number): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return t
}

export function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      <div className="stack" style={{ marginTop: 8 }}>
        {children}
      </div>
    </section>
  )
}

export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string
  head: string[]
  rows: (string | number)[][]
}) {
  return (
    <details>
      <summary>Data table</summary>
      <div className="scroll-x" tabIndex={0} role="region" aria-label={caption}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={j}>{c}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
