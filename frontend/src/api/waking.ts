import { useEffect, useState } from 'react'
import { apiStatus } from './status'

export type WakingState =
  | { phase: 'ok' }
  | { phase: 'waking'; seconds: number }
  | { phase: 'starting'; seconds: number }
  | { phase: 'failed' }

/**
 * One status request per page load. If it has not answered after 3 s, or it fails, the page says
 * the free host is waking up and repeats the request every 3 s. This is a visitor-triggered wake,
 * not a keep-alive: once the server answers, nothing in the page runs on a timer to ping it.
 */
export function useWaking(): [WakingState, () => void] {
  const [state, setState] = useState<WakingState>({ phase: 'ok' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    const started = Date.now()
    const secs = () => Math.floor((Date.now() - started) / 1000)
    let resolved = false
    let phase: 'idle' | 'waking' | 'starting' = 'idle'

    const slow = setTimeout(() => {
      if (!resolved && phase === 'idle') {
        phase = 'waking'
        setState({ phase: 'waking', seconds: secs() })
      }
    }, 3000)
    const clock = setInterval(() => {
      if (!resolved && phase !== 'idle') setState({ phase, seconds: secs() })
    }, 1000)

    ;(async () => {
      for (;;) {
        const res = await apiStatus(ctrl.signal)
        if (ctrl.signal.aborted) return
        if (res?.ok && res.warm) break
        if (!res && secs() > 120) {
          resolved = true
          setState({ phase: 'failed' })
          return
        }
        if (res?.ok) {
          if (secs() > 90) break
          phase = 'starting'
        } else {
          phase = 'waking'
        }
        setState({ phase, seconds: secs() })
        await new Promise((r) => setTimeout(r, 3000))
      }
      resolved = true
      setState({ phase: 'ok' })
    })()

    return () => {
      ctrl.abort()
      clearInterval(clock)
      clearTimeout(slow)
    }
  }, [attempt])

  return [state, () => setAttempt((a) => a + 1)]
}
