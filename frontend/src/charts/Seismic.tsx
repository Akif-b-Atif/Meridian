import { scaleLinear, scaleBand, scaleLog } from 'd3-scale'
import type { SeismicData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT } from '../copy'
import { dist, n0, n1, n2, type Units } from '../units'

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
      const [a, ra] = stops[i - 1],
        [b, rb] = stops[i]
      return ra + ((m - a) / (b - a)) * (rb - ra)
    }
  }
  return 40
}

export function Scatter({ d, units, label }: { d: SeismicData; units: Units; label: string }) {
  const W = 720,
    H = 300,
    M = { l: 48, r: 16, t: 16, b: 32 }
  const p = d.points
  const t0 = Number(d.start.slice(0, 4)),
    t1 = Number(d.end.slice(0, 4)) + 1
  const maxMag = Math.ceil(Math.max(...p.mag, 5) * 2) / 2
  const x = scaleLinear()
    .domain([t0, t1])
    .range([M.l, W - M.r])
  const y = scaleLinear()
    .domain([4.5, maxMag])
    .range([H - M.b, M.t])
  const { index, setIndex, onKeyDown } = useChartFocus(p.t.length)
  const readout =
    index === null
      ? IDLE_READOUT
      : `${Math.floor(p.t[index])}: magnitude ${n1(p.mag[index])}, depth ${dist(p.depth[index], units)}`
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
          Magnitude
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
        {x.ticks(8).map((t) => (
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
        {readout}
      </p>
    </div>
  )
}

export function PerYear({ d }: { d: SeismicData }) {
  const W = 340,
    H = 200,
    M = { l: 40, r: 8, t: 12, b: 28 }
  const c = d.perYear.counts
  const x = scaleBand<number>()
    .domain(c.map((_, i) => i))
    .range([M.l, W - M.r])
    .padding(0.1)
  const y = scaleLinear()
    .domain([0, Math.max(1, ...c)])
    .nice()
    .range([H - M.b, M.t])
  return (
    <figure style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16 }}>Events per year</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label="Earthquakes of magnitude 4.5 or more per calendar year"
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
            <text x={W - M.r} y={H - 8} textAnchor="end">
              {d.perYear.firstYear + c.length - 1}
            </text>
          </>
        )}
      </svg>
    </figure>
  )
}

export function GutenbergRichter({ d }: { d: SeismicData }) {
  const W = 340,
    H = 200,
    M = { l: 40, r: 8, t: 12, b: 28 }
  const g = d.gr
  const pts = g.counts.map((n, i) => ({ m: g.m0 + i * g.step, n })).filter((p) => p.n > 0)
  const x = scaleLinear()
    .domain([g.m0, Math.max(g.m0 + 1, pts[pts.length - 1]?.m ?? g.m0 + 1)])
    .range([M.l, W - M.r])
  const y = scaleLog()
    .domain([1, Math.max(10, g.counts[0])])
    .range([H - M.b, M.t])
  let fit: React.ReactNode = null
  if (d.b !== null && d.mc !== null) {
    const nc = d.nc
    const a = Math.log10(nc) + d.b * d.mc
    const f = (m: number) => Math.max(1, 10 ** (a - d.b! * m))
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
    <figure style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16 }}>Magnitude and frequency</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label="Cumulative number of earthquakes at or above each magnitude, log scale"
      >
        {y.ticks(3).map((t) => (
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
              {n0(t)}
            </text>
          </g>
        ))}
        {x.ticks(5).map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        {pts.map((p) => (
          <circle key={p.m} cx={x(p.m)} cy={y(p.n)} r={2.5} fill="var(--series-b)" />
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
