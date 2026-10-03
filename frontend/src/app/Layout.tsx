import { Link, Outlet } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useRetryNetworkFailures } from '../api/hooks'
import { useWaking } from '../api/waking'
import { SearchBox } from '../components/SearchBox'
import { usePrefs } from '../state/preferences'
import { Footer } from './Footer'

export function Layout() {
  const { units, setUnits, theme, cycleTheme } = usePrefs()
  const [waking, retry] = useWaking()
  useQueryClient()
  useRetryNetworkFailures(waking.phase === 'ok')
  return (
    <>
      <a href="#report" className="skip">
        Skip to the report
      </a>
      <header className="site-header">
        <div className="wrap">
          <Link
            to="/"
            style={{ fontWeight: 600, fontSize: 20, color: 'var(--ink)', textDecoration: 'none' }}
          >
            Meridian
          </Link>
          <div style={{ flex: 1, maxWidth: 420 }}>
            <SearchBox />
          </div>
          <div role="group" aria-label="Units" style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              aria-pressed={units === 'metric'}
              onClick={() => setUnits('metric')}
            >
              °C km
            </button>
            <button
              type="button"
              aria-pressed={units === 'imperial'}
              onClick={() => setUnits('imperial')}
            >
              °F mi
            </button>
          </div>
          <button type="button" onClick={cycleTheme} aria-label={`Theme: ${theme}. Change theme`}>
            {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
          </button>
        </div>
      </header>
      {waking.phase !== 'ok' && (
        <div className="banner" role="status">
          {waking.phase === 'waking' &&
            `The server is waking up. The free host sleeps when idle, so the first request can take up to a minute. Waiting: ${waking.seconds} s`}
          {waking.phase === 'starting' && `The server is starting. Waiting: ${waking.seconds} s`}
          {waking.phase === 'failed' && (
            <>
              The server did not wake up. Try again in a few minutes.{' '}
              <button type="button" onClick={retry}>
                Retry
              </button>
            </>
          )}
        </div>
      )}
      <main id="report" className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
