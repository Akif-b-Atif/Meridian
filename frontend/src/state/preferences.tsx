import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Units } from '../units'

export type ThemeChoice = 'light' | 'dark' | 'system'
const UNITS_KEY = 'meridian.units'
const THEME_KEY = 'meridian.theme'
const MODE_KEY = 'meridian.mode'
export type Mode = 'plain' | 'detail'

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage can be unavailable; the choice then lasts for this visit only */
  }
}
export function initialUnits(): Units {
  return readStored(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric'
}
export function initialTheme(): ThemeChoice {
  const v = readStored(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}
export function initialMode(): Mode {
  return readStored(MODE_KEY) === 'detail' ? 'detail' : 'plain'
}
export function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
  root.style.colorScheme = dark ? 'dark' : 'light'
}

interface Prefs {
  units: Units
  setUnits: (u: Units) => void
  theme: ThemeChoice
  cycleTheme: () => void
  resolvedTheme: 'light' | 'dark'
  mode: Mode
  setMode: (m: Mode) => void
  setThemeChoice: (t: ThemeChoice) => void
}
const Ctx = createContext<Prefs | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<Units>(initialUnits)
  const [theme, setTheme] = useState<ThemeChoice>(initialTheme)
  const [mode, setModeState] = useState<Mode>(initialMode)
  const [resolved, setResolved] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light',
  )

  const setUnits = useCallback((u: Units) => {
    setUnitsState(u)
    writeStored(UNITS_KEY, u)
  }, [])

  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    writeStored(MODE_KEY, m)
  }, [])
  const setThemeChoice = useCallback((t: ThemeChoice) => {
    setTheme(t)
    writeStored(THEME_KEY, t === 'system' ? null : t)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    setResolved(document.documentElement.getAttribute('data-theme') as 'light' | 'dark')
    if (theme !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => {
      applyTheme('system')
      setResolved(document.documentElement.getAttribute('data-theme') as 'light' | 'dark')
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme((t) => {
      const next: ThemeChoice = t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'
      writeStored(THEME_KEY, next === 'system' ? null : next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      units,
      setUnits,
      theme,
      cycleTheme,
      resolvedTheme: resolved,
      mode,
      setMode,
      setThemeChoice,
    }),
    [units, setUnits, theme, cycleTheme, resolved, mode, setMode, setThemeChoice],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrefs must be used inside PreferencesProvider')
  return v
}
