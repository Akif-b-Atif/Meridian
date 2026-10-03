import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { SolarData } from '../api/types'
import { DataTable } from '../components/Section'
import { IDLE_READOUT, MONTH_INITIALS, MONTH_START, dateOf } from '../copy'
import { hm } from '../units'

export function Daylight({
  d,
  day,
  onDay,
  label,
}: {
  d: SolarData
  day: number
  onDay: (n: number) => void
  label: string
}) {
  const W = 720,
    H = 260,
    M = { l: 48, r: 16, t: 16, b: 32 }
  const polar = d.polarDayCount > 0 || d.polarNightCount > 0
  const lo = polar ? 0 : Math.floor(Math.min(...d.daylight365) - 1)
  const hi = polar ? 24 : Math.ceil(Math.max(...d.daylight365) + 1)
  const x = scaleLinear()
    .domain([1, 365])
    .range([M.l, W - M.r])
  const y = scaleLinear()
    .domain([lo, hi])
    .range([H - M.b, M.t])
  const path =
    line<number>()
      .x((_, i) => x(i + 1))
      .y((h) => y(h))(d.daylight365) ?? ''
  const h = d.daylight365[day - 1]
  const prev = d.daylight365[(day + 363) % 365]
  const diff = Math.round((h - prev) * 60)
  const readout = `${dateOf(day)}: ${Math.floor(h)} h ${Math.round((h % 1) * 60)} min of daylight (${diff >= 0 ? '+' : '\u2212'}${Math.abs(diff)} min compared with the day before)`
  const move = (e: React.KeyboardEvent) => {
    const s =
      e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : e.key === 'PageUp'
            ? 30
            : e.key === 'PageDown'
              ? -30
              : 0
    if (s) {
      e.preventDefault()
      onDay(((day - 1 + s + 365) % 365) + 1)
    }
  }
  const point = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    onDay(Math.min(365, Math.max(1, Math.round(x.invert(px)))))
  }
  const { longestDay: lg, shortestDay: sh } = d
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={move}
        onPointerDown={point}
        onPointerMove={(e) => e.buttons === 1 && point(e)}
        style={{ touchAction: 'pan-y' }}
      >
        <text x={M.l} y={12}>
          Hours of daylight
        </text>
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--edge)"
              strokeOpacity={0.35}
            />
            <text x={M.l - 6} y={y(t) + 5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {MONTH_START.map((s, i) => (
          <text key={i} x={x(s + 15)} y={H - 10} textAnchor="middle">
            {MONTH_INITIALS[i]}
          </text>
        ))}
        <path d={path} fill="none" stroke="var(--series-b)" strokeWidth={2.5} />
        {d.reference.map((r) => (
          <g key={r.doy}>
            <circle cx={x(r.doy)} cy={y(r.hours)} r={4} fill="var(--ink)" />
            <text
              x={x(r.doy)}
              y={y(r.hours) - 8}
              textAnchor="middle"
              className="ink"
              style={{ fontSize: 12 }}
            >
              {hm(r.hours)}
            </text>
          </g>
        ))}
        <line
          x1={x(day)}
          x2={x(day)}
          y1={M.t}
          y2={H - M.b}
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
        <circle cx={x(day)} cy={y(h)} r={5} fill="var(--accent)" />
      </svg>
      <p className="readout" aria-live="polite">
        {readout || IDLE_READOUT}
      </p>
      <p>
        Longest day: {dateOf(lg.doy)}, {hm(lg.hours)}. Shortest day: {dateOf(sh.doy)},{' '}
        {hm(sh.hours)}.
      </p>
      {d.polarDayCount > 0 && <p>The sun does not set for {d.polarDayCount} days a year.</p>}
      {d.polarNightCount > 0 && <p>The sun does not rise for {d.polarNightCount} days a year.</p>}
      <DataTable
        caption="Daylight on reference days"
        head={['Date', 'Hours']}
        rows={d.reference.map((r) => [dateOf(r.doy), hm(r.hours)])}
      />
    </div>
  )
}
