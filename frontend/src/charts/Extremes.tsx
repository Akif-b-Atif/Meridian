import { scaleBand, scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT } from '../copy'
import { extremesPairs, pairSentence, type Pair } from '../copy/takeaways'
import { useWidth } from '../lib/hooks'
import { n1, thresholdLabel, type Units } from '../units'

/** Before and after: for each measure, the average of the earlier half of the period (open dot)
 *  against the later half (filled dot). The line between them is the change. */
export function Dumbbells({
  pairs,
  firstLabel,
  lastLabel,
  label,
}: {
  pairs: Pair[]
  firstLabel: string
  lastLabel: string
  label: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const narrow = w < 560
  const rowH = 70
  const H = pairs.length * rowH + 40
  const left = 16
  const right = w - 16
  return (
    <div ref={ref} className="chart-host">
      <div className="legend">
        <span className="k">
          <svg width="16" height="16" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="var(--ground)"
              stroke="var(--series-a)"
              strokeWidth="2.5"
            />
          </svg>
          {firstLabel}
        </span>
        <span className="k">
          <svg width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="var(--series-a)" />
          </svg>
          {lastLabel}
        </span>
      </div>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart"
        role="img"
        aria-label={label}
      >
        {pairs.map((p, i) => {
          const max = Math.max(p.earlier, p.later, 1) * 1.25
          const x = scaleLinear()
            .domain([0, max])
            .range([left, right - (narrow ? 0 : 150)])
          const top = i * rowH + 8
          const cy = top + 40
          const a = x(p.earlier)
          const b = x(p.later)
          return (
            <g key={p.label}>
              <text x={left} y={top + 14} className="strong lg">
                {p.label}
              </text>
              <line
                x1={left}
                x2={right - (narrow ? 0 : 150)}
                y1={cy}
                y2={cy}
                stroke="var(--edge)"
                strokeOpacity={0.35}
              />
              <line x1={a} x2={b} y1={cy} y2={cy} stroke="var(--series-a)" strokeWidth={4} />
              <circle
                cx={a}
                cy={cy}
                r={8}
                fill="var(--ground)"
                stroke="var(--series-a)"
                strokeWidth={2.5}
              />
              <circle cx={b} cy={cy} r={9} fill="var(--series-a)" />
              <text x={a} y={cy - 14} textAnchor={b >= a ? 'end' : 'start'} className="ink">
                {n1(p.earlier)}
              </text>
              <text x={b} y={cy - 14} textAnchor={b >= a ? 'start' : 'end'} className="strong">
                {n1(p.later)}
              </text>
              {!narrow && (
                <text x={right} y={cy + 5} textAnchor="end" className="ink">
                  {pairSentence(p)}
                </text>
              )}
              {narrow && (
                <text x={left} y={cy + 28}>
                  {p.unit}: {pairSentence(p)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <DataTable
        caption="Earlier half against later half"
        head={['Measure', firstLabel, lastLabel]}
        rows={pairs.map((p) => [p.label, n1(p.earlier), n1(p.later)])}
      />
    </div>
  )
}

export function Mini({
  title,
  years,
  values,
  color,
}: {
  title: string
  years: number[]
  values: (number | null)[]
  color: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>(320)
  const H = 170
  const M = { l: 40, r: 8, t: 8, b: 28 }
  const { index, setIndex, onKeyDown } = useChartFocus(years.length)
  const allZero = values.every((v) => !v)
  const x = scaleBand<number>()
    .domain(years.map((_, i) => i))
    .range([M.l, w - M.r])
    .padding(0.15)
  const y = scaleLinear()
    .domain([0, Math.max(1, ...values.map((v) => v ?? 0))])
    .nice()
    .range([H - M.b, M.t])
  return (
    <figure ref={ref} style={{ margin: 0 }}>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      {allZero ? (
        <p className="note" style={{ minHeight: 60 }}>
          None in this period.
        </p>
      ) : (
        <svg
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          className="chart chart-focus"
          role="group"
          tabIndex={0}
          aria-label={`${title} by year`}
          onKeyDown={onKeyDown}
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
                {t}
              </text>
            </g>
          ))}
          {values.map((v, i) =>
            v === null ? (
              <circle
                key={i}
                cx={(x(i) ?? 0) + x.bandwidth() / 2}
                cy={H - M.b}
                r={3}
                fill="none"
                stroke="var(--edge)"
              />
            ) : (
              <rect
                key={i}
                x={x(i)}
                width={x.bandwidth()}
                y={y(v)}
                height={H - M.b - y(v)}
                fill={color}
                fillOpacity={i === index ? 1 : 0.8}
                onPointerEnter={() => setIndex(i)}
              />
            ),
          )}
          {[0, years.length - 1].map((i) => (
            <text
              key={i}
              x={(x(i) ?? 0) + x.bandwidth() / 2}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {years[i]}
            </text>
          ))}
        </svg>
      )}
      {!allZero && (
        <p className="readout" aria-live="polite">
          {index === null ? IDLE_READOUT : `${years[index]}: ${values[index] ?? 'no data'}`}
        </p>
      )}
    </figure>
  )
}

export function YearByYear({ d, units }: { d: ClimateData; units: Units }) {
  const e = d.extremes
  return (
    <div className="stack">
      <div className="cols-2">
        <Mini
          title={`Days at or above ${thresholdLabel(30, units)}`}
          years={e.years}
          values={e.hot30}
          color="var(--series-a)"
        />
        <Mini
          title={`Days at or above ${thresholdLabel(35, units)}`}
          years={e.years}
          values={e.hot35}
          color="var(--series-a)"
        />
        <Mini
          title={`Frost days (below ${thresholdLabel(0, units)})`}
          years={e.years}
          values={e.frost}
          color="var(--series-b)"
        />
        <Mini
          title="Rainy days (1 mm or more)"
          years={e.years}
          values={e.wet}
          color="var(--series-b)"
        />
        <Mini
          title="Heatwaves a year"
          years={e.years}
          values={e.heatwave.events}
          color="var(--series-a)"
        />
        <Mini
          title="Heatwave days a year"
          years={e.years}
          values={e.heatwave.days}
          color="var(--series-a)"
        />
      </div>
      <DataTable
        caption="Extremes by year"
        head={['Year', 'Hot', 'Very hot', 'Frost', 'Rainy', 'Heatwaves', 'Heatwave days']}
        rows={e.years.map((y, i) => [
          y,
          e.hot30[i] ?? '–',
          e.hot35[i] ?? '–',
          e.frost[i] ?? '–',
          e.wet[i] ?? '–',
          e.heatwave.events[i],
          e.heatwave.days[i],
        ])}
      />
    </div>
  )
}

export { extremesPairs }
