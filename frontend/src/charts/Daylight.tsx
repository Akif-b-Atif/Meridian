import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { SolarData } from '../api/types'
import { DataTable } from '../components/Section'
import { MONTH_FULL, MONTH_START, dateOf } from '../copy'
import { useWidth } from '../lib/hooks'
import { hm } from '../units'

/** The 24 hours of the chosen date as a bar: light where the sun is up, outlined where it is not,
 *  centred on solar noon. */
export function DayStrip({ hours, label }: { hours: number; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = 74
  const x = scaleLinear()
    .domain([0, 24])
    .range([2, w - 2])
  const start = 12 - hours / 2
  return (
    <div ref={ref} className="chart-host">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart"
        role="img"
        aria-label={label}
      >
        <rect x={2} y={10} width={w - 4} height={26} fill="none" stroke="var(--edge)" />
        {hours > 0 && (
          <rect
            x={x(start)}
            y={10}
            width={x(start + hours) - x(start)}
            height={26}
            fill="var(--series-b)"
            fillOpacity={0.75}
          />
        )}
        {[0, 6, 12, 18, 24].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={36} y2={42} stroke="var(--edge)" />
            <text x={x(t)} y={58} textAnchor={t === 0 ? 'start' : t === 24 ? 'end' : 'middle'}>
              {t === 12 ? 'solar noon' : t === 0 || t === 24 ? 'midnight' : `${t}:00`}
            </text>
          </g>
        ))}
        {hours > 0 && hours < 24 && (
          <text
            x={x(12)}
            y={28}
            textAnchor="middle"
            className="strong"
            style={{ fill: 'var(--ground)' }}
          >
            {hm(hours)} of daylight
          </text>
        )}
        {hours <= 0 && (
          <text x={x(12)} y={28} textAnchor="middle" className="ink">
            No daylight
          </text>
        )}
      </svg>
    </div>
  )
}

/** Day length through the year, with today's (or the chosen) date marked and both extremes named. */
export function DaylightCurve({
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
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = w < 520 ? 270 : 320
  const M = { l: 44, r: 16, t: 30, b: 34 }
  const polar = d.polarDayCount > 0 || d.polarNightCount > 0
  const lo = polar ? 0 : Math.floor(Math.min(...d.daylight365) - 1)
  const hi = polar ? 24 : Math.ceil(Math.max(...d.daylight365) + 1)
  const x = scaleLinear()
    .domain([1, 365])
    .range([M.l, w - M.r])
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
  const readout = `${dateOf(day)}: ${hm(h)} of daylight, ${diff === 0 ? 'unchanged' : `${Math.abs(diff)} min ${diff > 0 ? 'longer' : 'shorter'}`} than the day before.`
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
    onDay(Math.min(365, Math.max(1, Math.round(x.invert(e.clientX - r.left)))))
  }
  const { longestDay: lg, shortestDay: sh } = d
  const above = (doy: number) => (doy < 60 || doy > 305 ? 'start' : 'middle')
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
        onKeyDown={move}
        onPointerDown={point}
        onPointerMove={(e) => e.buttons === 1 && point(e)}
        style={{ touchAction: 'pan-y' }}
      >
        <text x={M.l} y={14} className="strong">
          Hours of daylight
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
        {MONTH_START.map((s, i) => (
          <text key={i} x={x(s + 15)} y={H - 10} textAnchor="middle">
            {w >= 520 ? MONTH_FULL[i].slice(0, 3) : MONTH_FULL[i][0]}
          </text>
        ))}
        <path d={path} fill="none" stroke="var(--series-b)" strokeWidth={3} />
        {!polar && (
          <>
            <circle cx={x(lg.doy)} cy={y(lg.hours)} r={5} fill="var(--ink)" />
            <text x={x(lg.doy)} y={y(lg.hours) - 10} textAnchor={above(lg.doy)} className="ink">
              Longest: {dateOf(lg.doy)}, {hm(lg.hours)}
            </text>
            <circle cx={x(sh.doy)} cy={y(sh.hours)} r={5} fill="var(--ink)" />
            <text x={x(sh.doy)} y={y(sh.hours) + 22} textAnchor={above(sh.doy)} className="ink">
              Shortest: {dateOf(sh.doy)}, {hm(sh.hours)}
            </text>
          </>
        )}
        <line
          x1={x(day)}
          x2={x(day)}
          y1={M.t}
          y2={H - M.b}
          stroke="var(--accent)"
          strokeWidth={2}
        />
        <circle cx={x(day)} cy={y(h)} r={6} fill="var(--accent)" />
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <DataTable
        caption="Daylight on reference days"
        head={['Date', 'Daylight']}
        rows={d.reference.map((r) => [dateOf(r.doy), hm(r.hours)])}
      />
    </div>
  )
}
