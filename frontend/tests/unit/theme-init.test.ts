import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const script = readFileSync('public/theme-init.js', 'utf8')
const run = () => new Function(script)()

describe('theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })
  it('uses the stored choice before the system setting', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    localStorage.setItem('meridian.theme', 'light')
    run()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
  it('follows prefers-color-scheme on a first visit', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    run()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
  it('survives blocked storage', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x')
    })
    run()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    vi.restoreAllMocks()
  })
})
