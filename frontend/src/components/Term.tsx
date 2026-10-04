import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GLOSSARY } from '../copy/glossary'

/** A word with a dotted underline that opens a short definition. Keyboard and touch friendly. */
export function Term({
  id,
  children,
}: {
  id: keyof typeof GLOSSARY | string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const popId = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  const def = GLOSSARY[id]
  if (!def) return <>{children}</>
  return (
    <span className="term-wrap" ref={ref}>
      <button
        type="button"
        className="term"
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <span role="tooltip" id={popId} className="term-pop">
          {def}
        </span>
      )}
    </span>
  )
}
