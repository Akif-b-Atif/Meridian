import { scaleBand, scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT } from '../copy'
import { n1, thresholdLabel, type Units } from '../units'

interface MiniProps {
  title: string
  years: number[]
  values: (number | null)[]
  color: string
  means: { label: string; value: number }[]
}

function Mini({ title, years, values, color, means }: MiniProps) {
  const W = 340,
    H = 180,
    M = { l: 44, r: 8, t: 12, b: 28 }
  const { index, setIndex, onKeyDown } = useChartFocus(years.length)
  const allZero = values.every((v) => v === 0 || v === null)
  const x = scaleBand<number>()
    .domain(years.map((_, i) => i))
    .range([M.l, W - M.r])
    .padding(0.15)
  const y = scaleLinear()
    .domain([0, Math.max(1, ...values.map((v) => v ?? 0))])
    .nice()
    .range([H - M.b, M.t])
  const readout =
    index === null
      ? IDLE_READOUT
      : `${years[index]}: ${values[index] === null ? 'no data' : values[index]}`
  return (
    <figure style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16 }}>{title}</h3>
      {allZero ? (
        <p className="note" style={{ minHeight: H }}>
          None in this period.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart chart-focus"
          role="group"
          tabIndex={0}
          aria-label={`${title} by year`}
          onKeyDown={onKeyDown}
        >
          {y.ticks(4).map((t) => (
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
          {means.map((m, k) => (
            <line
              key={k}
              x1={means.length === 2 ? (k === 0 ? M.l : (M.l + W - M.r) / 2) : M.l}
              x2={means.length === 2 ? (k === 0 ? (M.l + W - M.r) / 2 : W - M.r) : W - M.r}
              y1={y(m.value)}
              y2={y(m.value)}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ))}
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
          {readout}
        </p>
      )}
    </figure>
  )
}

export function Extremes({ d, units }: { d: ClimateData; units: Units }) {
  const e = d.extremes
  const hw = e.heatwave
  const half = Math.min(15, Math.floor(e.years.length / 2))
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const hwEv = [
    { label: 'first', value: mean(hw.events.slice(0, half)) },
    { label: 'last', value: mean(hw.events.slice(-half)) },
  ]
  const hwDays = [
    { label: 'first', value: mean(hw.days.slice(0, half)) },
    { label: 'last', value: mean(hw.days.slice(-half)) },
  ]
  const hot30 = `Days at or above ${thresholdLabel(30, units)}`
  const hot35 = `Days at or above ${thresholdLabel(35, units)}`
  const frost = `Frost days (minimum below ${thresholdLabel(0, units)})`
  return (
    <div className="stack">
      <div className="grid-2">
        <Mini
          title={hot30}
          years={e.years}
          values={e.hot30}
          color="var(--series-a)"
          means={[{ label: 'mean', value: e.means.hot30 }]}
        />
        <Mini
          title={hot35}
          years={e.years}
          values={e.hot35}
          color="var(--series-a)"
          means={[{ label: 'mean', value: e.means.hot35 }]}
        />
        <Mini
          title={frost}
          years={e.years}
          values={e.frost}
          color="var(--series-b)"
          means={[{ label: 'mean', value: e.means.frost }]}
        />
        <Mini
          title="Wet days (1 mm or more)"
          years={e.years}
          values={e.wet}
          color="var(--series-b)"
          means={[{ label: 'mean', value: e.means.wet }]}
        />
        <Mini
          title="Heatwave events a year"
          years={e.years}
          values={hw.events}
          color="var(--series-a)"
          means={hwEv}
        />
        <Mini
          title="Heatwave days a year"
          years={e.years}
          values={hw.days}
          color="var(--series-a)"
          means={hwDays}
        />
      </div>
      <p className="note">
        A heatwave is at least 3 days in a row hotter than the 90th percentile of the same time of
        year, {e.years[0]} to {e.years[e.years.length - 1]}.
      </p>
      <DataTable
        caption="Extremes by year"
        head={['Year', 'Hot 30', 'Hot 35', 'Frost', 'Wet', 'Heatwave events', 'Heatwave days']}
        rows={e.years.map((y, i) => [
          y,
          e.hot30[i] ?? '–',
          e.hot35[i] ?? '–',
          e.frost[i] ?? '–',
          e.wet[i] ?? '–',
          hw.events[i],
          hw.days[i],
        ])}
      />
      <span className="sr-only">{n1(e.means.hot30)}</span>
    </div>
  )
}
