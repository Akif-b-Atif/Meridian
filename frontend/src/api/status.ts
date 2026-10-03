import type { StatusBody } from './types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

/** Returns the status body, or null on any network failure or a host-edge 502/503/504. */
export async function apiStatus(signal?: AbortSignal): Promise<StatusBody | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10_000)
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true })
  try {
    const res = await fetch(`${BASE}/api/status`, { signal: ctrl.signal, credentials: 'omit' })
    if (!res.ok) return null
    return (await res.json()) as StatusBody
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
