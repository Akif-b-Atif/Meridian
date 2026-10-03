import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { AirData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { AQI_BANDS, AQI_WORDS, IDLE_READOUT, SCALE_NAME } from '../copy'
import { n0, n1 } from '../units'

export function Air({ d, label }: { d: AirData; label: string }) {
  const W = 720,
    H = 260,
    M = { l: 48, r: 16, t: 40, b: 28 }
  const n = d.hourly.time.length
  const vals = d.hourly.pm25
  const x = scaleLinear()
    .domain([0, Math.max(1, n - 1)])
    .range([M.l, W - M.r])
  const y = scaleLinear()
    .domain([0, Math.max(25, ...vals.filter((v): v is number => v !== null))])
    .nice()
    .range([H - M.b, M.t])
  const gen = line<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => x(i))
    .y((v) => y(v as number))
  const { index, setIndex, onKeyDown } = useChartFocus(n)
  const dayStart = (date: string) => d.hourly.time.findIndex((t) => t.startsWith(date))
  const readout =
    index === null
      ? IDLE_READOUT
      : `${d.hourly.time[index].replace('T', ' ')}: PM2.5 ${vals[index] === null ? 'no data' : `${n1(vals[index] as number)} micrograms per cubic metre`}`
  const words = AQI_WORDS[d.scale]
  const bands = AQI_BANDS[d.scale]
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setIndex(
            Math.max(
              0,
              Math.min(n - 1, Math.round(x.invert(((e.clientX - r.left) / r.width) * W))),
            ),
          )
        }}
      >
        <text x={M.l} y={12}>
          PM2.5 (µg/m³)
        </text>
        {d.daily.map((day, k) => {
          const s = dayStart(day.date)
          const e = k + 1 < d.daily.length ? dayStart(d.daily[k + 1].date) : n - 1
          if (s < 0) return null
          return (
            <g key={day.date}>
              {k % 2 === 0 && (
                <rect
                  x={x(s)}
                  y={M.t}
                  width={Math.max(0, x(e) - x(s))}
                  height={H - M.t - M.b}
                  fill="var(--edge)"
                  fillOpacity={0.08}
                />
              )}
              <text
                x={(x(s) + x(e)) / 2}
                y={22}
                textAnchor="middle"
                className="ink"
                style={{ fontSize: 11 }}
              >
                {day.category === null ? '–' : words[day.category]}
              </text>
              <text x={(x(s) + x(e)) / 2} y={36} textAnchor="middle" style={{ fontSize: 11 }}>
                {day.aqiMax === null ? '–' : `${n0(day.aqiMax)}${day.partial ? ' (so far)' : ''}`}
              </text>
            </g>
          )
        })}
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
        <path d={gen(vals) ?? ''} fill="none" stroke="var(--series-a)" strokeWidth={2} />
        {index !== null && vals[index] !== null && (
          <circle cx={x(index)} cy={y(vals[index] as number)} r={4} fill="var(--accent)" />
        )}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <dl className="facts">
        <dt>Now (local {d.current.time.slice(11)})</dt>
        <dd>
          PM2.5 {d.current.pm25 ?? '–'}, PM10 {d.current.pm10 ?? '–'}, ozone{' '}
          {d.current.ozone ?? '–'} µg/m³; {SCALE_NAME[d.scale]} {d.current.aqi ?? '–'}
        </dd>
      </dl>
      <div className="scroll-x" tabIndex={0} role="region" aria-label="Index bands">
        <table>
          <caption>{SCALE_NAME[d.scale]} bands</caption>
          <thead>
            <tr>
              <th scope="col">Up to</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w, i) => (
              <tr key={w}>
                <th scope="row">
                  {i < bands.length ? bands[i] : `above ${bands[bands.length - 1]}`}
                </th>
                <td>{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        These are model values for a grid cell, not a measurement at a station.
      </p>
      <DataTable
        caption="Daily PM2.5"
        head={['Date', 'Mean PM2.5', 'Max AQI']}
        rows={d.daily.map((x) => [x.date, x.pm25Mean ?? '–', x.aqiMax ?? '–'])}
      />
    </div>
  )
}
