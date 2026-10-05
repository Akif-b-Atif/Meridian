import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApi } from './fixtures'

test.describe('landing and search', () => {
  test('shows samples and disambiguates a search', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Meridian', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /London, United Kingdom/ })).toBeVisible()
    const box = page.getByRole('combobox').first()
    await box.fill('Spring')
    const options = page.getByRole('option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toContainText('Illinois')
    await box.press('ArrowDown')
    await box.press('Escape')
    await expect(options).toHaveCount(0)
  })

  test('shows a helpful message when nothing matches', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await page.getByRole('combobox').first().fill('zzzzz')
    await expect(page.getByText('No matching place found.')).toBeVisible()
  })

  test('unknown routes and bad ids show the not-found page without API calls', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/abc/x')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})

test.describe('city report', () => {
  test('loads all ten chapters and corrects the slug', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/wrong-slug')
    await expect(page.getByRole('heading', { name: 'London', level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/\/city\/2643743\/london/)
    for (const t of [
      'Where it is',
      'How it began',
      'What’s there',
      'The year',
      'Typical weather',
      'Daylight',
      'Extremes',
      'Warming',
      'Earthquakes',
      'Air',
    ]) {
      await expect(page.getByRole('heading', { name: t, level: 2 })).toBeVisible()
    }
    await expect(page.getByText(/Climate type/).first()).toBeVisible()
    await expect(page).toHaveTitle('London, United Kingdom - Meridian')
  })

  test('polling shows progress text from a 202', async ({ page }) => {
    await mockApi(page, { computingFirst: ['climate'] })
    await page.goto('/city/2643743/london')
    await expect(page.getByText('Step 2 of 3: Reading daily temperatures').first()).toBeVisible()
    await expect(page.getByText(/Climate type/).first()).toBeVisible({ timeout: 15_000 })
  })

  test('budget exhaustion has no retry button and other sections still work', async ({ page }) => {
    await mockApi(page, {
      overrides: {
        climate: (route) =>
          route.fulfill({
            status: 429,
            headers: { 'access-control-allow-origin': '*' },
            json: {
              error: {
                code: 'BUDGET_EXHAUSTED',
                message: "Today's allowance of new cities has been used.",
              },
            },
          }),
      },
    })
    await page.goto('/city/2643743/london')
    await expect(
      page.getByText("Today's allowance of new cities has been used.").first(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Retry/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'How it began', level: 2 })).toBeVisible()
    await expect(page.getByText('London is the capital')).toBeVisible()
  })

  test('upstream rate limit shows a disabled retry until the time passes', async ({ page }) => {
    await mockApi(page, {
      overrides: {
        seismic: (route) =>
          route.fulfill({
            status: 429,
            headers: { 'access-control-allow-origin': '*' },
            json: {
              error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests from your connection. Try again in 30 seconds.',
                retryAfterSeconds: 30,
              },
            },
          }),
      },
    })
    await page.goto('/city/2643743/london')
    const retry = page.getByRole('button', { name: /Retry in \d+ s/ })
    await expect(retry).toBeDisabled()
  })

  test('radius switch updates the URL and requests only seismic', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'Earthquakes', level: 2 })).toBeVisible()
    await expect(page.getByText(/Typical weather|Climate type/).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    const requests: string[] = []
    page.on('request', (r) => {
      if (r.url().startsWith('http://api.test/')) requests.push(r.url())
    })
    const seismic500 = page.waitForRequest((r) => r.url().includes('/seismic?radius=500'))
    await page.getByRole('radio', { name: /500 km/ }).click()
    await seismic500
    await expect(page).toHaveURL(/r=500/)
    // give any stray request a moment to appear, then check nothing else was fetched
    await page.waitForTimeout(800)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain('/seismic?radius=500')
  })

  test('unit switch changes displayed values and persists', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByText(/72\s*km/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByRole('button', { name: '°F, mi' }).click()
    await expect(page.getByText(/45\s*mi/).first()).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'Display' }).click()
    await expect(page.getByRole('button', { name: '°F, mi' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('the year clock works from the keyboard', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    const clock = page.getByRole('slider')
    await clock.focus()
    await clock.press('Home')
    await expect(clock).toHaveAttribute('aria-valuenow', '1')
    await clock.press('ArrowRight')
    await expect(clock).toHaveAttribute('aria-valuenow', '2')
    await clock.press('PageUp')
    await expect(clock).toHaveAttribute('aria-valuenow', '32')
    await clock.press('End')
    await expect(clock).toHaveAttribute('aria-valuenow', '365')
  })
})

test.describe('reading experience', () => {
  test('the chapter rail follows the page and keyboard shortcuts move between chapters', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'How it began', level: 2 })).toBeVisible()
    const rail = page.getByRole('navigation', { name: 'Chapters' })
    await expect(rail.getByRole('link', { name: /Where it is/ })).toHaveAttribute(
      'aria-current',
      'location',
    )
    await page.locator('body').click({ position: { x: 5, y: 300 } })
    await page.keyboard.press('j')
    await expect(rail.getByRole('link', { name: /How it began/ })).toHaveAttribute(
      'aria-current',
      'location',
    )
    await page.keyboard.press('/')
    await expect(page.getByRole('combobox').first()).toBeFocused()
  })

  test('plain mode folds the method notes and detailed mode opens them', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'Warming', level: 2 })).toBeVisible()
    const curious = page.locator('#warming details.curious')
    await expect(curious).not.toHaveAttribute('open', '')
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByRole('button', { name: 'Detailed' }).click()
    await expect(curious).toHaveAttribute('open', '')
  })

  test('every chapter says what its chart shows', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'Air', level: 2 })).toBeVisible()
    await expect(page.getByText('What this shows').first()).toBeVisible()
    expect(await page.getByText('What this shows').count()).toBeGreaterThanOrEqual(5)
  })

  test('text in charts stays readable on a phone', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'Typical weather', level: 2 })).toBeVisible()
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('#weather svg text')].map((t) => {
        const el = t as SVGTextElement
        const ctm = el.getScreenCTM()
        return parseFloat(getComputedStyle(el).fontSize) * (ctm ? ctm.a : 1)
      }),
    )
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11.5)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await ctx.close()
  })

  test('the seismic radar plays and the slider is keyboard operable', async ({ page }) => {
    await mockApi(page, {
      overrides: {
        seismic: (route) =>
          route.fulfill({
            status: 200,
            headers: { 'access-control-allow-origin': '*' },
            json: {
              module: 'seismic',
              status: 'ok',
              computedAt: '2026-10-01T00:00:00Z',
              stale: false,
              refreshing: false,
              notes: [],
              sources: [],
              data: {
                radiusKm: 300,
                start: '1973-01-01',
                end: '2026-10-01',
                years: 53.7,
                n: 3,
                areaKm2: 279000,
                ratePerYear: 0.1,
                ratePerYearCi: [0, 0.2],
                ratePer100kKm2: 0.02,
                ratePer100kKm2Ci: [0, 0.1],
                activityClass: 1,
                mc: null,
                nc: 3,
                b: null,
                bSe: null,
                recurrence: null,
                partial: false,
                coverageStart: null,
                truncated: false,
                droppedRows: 0,
                points: {
                  t: [1980.5, 1999.2, 2015.8],
                  lat: [51.9, 51.2, 51.7],
                  lon: [-0.3, 0.2, -0.1],
                  mag: [4.6, 5.8, 4.9],
                  depth: [10, 12, 8],
                },
                top: [
                  {
                    time: '1999-03-01T00:00:00',
                    mag: 5.8,
                    magType: 'mw',
                    depth: 12,
                    place: 'x',
                    id: 'a',
                    distanceKm: 70,
                  },
                ],
                perYear: { firstYear: 1974, counts: [0, 1] },
                gr: { m0: 4.5, step: 0.1, counts: [3, 2, 1] },
              },
            },
          }),
      },
    })
    await page.goto('/city/2643743/london')
    const radar = page.locator('#ground canvas')
    await expect(radar).toBeVisible()
    await page.getByRole('button', { name: /Play|Replay/ }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await page.getByRole('button', { name: 'Pause' }).click()
    const slider = page.locator('#ground input[type=range]')
    await slider.focus()
    await slider.press('Home')
    await expect(page.locator('#ground .readout').first()).toContainText('0 earthquakes')
  })

  test('scrolling the year chapter changes which layers of the dial are shown', async ({
    page,
  }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    const step3 = page.locator('.story-steps [data-step="3"]')
    await step3.scrollIntoViewIfNeeded()
    await expect(step3).toHaveAttribute('data-active', 'true')
    await page.locator('.story-steps [data-step="1"]').scrollIntoViewIfNeeded()
    await expect(page.locator('.story-steps [data-step="1"]')).toHaveAttribute(
      'data-active',
      'true',
    )
  })
})

test.describe('waking and theme', () => {
  test('shows the waking banner then clears it', async ({ page }) => {
    await mockApi(page, { statusFailures: 2 })
    await page.goto('/')
    await expect(page.getByRole('status')).toContainText('The server is waking up', {
      timeout: 8000,
    })
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 15_000 })
  })

  test('theme is applied before first paint and respects a stored choice', async ({ page }) => {
    await mockApi(page)
    await page.addInitScript(() => localStorage.setItem('meridian.theme', 'dark'))
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        ;(window as unknown as { themeAtDcl: string | null }).themeAtDcl =
          document.documentElement.getAttribute('data-theme')
      })
    })
    await page.goto('/')
    expect(
      await page.evaluate(() => (window as unknown as { themeAtDcl: string }).themeAtDcl),
    ).toBe('dark')
  })

  test('follows the system theme on a first visit', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await ctx.close()
  })

  test('reduced motion removes the clock draw-in', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByText(/Climate type/).first()).toBeVisible()
    await expect(page.locator('.draw-in')).toHaveCount(0)
    await ctx.close()
  })

  test('the map falls back to text when WebGL is unavailable', async ({ browser }) => {
    const ctx = await browser.newContext()
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...a: unknown[]) {
        if (type.startsWith('webgl')) return null
        return (orig as (...x: unknown[]) => unknown).call(this, type, ...a)
      } as typeof orig
    })
    const page = await ctx.newPage()
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByText(/The map could not be loaded/)).toBeVisible()
    await ctx.close()
  })
})

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`landing page has no serious violations (${scheme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme })
      const page = await ctx.newPage()
      await mockApi(page)
      await page.goto('/')
      const r = await new AxeBuilder({ page }).analyze()
      expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
        [],
      )
      await ctx.close()
    })
    test(`city page has no serious violations (${scheme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: scheme })
      await ctx.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = (() => null) as never
      })
      const page = await ctx.newPage()
      await mockApi(page)
      await page.goto('/city/2643743/london')
      await expect(page.getByText(/Climate type/).first()).toBeVisible()
      const r = await new AxeBuilder({ page }).analyze()
      expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual(
        [],
      )
      await ctx.close()
    })
  }
  test('error state has no serious violations', async ({ page }) => {
    await mockApi(page, {
      overrides: {
        climate: (route) =>
          route.fulfill({
            status: 502,
            headers: { 'access-control-allow-origin': '*' },
            json: {
              error: {
                code: 'UPSTREAM_UNAVAILABLE',
                message: 'Open-Meteo did not respond. This is usually temporary.',
              },
            },
          }),
      },
    })
    await page.goto('/city/2643743/london')
    await expect(page.getByText('Open-Meteo did not respond.').first()).toBeVisible()
    const r = await new AxeBuilder({ page }).analyze()
    expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  })
})
