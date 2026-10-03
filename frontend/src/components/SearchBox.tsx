import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { apiGet } from '../api/client'
import type { SearchData, SearchResult } from '../api/types'
import { slugify } from '../copy/slug'
import { SAMPLES } from '../app/samples'
import { n0 } from '../units'

export const DEBOUNCE_MS = 300
export const MIN_CHARS = 3

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const nav = useNavigate()
  const id = useId()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState(false)
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => {
    ctrl.current?.abort()
    const text = q.trim()
    if (text.length < MIN_CHARS) {
      setResults(null)
      setMessage('')
      setBudget(false)
      setOpen(false)
      return
    }
    const c = new AbortController()
    ctrl.current = c
    const t = setTimeout(async () => {
      const res = await apiGet<SearchData>(`/api/search?q=${encodeURIComponent(text)}`, {
        signal: c.signal,
      })
      if (c.signal.aborted) return
      setBudget(false)
      if (res.kind === 'ok') {
        const r = res.envelope.data?.results ?? []
        setResults(r)
        setMessage(
          r.length ? '' : 'No matching place found. Try a different spelling or add the country.',
        )
        setActive(-1)
        setOpen(true)
      } else if (res.kind === 'error') {
        setResults(null)
        setMessage(res.error.message)
        setBudget(res.error.code === 'BUDGET_EXHAUSTED')
        setOpen(false)
      } else {
        setResults(null)
        setMessage('Waiting for the server.')
        setOpen(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      c.abort()
    }
  }, [q])

  const go = (r: SearchResult) => {
    setOpen(false)
    nav(`/city/${r.geonameId}/${slugify(r.name)}`)
  }
  const onKey = (e: KeyboardEvent) => {
    if (!results || !open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') setOpen(false)
  }
  const label = (r: SearchResult) => [r.name, r.admin1, r.country].filter(Boolean).join(', ')

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <label htmlFor={`${id}-in`} className="sr-only">
        Search for a city
      </label>
      <input
        id={`${id}-in`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
        aria-autocomplete="list"
        placeholder="Search for a city"
        autoComplete="off"
        value={q}
        autoFocus={autoFocus}
        maxLength={80}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      {open && results && results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="listbox" aria-label="Matching places">
          {results.map((r, i) => (
            <li
              key={r.geonameId}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                go(r)
              }}
            >
              {label(r)}
              {r.population ? <span className="mute">&nbsp;· {n0(r.population)}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite" className="note" style={{ marginTop: 4 }}>
        {message}
      </div>
      {budget && (
        <div className="grid-samples" style={{ marginTop: 8 }}>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => nav(`/city/${s.id}/${slugify(s.name)}`)}
            >
              {s.name}, {s.country}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
