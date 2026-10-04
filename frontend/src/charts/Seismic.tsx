import { scaleBand, scaleLinear, scaleLog } from 'd3-scale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SeismicData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT, compass } from '../copy'
import { polarOf } from '../lib/geo'
import { prefersReducedMotion, useWidth } from '../lib/hooks'
import { dist, distNumber, distUnit, n0, n1, n2, type Units } from '../units'

/** Marker radius in pixels for a magnitude, by linear interpolation between fixed stops. */
export const quakeRadius = (m: number) => {
  const stops: [number, number][] = [
    [4.5, 3],
    [5.5, 6],
    [6.5, 12],
    [7.5, 22],
    [9, 40],
  ]
  if (m <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (m <= stops[i][0]) {
      const [a, ra] = stops[i - 1]
      const [b, rb] = stops[i]
      return ra + ((m - a) / (b - a)) * (rb - ra)
    }
  }
  return 40
}

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'

interface RadarProps {
  d: SeismicData
  lat: number
  lon: number
  units: Units
  label: string
  theme: string
}

/** The city sits at the centre. Every earthquake is placed at its true distance and compass
 *  direction. Press play to watch the catalogue fill in, year by year. */
export function SeismicRadar({ d, lat, lon, units, label, theme }: RadarProps) {
  const [hostRef, hostW] = useWidth<HTMLDivElement>(560)
  const size = Math.max(260, Math.min(hostW, 560))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const t0 = d.points.t.length ? Math.min(...d.points.t) : Number(d.start.slice(0, 4))
  const t1 = Number(d.end.slice(0, 4)) + 1
  const [year, setYear] = useState(t1)
  const [playing, setPlaying] = useState(false)
  const yearRef = useRef(year)
  const ripples = useRef<{ x: number; y: number; r: number; born: number }[]>([])
  const reduced = prefersReducedMotion()

  const pts = useMemo(
    () =>
      d.points.t.map((t, i) => {
        const p = polarOf(lat, lon, d.points.lat[i], d.points.lon[i])
        return { t, mag: d.points.mag[i], bearing: p.bearing, km: p.km }
      }),
    [d, lat, lon],
  )

  const draw = useCallback(
    (cur: number, now: number) => {
      const cv = canvasRef.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return
      const dpr = window.devicePixelRatio || 1
      if (cv.width !== size * dpr) {
        cv.width = size * dpr
        cv.height = size * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      const c = size / 2
      const R = c - 36
      const ink = css('--ink')
      const mute = css('--mute')
      const edge = css('--edge')
      const a = css('--series-a')
      const accent = css('--accent')
      ctx.font = '14px "Source Sans 3 Variable", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.strokeStyle = edge
      ctx.globalAlpha = 0.5
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath()
        ctx.arc(c, c, (R * k) / 3, 0, Math.PI * 2)
        ctx.setLineDash(k === 3 ? [] : [3, 4])
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(c - R, c)
      ctx.lineTo(c + R, c)
      ctx.moveTo(c, c - R)
      ctx.lineTo(c, c + R)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = mute
      for (let k = 1; k <= 3; k++) {
        const km = (d.radiusKm * k) / 3
        ctx.fillText(
          `${Math.round(distNumber(km, units))} ${distUnit(units)}`,
          c + (R * k) / 3 - 2,
          c - 6 - (k === 3 ? 0 : 0),
        )
      }
      ctx.fillStyle = ink
      ctx.fillText('N', c, 16)
      ctx.fillText('S', c, size - 6)
      ctx.fillText('E', size - 12, c + 5)
      ctx.fillText('W', 12, c + 5)
      const scale = Math.max(0.75, Math.min(1.3, size / 520))
      for (const p of pts) {
        if (p.t > cur || p.km > d.radiusKm * 1.02) continue
        const rr = (p.km / d.radiusKm) * R
        const x = c + rr * Math.sin(p.bearing)
        const y = c - rr * Math.cos(p.bearing)
        const r = quakeRadius(p.mag) * scale
        const fresh = cur - p.t < 1.2 && cur < t1
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = a
        ctx.globalAlpha = 0.32
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = fresh ? accent : a
        ctx.lineWidth = fresh ? 2.5 : 1
        ctx.stroke()
        ctx.lineWidth = 1
      }
      // pulses for quakes that just appeared
      ripples.current = ripples.current.filter((rp) => now - rp.born < 900)
      for (const rp of ripples.current) {
        const k = (now - rp.born) / 900
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r + k * 26, 0, Math.PI * 2)
        ctx.strokeStyle = accent
        ctx.globalAlpha = 1 - k
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      // the city
      ctx.fillStyle = ink
      ctx.fillRect(c - 5, c - 5, 10, 10)
      ctx.strokeStyle = css('--ground')
      ctx.lineWidth = 2
      ctx.strokeRect(c - 5, c - 5, 10, 10)
      ctx.lineWidth = 1
    },
    [d.radiusKm, pts, size, t1, units],
  )

  // redraw whenever something visible changes
  useEffect(() => {
    draw(year, performance.now())
  }, [draw, year, theme])

  // time-lapse
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const span = t1 - t0
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const prev = yearRef.current
      const next = Math.min(t1, prev + (dt * span) / 14)
      if (!reduced) {
        const c = size / 2
        const R = c - 36
        for (const p of pts) {
          if (p.t > prev && p.t <= next && p.km <= d.radiusKm && p.mag >= 5.5) {
            const rr = (p.km / d.radiusKm) * R
            ripples.current.push({
              x: c + rr * Math.sin(p.bearing),
              y: c - rr * Math.cos(p.bearing),
              r: quakeRadius(p.mag),
              born: now,
            })
          }
        }
      }
      yearRef.current = next
      setYear(next)
      draw(next, now)
      if (next >= t1) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, draw, pts, size, t0, t1, d.radiusKm, reduced])

  const shown = pts.filter((p) => p.t <= year && p.km <= d.radiusKm * 1.02).length
  const toggle = () => {
    if (!playing && yearRef.current >= t1) {
      yearRef.current = t0
      setYear(t0)
    }
    setPlaying((p) => !p)
  }
  const strongest = pts
    .filter((p) => p.t <= year)
    .reduce<(typeof pts)[number] | null>((m, p) => (!m || p.mag > m.mag ? p : m), null)

  return (
    <div ref={hostRef} className="chart-host">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        style={{ width: size, height: size, display: 'block', margin: '0 auto' }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button type="button" onClick={toggle} aria-pressed={playing}>
          {playing ? 'Pause' : year >= t1 ? 'Replay the years' : 'Play'}
        </button>
        <label style={{ flex: 1 }}>
          <span className="sr-only">Year shown</span>
          <input
            type="range"
            min={t0}
            max={t1}
            step={0.1}
            value={year}
            onChange={(e) => {
              setPlaying(false)
              yearRef.current = Number(e.target.value)
              setYear(Number(e.target.value))
            }}
            aria-valuetext={`${Math.floor(year)}, ${shown} earthquakes shown`}
          />
        </label>
      </div>
      <p className="readout" aria-live="off">
        <strong>
          {year >= t1 ? `${Math.floor(t0)} to now` : `${Math.floor(t0)} to ${Math.floor(year)}`}:
        </strong>{' '}
        {n0(shown)} earthquakes
        {strongest
          ? `, strongest so far magnitude ${n1(strongest.mag)} (${compass((strongest.bearing * 180) / Math.PI)} of the city, ${dist(strongest.km, units)} away)`
          : ''}
        .
      </p>
    </div>
  )
}

/** Marker sizes for a few magnitudes, plus the rule of thumb that makes magnitude intuitive. */
export function MagnitudeLadder() {
  const mags = [5, 6, 7]
  return (
    <svg
      width="100%"
      height="76"
      viewBox="0 0 360 76"
      className="chart"
      role="img"
      aria-label="Marker sizes for magnitude 5, 6 and 7 earthquakes"
    >
      {mags.map((m, i) => (
        <g key={m}>
          <circle
            cx={36 + i * 70}
            cy={34}
            r={quakeRadius(m)}
            fill="var(--series-a)"
            fillOpacity={0.32}
            stroke="var(--series-a)"
          />
          <text x={36 + i * 70} y={70} textAnchor="middle">
            M{m}
          </text>
        </g>
      ))}
      <text x={250} y={30} className="ink">
        Each step is about
      </text>
      <text x={250} y={50} className="strong">
        32× more energy
      </text>
    </svg>
  )
}

export function ActivityMeter({ cls }: { cls: number }) {
  const words = ['none', 'very low', 'low', 'moderate', 'high', 'very high']
  return (
    <div role="img" aria-label={`Seismic activity: ${words[cls]}`}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((k) => (
          <span
            key={k}
            style={{
              width: 34,
              height: 14,
              background: k <= cls ? 'var(--series-a)' : 'transparent',
              border: '1.5px solid var(--series-a)',
              display: 'inline-block',
            }}
          />
        ))}
      </div>
      <div className="note" style={{ marginTop: 4 }}>
        Activity for its size: {words[cls]}
      </div>
    </div>
  )
}

export function Scatter({ d, units, label }: { d: SeismicData; units: Units; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = 300
  const M = { l: 44, r: 16, t: 28, b: 32 }
  const p = d.points
  const t0 = Number(d.start.slice(0, 4))
  const t1 = Number(d.end.slice(0, 4)) + 1
  const maxMag = Math.ceil(Math.max(...p.mag, 5) * 2) / 2
  const x = scaleLinear()
    .domain([t0, t1])
    .range([M.l, w - M.r])
  const y = scaleLinear()
    .domain([4.5, maxMag])
    .range([H - M.b, M.t])
  const { index, setIndex, onKeyDown } = useChartFocus(p.t.length)
  return (
    <div ref={ref} className="chart-host">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <text x={M.l} y={14} className="strong">
          Magnitude of each earthquake, by year
        </text>
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={w - M.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--edge)"
              strokeOpacity={0.3}
            />
            <text x={M.l - 6} y={y(t) + 5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {x.ticks(7).map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle">
            {t}
          </text>
        ))}
        {p.t.map((t, i) => (
          <circle
            key={i}
            cx={x(t)}
            cy={y(p.mag[i])}
            r={quakeRadius(p.mag[i])}
            fill="var(--series-a)"
            fillOpacity={0.35}
            stroke="var(--series-a)"
            strokeWidth={i === index ? 2.5 : 1}
            onPointerEnter={() => setIndex(i)}
          />
        ))}
      </svg>
      <p className="readout" aria-live="polite">
        {index === null
          ? IDLE_READOUT
          : `${Math.floor(p.t[index])}: magnitude ${n1(p.mag[index])}, depth ${dist(p.depth[index], units)}`}
      </p>
    </div>
  )
}

export function PerYear({ d }: { d: SeismicData }) {
  const [ref, w] = useWidth<HTMLDivElement>(320)
  const H = 200
  const M = { l: 40, r: 8, t: 12, b: 28 }
  const c = d.perYear.counts
  const x = scaleBand<number>()
    .domain(c.map((_, i) => i))
    .range([M.l, w - M.r])
    .padding(0.1)
  const y = scaleLinear()
    .domain([0, Math.max(1, ...c)])
    .nice()
    .range([H - M.b, M.t])
  return (
    <figure ref={ref} style={{ margin: 0 }}>
      <h3>Earthquakes per year</h3>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart"
        role="img"
        aria-label="Earthquakes of magnitude 4.5 or more per calendar year"
      >
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={w - M.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--edge)"
              strokeOpacity={0.3}
            />
            <text x={M.l - 6} y={y(t) + 5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {c.map((v, i) => (
          <rect
            key={i}
            x={x(i)}
            width={x.bandwidth()}
            y={y(v)}
            height={H - M.b - y(v)}
            fill="var(--series-b)"
          />
        ))}
        {c.length > 0 && (
          <>
            <text x={M.l} y={H - 8}>
              {d.perYear.firstYear}
            </text>
            <text x={w - M.r} y={H - 8} textAnchor="end">
              {d.perYear.firstYear + c.length - 1}
            </text>
          </>
        )}
      </svg>
    </figure>
  )
}

export function GutenbergRichter({ d }: { d: SeismicData }) {
  const [ref, w] = useWidth<HTMLDivElement>(320)
  const H = 200
  const M = { l: 40, r: 8, t: 12, b: 28 }
  const g = d.gr
  const pts = g.counts.map((n, i) => ({ m: g.m0 + i * g.step, n })).filter((q) => q.n > 0)
  const x = scaleLinear()
    .domain([g.m0, Math.max(g.m0 + 1, pts[pts.length - 1]?.m ?? g.m0 + 1)])
    .range([M.l, w - M.r])
  const y = scaleLog()
    .domain([1, Math.max(10, g.counts[0])])
    .range([H - M.b, M.t])
  let fit: React.ReactNode = null
  if (d.b !== null && d.mc !== null) {
    const a = Math.log10(d.nc) + d.b * d.mc
    const f = (m: number) => Math.max(1, 10 ** (a - (d.b as number) * m))
    const xe = pts[pts.length - 1]?.m ?? d.mc + 1
    fit = (
      <line
        x1={x(d.mc)}
        y1={y(f(d.mc))}
        x2={x(xe)}
        y2={y(f(xe))}
        stroke="var(--series-a)"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
    )
  }
  return (
    <figure ref={ref} style={{ margin: 0 }}>
      <h3>Big versus small</h3>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart"
        role="img"
        aria-label="Number of earthquakes at or above each magnitude, log scale"
      >
        {y.ticks(3).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={w - M.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--edge)"
              strokeOpacity={0.3}
            />
            <text x={M.l - 6} y={y(t) + 5} textAnchor="end">
              {n0(t)}
            </text>
          </g>
        ))}
        {x.ticks(5).map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        {pts.map((q) => (
          <circle key={q.m} cx={x(q.m)} cy={y(q.n)} r={2.5} fill="var(--series-b)" />
        ))}
        {fit}
      </svg>
      <p className="note">
        {d.b !== null
          ? `b = ${n2(d.b)} (plus or minus ${n2(d.bSe ?? 0)})`
          : 'Not enough events above the completeness magnitude to estimate b.'}
      </p>
    </figure>
  )
}

export function Tables({ d, units }: { d: SeismicData; units: Units }) {
  const r = d.recurrence
  const fmt = (v: number | 'gt10000' | null) =>
    v === null ? '–' : v === 'gt10000' ? 'more than 10,000 years' : `about one every ${n0(v)} years`
  return (
    <div className="stack">
      {r && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Recurrence">
          <table>
            <caption>
              Estimated from the magnitude statistics for the chosen radius; not a forecast.
            </caption>
            <thead>
              <tr>
                <th scope="col">Magnitude</th>
                <th scope="col">Recurrence</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">5 or more</th>
                <td>{fmt(r.m5)}</td>
              </tr>
              <tr>
                <th scope="row">6 or more</th>
                <td>{fmt(r.m6)}</td>
              </tr>
              <tr>
                <th scope="row">7 or more (extrapolated)</th>
                <td>{fmt(r.m7)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="scroll-x" tabIndex={0} role="region" aria-label="Largest events">
        <table>
          <caption>Largest events</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Magnitude</th>
              <th scope="col">Depth</th>
              <th scope="col">Distance</th>
              <th scope="col">Place</th>
            </tr>
          </thead>
          <tbody>
            {d.top.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.time.slice(0, 10)}</th>
                <td>{n1(e.mag)}</td>
                <td>{e.depth === null ? '–' : dist(e.depth, units)}</td>
                <td>{dist(e.distanceKm, units)}</td>
                <td style={{ textAlign: 'left' }}>{e.place ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataTable
        caption="Earthquakes plotted"
        head={['Year', 'Magnitude', 'Depth']}
        rows={d.points.t.map((t, i) => [
          t.toFixed(2),
          n1(d.points.mag[i]),
          dist(d.points.depth[i], units),
        ])}
      />
    </div>
  )
}
