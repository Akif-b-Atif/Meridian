// Renders the whole report in jsdom against the same fixtures the Playwright suite uses.
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from '../../src/app/Layout'
import { City } from '../../src/routes/City'
import { PreferencesProvider } from '../../src/state/preferences'
import { FIXTURES } from '../e2e/fixtures'

const hasText = (t: string) => (content: string) => content.replace(/\s/g, ' ').includes(t)

function mockFetch(overrides: Record<string, () => { status: number; body: unknown }> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input)
      let status = 200
      let body: unknown
      if (url.pathname === '/api/status') {
        body = { ok: true, warm: true, cacheMode: 'memory', version: 't', budget: {} }
      } else {
        const m = url.pathname.match(/^\/api\/cities\/\d+(?:\/(\w+))?$/)
        const mod = m?.[1] ?? 'identity'
        if (overrides[mod]) ({ status, body } = overrides[mod]())
        else body = FIXTURES[mod]
      }
      return { status, ok: status < 300, json: async () => body }
    }),
  )
}

function renderCity() {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <MemoryRouter initialEntries={['/city/2643743/london']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="city/:geonameId/:slug" element={<City />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('city report (jsdom)', () => {
  it('renders every section from the fixtures', async () => {
    mockFetch()
    renderCity()
    expect(await screen.findByRole('heading', { name: 'London', level: 1 })).toBeInTheDocument()
    await screen.findByText(/Cfb: Temperate oceanic/)
    for (const t of [
      'Location',
      'Seasons',
      'Climate normals',
      'Warming',
      'Extremes',
      'Daylight',
      'Earthquakes',
      'Air quality',
      'Water',
      'Places',
      'History',
    ]) {
      expect(screen.getByRole('heading', { name: t, level: 2 })).toBeInTheDocument()
    }
    await screen.findByText(/London is the capital/)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuemax', '365')
    expect(screen.getByText(/No earthquakes of magnitude 4.5 or more/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /The warmest day of a typical year is Jul 19, 28 days after the June solstice/,
      ),
    ).toBeInTheDocument()
  })

  it('an error in one module leaves the others intact', async () => {
    mockFetch({
      climate: () => ({
        status: 429,
        body: {
          error: {
            code: 'BUDGET_EXHAUSTED',
            message: "Today's allowance of new cities has been used.",
          },
        },
      }),
    })
    renderCity()
    await screen.findByText(/London is the capital/)
    expect(
      (await screen.findAllByText(/Today's allowance of new cities has been used/)).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('offers retry for an upstream failure', async () => {
    mockFetch({
      air: () => ({
        status: 502,
        body: {
          error: {
            code: 'UPSTREAM_UNAVAILABLE',
            message: 'Open-Meteo did not respond. This is usually temporary.',
          },
        },
      }),
    })
    renderCity()
    expect(await screen.findByRole('button', { name: 'Retry' }, { timeout: 5000 })).toBeEnabled()
  })

  it('converts displayed units when switched', async () => {
    mockFetch()
    renderCity()
    await screen.findByText(/Cfb: Temperate oceanic/)
    await screen.findByText(/Inland/, {}, { timeout: 5000 })
    expect(
      (await screen.findAllByText(hasText('72 km'), {}, { timeout: 5000 })).length,
    ).toBeGreaterThan(0)
    screen.getByRole('button', { name: '°F mi' }).click()
    await waitFor(() => expect(screen.getAllByText(hasText('45 mi')).length).toBeGreaterThan(0), {
      timeout: 3000,
    })
  })
})
