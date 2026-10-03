import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { apiGet, pollInterval } from './client'
import type { ApiErrorBody, Envelope, ProgressBody } from './types'

export type ModuleResult<T> =
  | { kind: 'ok'; envelope: Envelope<T> }
  | { kind: 'error'; httpStatus: number; error: ApiErrorBody; at: number }
  | { kind: 'network' }

// Progress lives outside React Query so polling can update it without refetching.
const progress = new Map<string, ProgressBody['progress']>()
const listeners = new Set<() => void>()
let computing = 0
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))

export function useProgress(key: string): ProgressBody['progress'] | undefined {
  return useSyncExternalStore(subscribe, () => progress.get(key))
}

const TOTAL_LIMIT_MS = (module: string) => (module === 'climate' ? 150_000 : 60_000)
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

async function run<T>(module: string, path: string, key: string, signal?: AbortSignal) {
  const start = Date.now()
  let counted = false
  try {
    for (;;) {
      const res = await apiGet<T>(path, { signal, timeoutMs: 30_000 })
      if (res.kind === 'computing') {
        if (!counted) {
          counted = true
          computing++
        }
        progress.set(key, res.body.progress)
        emit()
        if (Date.now() - start > TOTAL_LIMIT_MS(module) || signal?.aborted) {
          return {
            kind: 'error',
            httpStatus: 504,
            at: Date.now(),
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'The calculation took too long. This is usually temporary.',
            },
          } as ModuleResult<T>
        }
        await sleep(pollInterval(computing) * 1000, signal)
        continue
      }
      if (res.kind === 'ok') return res as ModuleResult<T>
      if (res.kind === 'error') return { ...res, at: Date.now() } as ModuleResult<T>
      return { kind: 'network' } as ModuleResult<T>
    }
  } finally {
    if (counted) computing--
    progress.delete(key)
    emit()
  }
}

export function useModule<T>(module: string, path: string | null, enabled = true) {
  const key = `${module}:${path}`
  const q = useQuery<ModuleResult<T>>({
    queryKey: ['module', module, path],
    queryFn: ({ signal }) => run<T>(module, path as string, key, signal),
    enabled: enabled && path !== null,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  })
  const prog = useProgress(key)
  return { ...q, progress: prog, result: q.data }
}

/** Repeat requests that failed with a network error once the server has woken up. */
export function useRetryNetworkFailures(awake: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!awake) return
    qc.invalidateQueries({
      predicate: (q) => (q.state.data as { kind?: string } | undefined)?.kind === 'network',
    })
  }, [awake, qc])
}
