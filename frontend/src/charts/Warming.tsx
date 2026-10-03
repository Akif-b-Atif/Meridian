import { scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT } from '../copy'
import { deltaNumber, delta, n1, n2, tempNumber, tempUnit, type Units } from '../units'
import { DIVERGING, divergingColor } from './scales'

export function Stripes({
  d,
  units,
  theme,
  label,
}: {
  d: ClimateData
  units: Units
  theme: 'light' | 'dark'
  label: string
}) {
  const W = 720
  const years = d.annualAnomaly.length
  const first = d.dataWindow.trendStart
  const w = W / years
  const { index, setIndex, onKeyDown } = useChartFocus(years)
  const lim = d.stripesLimit
  const legend = DIVERGING[theme]
  const labels = [-lim, 0, lim]
  const readout =
    index === null
      ? IDLE_READOUT
      : d.annualAnomaly[index] === null
        ? `${first + index}: no data`
        : `${first + index}: ${delta(d.annualAnomaly[index] as number, units)} compared with ${d.baseline.start} to ${d.baseline.end}`
  return (
    <div>
      <svg
        viewBox="0 0 720 110"
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {d.annualAnomaly.map((a, k) => (
          <rect
            key={k}
            x={k * w}
            y={0}
            width={w + 0.5}
            height={90}
            fill={a === null ? 'none' : divergingColor(a, lim, theme)}
            stroke={a === null ? 'var(--edge)' : k === index ? 'var(--ink)' : 'none'}
            strokeWidth={1}
            onPointerEnter={() => setIndex(k)}
          />
        ))}
        {Array.from(
          { length: Math.floor(years / 10) + 1 },
          (_, k) => first + Math.ceil(0 / 10) + k * 10,
        )
          .filter((y) => y <= first + years - 1 && y % 10 === 0)
          .map((y) => (
            <text key={y} x={(y - first) * w} y={106}>
              {y}
            </text>
          ))}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <div
        style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
        aria-label="Colour scale"
      >
        {legend.map((c, k) => (
          <span
            key={k}
            style={{ width: 16, height: 16, background: c, display: 'inline-block' }}
            aria-hidden="true"
          />
        ))}
        <span className="note" style={{ marginLeft: 8 }}>
          {delta(labels[0], units)} to {delta(labels[2], units)} compared with {d.baseline.start} to{' '}
          {d.baseline.end}
        </span>
      </div>
    </div>
  )
}

export function TrendPlot({ d, units, label }: { d: ClimateData; units: Units; label: string }) {
  const W = 720,
    H = 300,
    M = { l: 52, r: 16, t: 16, b: 32 }
  const first = d.dataWindow.trendStart
  const pts = d.annualMean.map((v, k) => ({ year: first + k, v })).filter((p) => p.v !== null) as {
    year: number
    v: number
  }[]
  const vals = pts.map((p) => tempNumber(p.v, units))
  const x = scaleLinear()
    .domain([first, first + d.annualMean.length - 1])
    .range([M.l, W - M.r])
  const y = scaleLinear()
    .domain([
      Math.min(...vals) - deltaNumber(0.5, units),
      Math.max(...vals) + deltaNumber(0.5, units),
    ])
    .nice()
    .range([H - M.b, M.t])
  const t = d.trend.annual
  const sorted = [...pts.map((p) => p.year)].sort((a, b) => a - b)
  const medX = sorted[Math.floor(sorted.length / 2)]
  const medY = [...pts.map((p) => p.v)].sort((a, b) => a - b)[Math.floor(pts.length / 2)]
  const lineAt = (slope: number, yr: number) => y(tempNumber(medY + slope * (yr - medX), units))
  const x0 = first,
    x1 = first + d.annualMean.length - 1
  const { index, setIndex, onKeyDown } = useChartFocus(pts.length)
  const readout =
    index === null
      ? IDLE_READOUT
      : `${pts[index].year}: ${n1(tempNumber(pts[index].v, units))} ${tempUnit(units)}`
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <text x={M.l} y={12}>
          Annual mean ({tempUnit(units)})
        </text>
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--edge)"
              strokeOpacity={0.35}
            />
            <text x={M.l - 6} y={y(v) + 5} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {x.ticks(8).map((v) => (
          <text key={v} x={x(v)} y={H - 10} textAnchor="middle">
            {v}
          </text>
        ))}
        {d.decades.map((dec) => (
          <line
            key={dec.decade}
            x1={x(Math.max(first, dec.decade))}
            x2={x(Math.min(x1, dec.decade + 9))}
            y1={y(tempNumber(dec.mean, units))}
            y2={y(tempNumber(dec.mean, units))}
            stroke="var(--accent)"
            strokeWidth={3}
          />
        ))}
        {pts.map((p, k) => (
          <circle
            key={p.year}
            cx={x(p.year)}
            cy={y(tempNumber(p.v, units))}
            r={k === index ? 5 : 3}
            fill="var(--ink)"
            fillOpacity={0.6}
            onPointerEnter={() => setIndex(k)}
          />
        ))}
        {t && (
          <>
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={lineAt(t.slopePerYear, x0)}
              y2={lineAt(t.slopePerYear, x1)}
              stroke="var(--series-a)"
              strokeWidth={2.5}
            />
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={lineAt(t.slopeLo, x0)}
              y2={lineAt(t.slopeLo, x1)}
              stroke="var(--series-a)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={lineAt(t.slopeHi, x0)}
              y2={lineAt(t.slopeHi, x1)}
              stroke="var(--series-a)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={x(x1) - 4}
              y={lineAt(t.slopePerYear, x1) - 8}
              textAnchor="end"
              style={{ fill: 'var(--series-a)' }}
            >
              Trend
            </text>
          </>
        )}
        {d.decades.length > 0 && (
          <text x={x(first) + 4} y={y(tempNumber(d.decades[0].mean, units)) - 8} className="ink">
            Decade mean
          </text>
        )}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <DataTable
        caption="Annual mean temperature"
        head={['Year', `Mean ${tempUnit(units)}`]}
        rows={pts.map((p) => [p.year, n2(tempNumber(p.v, units))])}
      />
    </div>
  )
}
