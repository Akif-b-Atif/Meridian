import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PreferencesProvider,
  initialTheme,
  initialUnits,
  usePrefs,
} from '../../src/state/preferences'

function Probe() {
  const { units, setUnits, theme, cycleTheme } = usePrefs()
  return (
    <div>
      <span data-testid="u">{units}</span>
      <span data-testid="t">{theme}</span>
      <button onClick={() => setUnits('imperial')}>imperial</button>
      <button onClick={cycleTheme}>cycle</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never
})

describe('preferences', () => {
  it('defaults to metric and follows the system theme', () => {
    expect(initialUnits()).toBe('metric')
    expect(initialTheme()).toBe('system')
  })
  it('persists units and cycles light, dark, system', async () => {
    const user = userEvent.setup()
    render(
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>,
    )
    await user.click(screen.getByText('imperial'))
    expect(localStorage.getItem('meridian.units')).toBe('imperial')
    await user.click(screen.getByText('cycle'))
    expect(screen.getByTestId('t').textContent).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    await user.click(screen.getByText('cycle'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('meridian.theme')).toBe('dark')
    await user.click(screen.getByText('cycle'))
    expect(localStorage.getItem('meridian.theme')).toBeNull()
  })
  it('falls back to defaults when storage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(initialUnits()).toBe('metric')
    expect(initialTheme()).toBe('system')
    const user = userEvent.setup()
    render(
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>,
    )
    await act(async () => {
      await user.click(screen.getByText('imperial'))
    })
    expect(screen.getByTestId('u').textContent).toBe('imperial')
    spy.mockRestore()
    set.mockRestore()
  })
})
