import { useEffect, useRef, useState } from 'react'
import { usePrefs } from '../state/preferences'

export function DisplayMenu() {
  const { units, setUnits, theme, setThemeChoice, mode, setMode } = usePrefs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', down)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', down)
    }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="display-menu"
        onClick={() => setOpen((o) => !o)}
      >
        Display
      </button>
      {open && (
        <div id="display-menu" className="menu" role="group" aria-label="Display settings">
          <div className="group">
            <div className="group-label">Reading</div>
            <div className="seg" role="group" aria-label="Reading">
              <button
                type="button"
                aria-pressed={mode === 'plain'}
                onClick={() => setMode('plain')}
              >
                Plain
              </button>
              <button
                type="button"
                aria-pressed={mode === 'detail'}
                onClick={() => setMode('detail')}
              >
                Detailed
              </button>
            </div>
            <p className="note" style={{ marginTop: 6 }}>
              Plain keeps the method notes folded away. Detailed opens them.
            </p>
          </div>
          <div className="group">
            <div className="group-label">Units</div>
            <div className="seg" role="group" aria-label="Units">
              <button
                type="button"
                aria-pressed={units === 'metric'}
                onClick={() => setUnits('metric')}
              >
                °C, km
              </button>
              <button
                type="button"
                aria-pressed={units === 'imperial'}
                onClick={() => setUnits('imperial')}
              >
                °F, mi
              </button>
            </div>
          </div>
          <div className="group">
            <div className="group-label">Theme</div>
            <div className="seg" role="group" aria-label="Theme">
              <button
                type="button"
                aria-pressed={theme === 'light'}
                onClick={() => setThemeChoice('light')}
              >
                Light
              </button>
              <button
                type="button"
                aria-pressed={theme === 'dark'}
                onClick={() => setThemeChoice('dark')}
              >
                Dark
              </button>
              <button
                type="button"
                aria-pressed={theme === 'system'}
                onClick={() => setThemeChoice('system')}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
