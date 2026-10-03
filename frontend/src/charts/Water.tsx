import { scaleSymlog } from 'd3-scale'
import type { WaterData, WaterHit } from '../api/types'
import { DataTable } from '../components/Section'
import { compass } from '../copy'
import { dist, distNumber, distUnit, thresholdLabel, type Units, n0 } from '../units'

export function Water({
  d,
  units,
  label,
  city,
}: {
  d: WaterData
  units: Units
  label: string
  city: string
}) {
  const W = 720,
    H = 200,
    L = 120
  const rows: { name: string; hit: WaterHit | null; none: string }[] = [
    { name: 'Coast', hit: d.coast, none: '' },
    { name: 'Lake', hit: d.lake, none: 'No large lake in the dataset.' },
    { name: 'River', hit: d.river, none: 'No major river in the dataset.' },
  ]
  const max = Math.max(1, ...rows.map((r) => (r.hit ? distNumber(r.hit.km, units) : 0)))
  const x = scaleSymlog()
    .constant(10)
    .domain([0, max])
    .range([L, W - 24])
  const ticks = [0, 10, 50, 100, 500, 1000, 5000].filter((t) => t <= max)
  const cls =
    d.coastClass === 'coastal'
      ? 'Coastal'
      : d.coastClass === 'near-coast'
        ? 'Near the coast'
        : 'Inland'
  const thr =
    d.coastClass === 'coastal'
      ? `under ${dist(10, units)}`
      : d.coastClass === 'near-coast'
        ? `${dist(10, units)} to under ${dist(50, units)}`
        : `${dist(50, units)} or more`
  void thresholdLabel
  return (
    <div className="stack">
      <p>
        <strong>{cls}</strong> <span className="note">({thr} from the coast)</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
        <text x={L} y={12}>
          Distance ({distUnit(units)})
        </text>
        {rows.map((r, i) => {
          const cy = 40 + i * 50
          return (
            <g key={r.name}>
              <text x={0} y={cy + 5} className="ink">
                {r.name}
              </text>
              <line x1={L} x2={W - 24} y1={cy} y2={cy} stroke="var(--edge)" />
              {r.hit ? (
                <>
                  <circle
                    cx={x(distNumber(r.hit.km, units))}
                    cy={cy}
                    r={6}
                    fill="var(--series-b)"
                  />
                  <text
                    x={Math.min(x(distNumber(r.hit.km, units)) + 10, W - 200)}
                    y={cy - 10}
                    className="ink"
                    style={{ fontSize: 13 }}
                  >
                    {dist(r.hit.km, units)} {compass(r.hit.bearingDeg)}
                    {r.hit.name ? `, ${r.hit.name}` : ''}
                  </text>
                </>
              ) : (
                <text x={L + 8} y={cy - 10}>
                  {r.none}
                </text>
              )}
            </g>
          )
        })}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 4} textAnchor="middle" style={{ fontSize: 12 }}>
            {n0(t)}
          </text>
        ))}
      </svg>
      <p className="note">
        Coastline from Natural Earth at 1:10 million scale (accurate to a few kilometres); lakes and
        rivers are the large and major ones only.
      </p>
      <DataTable
        caption={`Nearest water to ${city}`}
        head={['Feature', 'Distance', 'Direction', 'Name']}
        rows={rows
          .filter((r) => r.hit)
          .map((r) => [
            r.name,
            dist(r.hit!.km, units),
            compass(r.hit!.bearingDeg),
            r.hit!.name ?? '–',
          ])}
      />
    </div>
  )
}
