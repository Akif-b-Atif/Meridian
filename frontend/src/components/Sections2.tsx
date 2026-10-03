import { useState } from 'react'
import type { ClimateData, HistoryData, IdentityData, PlacesData } from '../api/types'
import { COUNT_KEYS } from '../api/types'
import {
  CATEGORY_WORD,
  CONTINENTALITY,
  COUNT_LABEL,
  KOPPEN,
  SEASONALITY,
  SOURCE_LABEL,
  founded,
} from '../copy'
import { dist, n0, n1, n3, temp, MINUS, type Units } from '../units'
import { DataTable } from './Section'

export function NormalsText({ d, units }: { d: ClimateData; units: Units }) {
  const a = d.annual
  const wetDaysYear = d.monthly.wetDays.reduce((x, y) => x + y, 0)
  return (
    <div className="stack">
      <p>
        <strong>
          {d.koppen.code}: {KOPPEN[d.koppen.code] ?? 'Unclassified'}
        </strong>
      </p>
      <p className="note">
        Classified with the Peel et al. (2007) rules on ERA5 monthly normals for{' '}
        {d.dataWindow.normalsStart} to {d.dataWindow.end}; hottest month{' '}
        {temp(d.koppen.thot, units)}, coldest month {temp(d.koppen.tcold, units)}.
      </p>
      <dl className="facts">
        <dt>Mean annual temperature</dt>
        <dd>{temp(a.mat, units)}</dd>
        <dt>Annual precipitation</dt>
        <dd>{n0(a.map)} mm</dd>
        <dt>Wet days a year</dt>
        <dd>{n0(wetDaysYear)}</dd>
        {a.sunHours !== null && (
          <>
            <dt>Sunshine</dt>
            <dd>
              {n0(a.sunHours)} hours a year
              {a.sunPercent !== null && `, ${n0(a.sunPercent)}% of possible`}
            </dd>
          </>
        )}
        <dt>Continentality</dt>
        <dd>
          K = {n1(d.indices.gorczynskiK)}, {CONTINENTALITY[d.indices.continentality]}
        </dd>
        {d.indices.seasonalityClass !== null && (
          <>
            <dt>Rainfall seasonality</dt>
            <dd>
              {n3(d.indices.seasonalityIndex ?? 0)}, {SEASONALITY[d.indices.seasonalityClass]}
            </dd>
          </>
        )}
      </dl>
      {a.sunHours !== null && (
        <p className="note">
          Sunshine is a model value and is not comparable with station records.
        </p>
      )}
    </div>
  )
}

export function PlacesView({
  d,
  units,
  onShow,
}: {
  d: PlacesData
  units: Units
  onShow: (p: { lat: number; lon: number }) => void
}) {
  const max = Math.max(1, ...COUNT_KEYS.map((k) => d.counts?.[k] ?? 0))
  return (
    <div className="stack">
      <p>
        {d.areaMode === 'relation'
          ? `Counted inside the city boundary (about ${n0(d.areaKm2)} km²).`
          : `No boundary was found, so counts cover a circle of ${dist(5, units)} around the centre (78.5 km²).`}
      </p>
      <p className="note">
        Airports with an IATA code are counted within {dist(30, units)} of the centre.
      </p>
      {d.counts ? (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Place counts">
          <table>
            <caption>Mapped places by category</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Count</th>
                <th scope="col">Per km²</th>
                <th scope="col">
                  <span className="sr-only">Relative size</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COUNT_KEYS.map((k) => {
                const c = d.counts![k]
                return (
                  <tr key={k}>
                    <th scope="row">{COUNT_LABEL[k]}</th>
                    <td>{c === null ? '–' : n0(c)}</td>
                    <td>{d.perKm2?.[k] == null ? '–' : n3(d.perKm2[k] as number)}</td>
                    <td style={{ width: 130 }}>
                      {c !== null && (
                        <span
                          className="meter"
                          style={{ width: `${(120 * c) / max}px` }}
                          aria-hidden="true"
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Place counts are unavailable right now.</p>
      )}
      {d.notable.length > 0 && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Notable places">
          <table>
            <caption>Notable places (up to 25)</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Distance</th>
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
      )}
      <DataTable
        caption="Place counts"
        head={['Category', 'Count']}
        rows={COUNT_KEYS.map((k) => [COUNT_LABEL[k], d.counts?.[k] ?? '–'])}
      />
    </div>
  )
}

export function HistoryView({ d }: { d: HistoryData }) {
  const c = d.country
  const rows: [string, string | null][] = [
    ['Founded', d.inception ? founded(d.inception) : null],
    ['Country', c?.name ?? null],
    ['Capital', c?.capital ?? null],
    ['Currency', c?.currencies.length ? c.currencies.join(', ') : null],
    ['Languages', c?.languages.length ? c.languages.join(', ') : null],
    ['Dialling code', c?.callingCode ?? null],
    ['Drives on', c?.drivingSide ?? null],
  ]
  return (
    <div className="stack">
      <dl className="facts">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <span key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </span>
          ))}
      </dl>
      {d.wikipedia ? (
        <>
          <p>{d.wikipedia.text}</p>
          <p>
            <a href={d.wikipedia.url} target="_blank" rel="noopener noreferrer">
              Read the full article on Wikipedia
            </a>
          </p>
          <p className="note">Text from Wikipedia, CC BY-SA 4.0.</p>
        </>
      ) : (
        <p>This place has no English Wikipedia article.</p>
      )}
    </div>
  )
}

export const fixMinus = (s: string) => s.replace('-', MINUS)
export type { IdentityData }
export { useState }
