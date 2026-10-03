import type { ApiErrorBody, Envelope, ProgressBody } from './types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export type ApiResult<T> =
  | { kind: 'ok'; envelope: Envelope<T> }
  | { kind: 'computing'; body: ProgressBody }
  | { kind: 'error'; httpStatus: number; error: ApiErrorBody }
  | { kind: 'network' }

/**
 * One GET. No cookies and no custom headers are sent, so the browser never needs a CORS preflight.
 * A 502, 503 or 504 without a JSON error body comes from the host's edge while the service is
 * asleep, so it is treated as a network failure (the "waking" state).
 */
export async function apiGet<T>(
  path: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000)
  const onAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal, credentials: 'omit' })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    const hasError =
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as { error: unknown }).error === 'object'
    if ([502, 503, 504].includes(res.status) && !hasError) return { kind: 'network' }
    if (res.status === 202 && json) return { kind: 'computing', body: json as ProgressBody }
    if (res.ok && json) return { kind: 'ok', envelope: json as Envelope<T> }
    if (hasError) {
      return {
        kind: 'error',
        httpStatus: res.status,
        error: (json as { error: ApiErrorBody }).error,
      }
    }
    return { kind: 'network' }
  } catch {
    return { kind: 'network' }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }
}

/** Polling interval from the number of modules computing in this tab (SDS 10.1). */
export function pollInterval(k: number): number {
  return Math.min(6, Math.max(2, Math.ceil(0.7 * k)))
}
