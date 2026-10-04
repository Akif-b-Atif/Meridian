import type { WaterData, WaterHit } from '../api/types'
import { DataTable } from '../components/Section'
import { compass } from '../copy'
import { dist, type Units } from '../units'

function Dial({ bearing }: { bearing: number }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Points ${compass(bearing)}`}
    >
      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--edge)" strokeWidth="2" />
      <text x="32" y="14" textAnchor="middle" style={{ fontSize: 12 }}>
        N
      </text>
      <g transform={`rotate(${bearing} 32 32)`}>
        <path
          d="M32 18 L38 36 L32 33 L26 36 Z"
          fill="var(--series-b)"
          stroke="var(--series-b)"
          strokeLinejoin="round"
        />
        <line x1="32" y1="33" x2="32" y2="46" stroke="var(--series-b)" strokeWidth="2" />
      </g>
    </svg>
  )
}

function Card({
  title,
  hit,
  none,
  units,
}: {
  title: string
  hit: WaterHit | null
  none: string
  units: Units
}) {
  return (
    <div className="card">
      {hit ? (
        <Dial bearing={hit.bearingDeg} />
      ) : (
        <svg width="64" height="64" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="var(--edge)"
            strokeDasharray="4 4"
            strokeWidth="2"
          />
        </svg>
      )}
      <div>
        <div className="note">{title}</div>
        {hit ? (
          <>
            <div className="big">{dist(hit.km, units)}</div>
            <div>
              {compass(hit.bearingDeg)}
              {hit.name ? `, ${hit.name}` : ''}
            </div>
          </>
        ) : (
          <div>{none}</div>
        )}
      </div>
    </div>
  )
}

/** Three compass dials: how far, and in which direction, the nearest sea, lake and river are. */
export function WaterCards({ d, units, city }: { d: WaterData; units: Units; city: string }) {
  const rows = [
    ['Coast', d.coast],
    ['Lake', d.lake],
    ['River', d.river],
  ] as const
  return (
    <div className="stack">
      <div className="cards">
        <Card title="Nearest coast" hit={d.coast} none="" units={units} />
        <Card
          title="Nearest large lake"
          hit={d.lake}
          none="No large lake in the dataset."
          units={units}
        />
        <Card
          title="Nearest major river"
          hit={d.river}
          none="No major river in the dataset."
          units={units}
        />
      </div>
      <p className="note">
        Straight-line distances. The arrow points the way from the city centre. Coastline is
        accurate to a few kilometres; only large lakes and major rivers are included.
      </p>
      <DataTable
        caption={`Nearest water to ${city}`}
        head={['Feature', 'Distance', 'Direction', 'Name']}
        rows={rows
          .filter(([, h]) => h)
          .map(([n, h]) => [n, dist(h!.km, units), compass(h!.bearingDeg), h!.name ?? '–'])}
      />
    </div>
  )
}
