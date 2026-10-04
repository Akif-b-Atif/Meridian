import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { AirData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { AQI_BANDS, AQI_WORDS, IDLE_READOUT, SCALE_NAME } from '../copy'
import { WHO_PM25_24H } from '../copy/takeaways'
import { useWidth } from '../lib/hooks'
import { n0, n1 } from '../units'

/** Fine-particle pollution hour by hour for the last week. Each day carries its category word. */
export function AirChart({ d, label }: { d: AirData; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = 300
  const M = { l: 44, r: 12, t: 58, b: 30 }
  const n = d.hourly.time.length
  const vals = d.hourly.pm25
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([M.l, w - M.r])
  const top = Math.max(WHO_PM25_24H * 1.3, ...vals.filter((v): v is number => v !== null))
  const y = scaleLinear()
    .domain([0, top])
    .nice()
    .range([H - M.b, M.t])
  const gen = line<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => x(i))
    .y((v) => y(v as number))
  const { index, setIndex, onKeyDown } = useChartFocus(n)
  const dayStart = (date: string) => d.hourly.time.findIndex((t) => t.startsWith(date))
  const words = AQI_WORDS[d.scale]
  const narrow = w < 520
  const readout =
    index === null
      ? IDLE_READOUT
      : `${d.hourly.time[index].replace('T', ' ')}: ${vals[index] === null ? 'no data' : `${n1(vals[index] as number)} µg/m³ of fine particles`}`
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
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setIndex(Math.max(0, Math.min(n - 1, Math.round(x.invert(e.clientX - r.left)))))
        }}
      >
        <text x={M.l} y={14} className="strong">
          Fine particles, PM2.5 (µg/m³)
        </text>
        {d.daily.map((day, k) => {
          const s = dayStart(day.date)
          const e = k + 1 < d.daily.length ? dayStart(d.daily[k + 1].date) : n - 1
          if (s < 0) return null
          const mid = (x(s) + x(e)) / 2
          return (
            <g key={day.date}>
              {k % 2 === 0 && (
                <rect
                  x={x(s)}
                  y={M.t - 10}
                  width={Math.max(0, x(e) - x(s))}
                  height={H - M.b - M.t + 10}
                  fill="var(--edge)"
                  fillOpacity={0.1}
                />
              )}
              <text
                x={mid}
                y={30}
                textAnchor="middle"
                className="strong"
                style={{ fontSize: narrow ? 12 : 14 }}
              >
                {day.category === null
                  ? '–'
                  : narrow
                    ? words[day.category].split(' ')[0]
                    : words[day.category]}
              </text>
              <text x={mid} y={48} textAnchor="middle" style={{ fontSize: narrow ? 12 : 13 }}>
                {narrow ? day.date.slice(8) : day.date.slice(5)}
                {day.partial ? '*' : ''}
              </text>
            </g>
          )
        })}
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
        <line
          x1={M.l}
          x2={w - M.r}
          y1={y(WHO_PM25_24H)}
          y2={y(WHO_PM25_24H)}
          stroke="var(--ink)"
          strokeDasharray="6 4"
        />
        <text x={w - M.r} y={y(WHO_PM25_24H) - 6} textAnchor="end" className="ink">
          WHO 24-hour guideline: {WHO_PM25_24H}
        </text>
        <path d={gen(vals) ?? ''} fill="none" stroke="var(--series-a)" strokeWidth={2.5} />
        {index !== null && vals[index] !== null && (
          <circle cx={x(index)} cy={y(vals[index] as number)} r={5} fill="var(--accent)" />
        )}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <p className="note">
        * today so far. Day labels use the highest {SCALE_NAME[d.scale]} value of each day.
      </p>
      <DataTable
        caption="Daily fine particles"
        head={['Date', 'Mean PM2.5', `Highest ${SCALE_NAME[d.scale]}`]}
        rows={d.daily.map((x0) => [x0.date, x0.pm25Mean ?? '–', x0.aqiMax ?? '–'])}
      />
    </div>
  )
}

export function AqiBands({ d }: { d: AirData }) {
  const words = AQI_WORDS[d.scale]
  const bands = AQI_BANDS[d.scale]
  return (
    <div className="scroll-x" tabIndex={0} role="region" aria-label="Index bands">
      <table>
        <caption>{SCALE_NAME[d.scale]} bands</caption>
        <thead>
          <tr>
            <th scope="col">Index</th>
            <th scope="col">Category</th>
          </tr>
        </thead>
        <tbody>
          {words.map((wd, i) => (
            <tr key={wd}>
              <th scope="row">
                {i === 0
                  ? `0 to ${bands[0]}`
                  : i < bands.length
                    ? `${bands[i - 1] + 1} to ${bands[i]}`
                    : `above ${bands[bands.length - 1]}`}
              </th>
              <td>{wd}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Current reading: {d.current.aqi === null ? '–' : n0(d.current.aqi)}</p>
    </div>
  )
}
