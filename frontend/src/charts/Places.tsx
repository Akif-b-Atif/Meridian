import { useMemo } from 'react'
import type { PlacesData } from '../api/types'
import { COUNT_KEYS } from '../api/types'
import { CountUp } from '../components/CountUp'
import { DataTable } from '../components/Section'
import { CATEGORY_WORD, COUNT_LABEL, SOURCE_LABEL } from '../copy'
import { evenSpacingM } from '../lib/geo'
import { dist, n0, type Units } from '../units'

const UNIT_NOUN: Record<string, string> = {
  foodAndDrink: 'restaurant or cafe',
  healthcare: 'hospital or clinic',
  pharmacies: 'pharmacy',
  schools: 'school',
  universities: 'university',
  museums: 'museum',
  attractions: 'attraction',
  hotels: 'hotel',
  parks: 'park',
  railwayStations: 'station',
  busStops: 'bus stop',
  historicSites: 'historic site',
  airports: 'airport',
}

/** Big counts, one per category, each with how far apart they would be if spread evenly. */
export function PlaceTiles({ d, units }: { d: PlacesData; units: Units }) {
  const rows = useMemo(() => {
    if (!d.counts) return []
    return COUNT_KEYS.map((k) => ({ k, n: d.counts![k] }))
      .filter((r): r is { k: (typeof COUNT_KEYS)[number]; n: number } => r.n !== null)
      .sort((a, b) => b.n - a.n)
  }, [d])
  if (!d.counts) return <p>Place counts are unavailable right now.</p>
  const max = Math.max(1, ...rows.map((r) => r.n))
  const spacing = (k: string, n: number) => {
    if (k === 'airports') return 'counted within 30 km of the centre'
    const m = evenSpacingM(d.areaKm2, n)
    if (m === null) return 'none mapped'
    const km = m / 1000
    return `about one ${UNIT_NOUN[k]} every ${km < 1 ? `${n0(Math.round(m / 10) * 10)} m` : dist(km, units)}, if spread evenly`
  }
  return (
    <div className="stack">
      <div className="tiles">
        {rows.map((r) => (
          <div className="tile" key={r.k}>
            <div className="num">
              <CountUp value={r.n} format={(x) => n0(Math.round(x))} />
            </div>
            <div className="lab">{COUNT_LABEL[r.k]}</div>
            <div className="sub">{spacing(r.k, r.n)}</div>
            <div
              className="bar"
              style={{ width: `${Math.max(3, (100 * r.n) / max)}%` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
      <DataTable
        caption="Mapped places by category"
        head={['Category', 'Count', 'Per km²']}
        rows={COUNT_KEYS.map((k) => [COUNT_LABEL[k], d.counts![k] ?? '–', d.perKm2?.[k] ?? '–'])}
      />
    </div>
  )
}

export function NotableList({
  d,
  units,
  onShow,
}: {
  d: PlacesData
  units: Units
  onShow: (p: { lat: number; lon: number }) => void
}) {
  if (!d.notable.length) return null
  return (
    <div className="scroll-x" tabIndex={0} role="region" aria-label="Notable places">
      <table>
        <caption>Notable places, ranked by Wikipedia page views where available</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">From centre</th>
            <th scope="col">Source</th>
            <th scope="col">
              <span className="sr-only">Map</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {d.notable.map((p) => (
            <tr key={`${p.name}-${p.lat}`}>
              <th scope="row">
                {p.wikipediaTitle ? (
                  <a
                    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipediaTitle.replace(/ /g, '_'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.name}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  p.name
                )}
                {p.views30d !== null && (
                  <div className="note">{n0(p.views30d)} page views in 30 days</div>
                )}
              </th>
              <td>{CATEGORY_WORD[p.category]}</td>
              <td>{dist(p.distanceKm, units)}</td>
              <td>{SOURCE_LABEL[p.source]}</td>
              <td>
                <button type="button" onClick={() => onShow(p)}>
                  Show on map
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
