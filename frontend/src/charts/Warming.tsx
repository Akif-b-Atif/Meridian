import { scaleBand, scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT } from '../copy'
import { useWidth } from '../lib/hooks'
import { delta, deltaNumber, n1, n2, temp, tempNumber, tempUnit, type Units } from '../units'
import { DIVERGING, divergingColor } from './scales'

type Theme = 'light' | 'dark'

/** One coloured stripe per year, blue-grey for cooler than the 1961 to 1990 average and brick for
 *  warmer. The coolest and warmest years are marked. */
export function Stripes({
  d,
  units,
  theme,
  label,
}: {
  d: ClimateData
  units: Units
  theme: Theme
  label: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const years = d.annualAnomaly.length
  const first = d.dataWindow.trendStart
  const bw = w / years
  const H = 150
  const { index, setIndex, onKeyDown } = useChartFocus(years)
  const lim = d.stripesLimit
  const valid = d.annualAnomaly
    .map((a, i) => ({ a, i }))
    .filter((p): p is { a: number; i: number } => p.a !== null)
  const cool = valid.reduce((a, b) => (b.a < a.a ? b : a))
  const warm = valid.reduce((a, b) => (b.a > a.a ? b : a))
  const mark = (p: { a: number; i: number }, text: string, anchorEnd = false) => {
    const xx = p.i * bw + bw / 2
    return (
      <g>
        <line x1={xx} x2={xx} y1={88} y2={104} stroke="var(--ink)" strokeWidth={1.5} />
        <text x={xx} y={122} textAnchor={anchorEnd ? 'end' : 'start'} className="ink">
          {text}
        </text>
        <text x={xx} y={140} textAnchor={anchorEnd ? 'end' : 'start'}>
          {first + p.i}
        </text>
      </g>
    )
  }
  const readout =
    index === null
      ? IDLE_READOUT
      : d.annualAnomaly[index] === null
        ? `${first + index}: no data`
        : `${first + index}: ${delta(d.annualAnomaly[index] as number, units)} compared with the ${d.baseline.start}–${d.baseline.end} average (${d.annualMean[index] === null ? '' : temp(d.annualMean[index] as number, units)}).`
  return (
    <div ref={ref} className="chart-host">
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', marginBottom: 8 }}
        aria-label="Colour scale"
      >
        <span className="note" style={{ marginRight: 8 }}>
          Cooler than {d.baseline.start}–{d.baseline.end} average
        </span>
        {DIVERGING[theme].map((c, k) => (
          <span
            key={k}
            style={{ width: 18, height: 14, background: c, display: 'inline-block' }}
            aria-hidden="true"
          />
        ))}
        <span className="note" style={{ marginLeft: 8 }}>
          Warmer
        </span>
      </div>
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
        {d.annualAnomaly.map((a, k) => (
          <rect
            key={k}
            x={k * bw}
            y={0}
            width={bw + 0.6}
            height={84}
            fill={a === null ? 'none' : divergingColor(a, lim, theme)}
            stroke={a === null ? 'var(--edge)' : k === index ? 'var(--ink)' : 'none'}
            onPointerEnter={() => setIndex(k)}
          />
        ))}
        {Array.from({ length: years }, (_, k) => first + k)
          .filter((y) => y % 10 === 0)
          .map((y) => (
            <g key={y}>
              <line
                x1={(y - first) * bw}
                x2={(y - first) * bw}
                y1={84}
                y2={92}
                stroke="var(--edge)"
              />
              <text x={(y - first) * bw} y={H - 2} textAnchor="middle" style={{ fontSize: 13 }}>
                {y}
              </text>
            </g>
          ))}
        {mark(cool, `Coolest ${delta(cool.a, units)}`, cool.i > years * 0.6)}
        {mark(warm, `Warmest ${delta(warm.a, units)}`, warm.i > years * 0.6)}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
    </div>
  )
}

/** Ten-year averages as dots on a stem, with the change from first to last decade spelled out. */
export function DecadeDots({ d, units, label }: { d: ClimateData; units: Units; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const dec = d.decades
  const H = 280
  const M = { l: 48, r: 24, t: 36, b: 36 }
  const vals = dec.map((x) => tempNumber(x.mean, units))
  const pad = deltaNumber(0.4, units)
  const y = scaleLinear()
    .domain([Math.min(...vals) - pad, Math.max(...vals) + pad])
    .nice()
    .range([H - M.b, M.t])
  const x = scaleBand<number>()
    .domain(dec.map((_, i) => i))
    .range([M.l, w - M.r])
    .padding(0.3)
  const cx = (i: number) => (x(i) ?? 0) + x.bandwidth() / 2
  const diff = dec.length > 1 ? dec[dec.length - 1].mean - dec[0].mean : 0
  const last = dec.length - 1
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
        <text x={M.l} y={14} className="strong">
          Average yearly temperature ({tempUnit(units)}), by decade
        </text>
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
        {dec.length > 1 && (
          <>
            <line
              x1={cx(0)}
              x2={w - M.r}
              y1={y(vals[0])}
              y2={y(vals[0])}
              stroke="var(--ink)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <line
              x1={cx(last)}
              x2={cx(last)}
              y1={y(vals[0])}
              y2={y(vals[last])}
              stroke="var(--accent)"
              strokeWidth={3}
            />
            <text
              x={cx(last) - 8}
              y={(y(vals[0]) + y(vals[last])) / 2 + 5}
              textAnchor="end"
              className="strong"
              style={{ fill: 'var(--accent)' }}
            >
              {delta(diff, units)}
            </text>
          </>
        )}
        {dec.map((x0, i) => (
          <g key={x0.decade}>
            <line
              x1={cx(i)}
              x2={cx(i)}
              y1={H - M.b}
              y2={y(vals[i])}
              stroke="var(--series-a)"
              strokeWidth={2}
            />
            <circle cx={cx(i)} cy={y(vals[i])} r={7} fill="var(--series-a)" />
            <text x={cx(i)} y={y(vals[i]) - 14} textAnchor="middle" className="ink">
              {n1(vals[i])}
            </text>
            <text x={cx(i)} y={H - 12} textAnchor="middle">
              {x0.decade}s{x0.years < 10 ? '*' : ''}
            </text>
          </g>
        ))}
      </svg>
      {dec.some((x0) => x0.years < 10) && <p className="note">* the decade is not yet complete.</p>}
      <DataTable
        caption="Decade averages"
        head={['Decade', `Mean ${tempUnit(units)}`, 'Years counted']}
        rows={dec.map((x0) => [`${x0.decade}s`, n2(tempNumber(x0.mean, units)), x0.years])}
      />
    </div>
  )
}

/** Every year as a dot with the fitted trend line and its 95% range. For the curious. */
export function TrendScatter({ d, units, label }: { d: ClimateData; units: Units; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = 300
  const M = { l: 48, r: 16, t: 28, b: 32 }
  const first = d.dataWindow.trendStart
  const pts = d.annualMean
    .map((v, k) => ({ year: first + k, v }))
    .filter((p): p is { year: number; v: number } => p.v !== null)
  const vals = pts.map((p) => tempNumber(p.v, units))
  const x = scaleLinear()
    .domain([first, first + d.annualMean.length - 1])
    .range([M.l, w - M.r])
  const pad = deltaNumber(0.5, units)
  const y = scaleLinear()
    .domain([Math.min(...vals) - pad, Math.max(...vals) + pad])
    .nice()
    .range([H - M.b, M.t])
  const t = d.trend.annual
  const sx = [...pts.map((p) => p.year)].sort((a, b) => a - b)
  const medX = sx[Math.floor(sx.length / 2)]
  const medY = [...pts.map((p) => p.v)].sort((a, b) => a - b)[Math.floor(pts.length / 2)]
  const at = (slope: number, yr: number) => y(tempNumber(medY + slope * (yr - medX), units))
  const x0 = first
  const x1 = first + d.annualMean.length - 1
  const { index, setIndex, onKeyDown } = useChartFocus(pts.length)
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
        <text x={M.l} y={14}>
          Each dot is one year ({tempUnit(units)}). Solid line: trend. Dashed: 95% range of the
          slope.
        </text>
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line
              x1={M.l}
              x2={w - M.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--edge)"
              strokeOpacity={0.3}
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
              y1={at(t.slopePerYear, x0)}
              y2={at(t.slopePerYear, x1)}
              stroke="var(--series-a)"
              strokeWidth={2.5}
            />
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={at(t.slopeLo, x0)}
              y2={at(t.slopeLo, x1)}
              stroke="var(--series-a)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={at(t.slopeHi, x0)}
              y2={at(t.slopeHi, x1)}
              stroke="var(--series-a)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          </>
        )}
      </svg>
      <p className="readout" aria-live="polite">
        {index === null ? IDLE_READOUT : `${pts[index].year}: ${temp(pts[index].v, units)}`}
      </p>
      <DataTable
        caption="Annual mean temperature"
        head={['Year', `Mean ${tempUnit(units)}`]}
        rows={pts.map((p) => [p.year, n2(tempNumber(p.v, units))])}
      />
    </div>
  )
}
