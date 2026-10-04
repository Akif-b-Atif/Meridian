import { scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { MONTH_FULL, SEASON_LABEL } from '../copy'
import { useWidth } from '../lib/hooks'
import { n0, n1, temp, tempNumber, tempUnit, type Units } from '../units'

/** Floating range bars: each bar runs from a season's typical overnight low to its typical
 *  afternoon high, with the average marked. All bars share one temperature axis. */
export function SeasonBars({
  d,
  units,
  label,
  highlight,
}: {
  d: ClimateData
  units: Units
  label: string
  highlight: number | null
}) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const rows = d.seasons
  const narrow = w < 560
  const labelW = narrow ? 0 : 150
  const left = labelW + 8
  const right = w - 12
  const rowH = narrow ? 92 : 64
  const H = rows.length * rowH + 44
  const lo = Math.min(...rows.map((r) => r.tmin))
  const hi = Math.max(...rows.map((r) => r.tmax))
  const x = scaleLinear()
    .domain([tempNumber(lo, units), tempNumber(hi, units)])
    .nice()
    .range([left, right])
  const maxRain = Math.max(...rows.map((r) => r.precip), 1)
  const span = (s: ClimateData['seasons'][number]) => {
    if (d.seasonMode === 'thermal') {
      const a = MONTH_FULL[s.firstMonth - 1].slice(0, 3)
      const b = MONTH_FULL[(s.firstMonth + 1) % 12].slice(0, 3)
      return `${a} to ${b}`
    }
    return `${n0(s.days / 30.4)} months`
  }
  const active = (s: ClimateData['seasons'][number]) =>
    highlight !== null &&
    d.seasonMode === 'thermal' &&
    [0, 1, 2].some((k) => (s.firstMonth - 1 + k) % 12 === highlight)

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
        <text x={left} y={14}>
          Typical low to high ({tempUnit(units)}), dot = average
        </text>
        {x.ticks(5).map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={24}
              y2={H - 22}
              stroke="var(--edge)"
              strokeOpacity={0.3}
            />
            <text x={x(t)} y={H - 4} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {rows.map((s, i) => {
          const top = 30 + i * rowH
          const cy = top + (narrow ? 50 : rowH / 2 - 4)
          const on = active(s)
          const x0 = x(tempNumber(s.tmin, units))
          const x1 = x(tempNumber(s.tmax, units))
          return (
            <g key={s.name}>
              {on && (
                <rect
                  x={0}
                  y={top - 4}
                  width={w}
                  height={rowH - 4}
                  fill="var(--accent)"
                  fillOpacity={0.08}
                />
              )}
              <text x={0} y={narrow ? top + 14 : cy + 5} className="strong lg">
                {SEASON_LABEL[s.name]}
                <tspan className="" dx={8} style={{ fontWeight: 400 }}>
                  {span(s)}
                </tspan>
              </text>
              <rect
                x={x0}
                y={cy - 8}
                width={Math.max(4, x1 - x0)}
                height={16}
                rx={2}
                fill="var(--series-a)"
                fillOpacity={0.3}
                stroke="var(--series-a)"
              />
              <circle cx={x(tempNumber(s.tmean, units))} cy={cy} r={6} fill="var(--series-a)" />
              <text x={x0 - 6} y={cy + 5} textAnchor="end" className="ink">
                {n1(tempNumber(s.tmin, units))}
              </text>
              <text x={x1 + 6} y={cy + 5} className="ink">
                {n1(tempNumber(s.tmax, units))}
              </text>
              <text x={left} y={cy + 30}>
                avg {temp(s.tmean, units)} · {n0(s.precip)} mm of rain
              </text>
              <rect
                x={Math.max(left + 200, w - 12 - 90)}
                y={cy + 20}
                width={(90 * s.precip) / maxRain}
                height={6}
                fill="var(--series-b)"
              />
            </g>
          )
        })}
      </svg>
      <DataTable
        caption="Seasonal statistics"
        head={[
          'Season',
          `Mean ${tempUnit(units)}`,
          `High ${tempUnit(units)}`,
          `Low ${tempUnit(units)}`,
          'Rain mm',
          'Days',
        ]}
        rows={rows.map((s) => [
          SEASON_LABEL[s.name],
          n1(tempNumber(s.tmean, units)),
          n1(tempNumber(s.tmax, units)),
          n1(tempNumber(s.tmin, units)),
          n0(s.precip),
          s.days,
        ])}
      />
    </div>
  )
}
