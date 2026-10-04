import { Link, Outlet } from 'react-router'
import { useEffect } from 'react'
import { useRetryNetworkFailures } from '../api/hooks'
import { useWaking } from '../api/waking'
import { DisplayMenu } from '../components/DisplayMenu'
import { SearchBox } from '../components/SearchBox'
import { Footer } from './Footer'

export function Layout() {
  const [waking, retry] = useWaking()
  useRetryNetworkFailures(waking.phase === 'ok')

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <a href="#report" className="skip">
        Skip to the report
      </a>
      <header className="site-header">
        <div className="wrap">
          <Link to="/" className="brand">
            Meridian
          </Link>
          <div style={{ flex: 1, maxWidth: 440 }}>
            <SearchBox />
          </div>
          <DisplayMenu />
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
      <main id="report" className="wrap" style={{ paddingBottom: 48 }}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
