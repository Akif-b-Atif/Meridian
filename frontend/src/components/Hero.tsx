import { useEffect, useState } from 'react'
import type { IdentityData, SolarData } from '../api/types'
import { localTime, population } from '../copy'
import { sunState } from '../lib/geo'
import { n0 } from '../units'

function SunArc({ progress, up }: { progress: number | null; up: boolean }) {
  const cx = 60
  const cy = 58
  const r = 46
  const a = progress === null ? 0 : Math.PI * (1 - progress)
  return (
    <svg
      width="120"
      height="70"
      viewBox="0 0 120 70"
      role="img"
      aria-label={up ? 'The sun is up' : 'The sun is down'}
    >
      <line x1="6" x2="114" y1={cy} y2={cy} stroke="var(--edge)" strokeWidth="2" />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="var(--edge)"
        strokeDasharray="3 4"
        strokeWidth="1.5"
      />
      {up && progress !== null ? (
        <circle cx={cx + r * Math.cos(a)} cy={cy - r * Math.sin(a)} r="8" fill="var(--series-a)" />
      ) : (
        <rect x={cx - 6} y={cy + 4} width="12" height="8" fill="var(--edge)" />
      )}
    </svg>
  )
}

/** The place's name, large, and a live panel: what time it is there and whether the sun is up. */
export function Hero({ d, solar, day }: { d: IdentityData; solar: SolarData | null; day: number }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const len = solar ? solar.daylight365[day - 1] : null
  const sun = len === null ? null : sunState(now, d.lon, len)
  return (
    <header className="hero">
      <div>
        <h1>{d.name}</h1>
        <p className="hero-sub">{[d.admin1, d.country].filter(Boolean).join(', ')}</p>
        <p className="hero-facts">
          <span>
            {Math.abs(d.lat).toFixed(2)}°{d.lat >= 0 ? 'N' : 'S'}, {Math.abs(d.lon).toFixed(2)}°
            {d.lon >= 0 ? 'E' : 'W'}
          </span>
          {d.population && <span>{population(d.population)}</span>}
          {d.elevationM !== null && <span>{n0(d.elevationM)} m above sea level</span>}
        </p>
      </div>
      <div className="now" aria-live="off">
        <div className="note">Right now there</div>
        <div className="big">
          {localTime(d.timezone, now)
            .replace('Local time ', '')
            .replace(/\s*\(.*\)/, '')}
        </div>
        <div className="note">
          {localTime(d.timezone, now).match(/\((.*)\)/)?.[1]} · {d.timezone}
        </div>
        {sun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <SunArc progress={sun.progress} up={sun.up} />
            <span>{sun.up ? 'The sun is up.' : 'The sun is down.'}</span>
          </div>
        )}
      </div>
    </header>
  )
}
