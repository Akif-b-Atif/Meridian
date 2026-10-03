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
  test('loads all eleven sections and corrects the slug', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/wrong-slug')
    await expect(page.getByRole('heading', { name: 'London', level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/\/city\/2643743\/london/)
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
      await expect(page.getByRole('heading', { name: t, level: 2 })).toBeVisible()
    }
    await expect(page.getByText('Cfb: Temperate oceanic')).toBeVisible()
    await expect(page).toHaveTitle('London, United Kingdom - Meridian')
  })

  test('polling shows progress text from a 202', async ({ page }) => {
    await mockApi(page, { computingFirst: ['climate'] })
    await page.goto('/city/2643743/london')
    await expect(page.getByText('Step 2 of 3: Reading daily temperatures').first()).toBeVisible()
    await expect(page.getByText('Cfb: Temperate oceanic')).toBeVisible({ timeout: 15_000 })
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
    await expect(page.getByRole('heading', { name: 'History', level: 2 })).toBeVisible()
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
    const requests: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    await page.goto('/city/2643743/london')
    await expect(page.getByRole('heading', { name: 'Earthquakes' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    requests.length = 0
    await page.getByRole('radio', { name: /500 km/ }).click()
    await expect(page).toHaveURL(/r=500/)
    await page.waitForLoadState('networkidle')
    const api = requests.filter((u) => u.startsWith('http://api.test/'))
    expect(api.length).toBe(1)
    expect(api[0]).toContain('/seismic?radius=500')
  })

  test('unit switch changes displayed values and persists', async ({ page }) => {
    await mockApi(page)
    await page.goto('/city/2643743/london')
    await expect(page.getByText('72 km').first()).toBeVisible()
    await page.getByRole('button', { name: '°F mi' }).click()
    await expect(page.getByText('45 mi').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '°F mi' })).toHaveAttribute(
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
    await expect(page.getByText('Cfb: Temperate oceanic')).toBeVisible()
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
    await expect(page.getByText('The map could not be loaded.')).toBeVisible()
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
      await expect(page.getByText('Cfb: Temperate oceanic')).toBeVisible()
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
