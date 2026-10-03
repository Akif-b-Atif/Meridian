import { useIsFetching } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import type { Envelope, Source } from '../api/types'

const ALL: Source[] = [
  {
    id: 'open-meteo',
    text: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    url: 'https://open-meteo.com/',
  },
  {
    id: 'era5',
    text: 'Contains modified Copernicus Climate Change Service information (ERA5)',
    url: 'https://climate.copernicus.eu/',
  },
  {
    id: 'geonames',
    text: 'Place data from GeoNames (CC BY 4.0)',
    url: 'https://www.geonames.org/',
  },
  {
    id: 'usgs',
    text: 'Earthquake data: U.S. Geological Survey',
    url: 'https://earthquake.usgs.gov/',
  },
  {
    id: 'osm',
    text: 'Map data from OpenStreetMap, ODbL, (c) OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
  },
  { id: 'wikidata', text: 'Wikidata (CC0)', url: 'https://www.wikidata.org/' },
  { id: 'wikipedia', text: 'Text from Wikipedia (CC BY-SA 4.0)', url: 'https://en.wikipedia.org/' },
  {
    id: 'natural-earth',
    text: 'Natural Earth (public domain)',
    url: 'https://www.naturalearthdata.com/',
  },
]
const REPO = import.meta.env.VITE_REPO_URL || 'https://github.com/Akif-b-Atif/Meridian'

export function Footer() {
  const qc = useQueryClient()
  useIsFetching()
  const loaded = new Set<string>()
  for (const q of qc.getQueryCache().findAll({ queryKey: ['module'] })) {
    const r = q.state.data as { kind?: string; envelope?: Envelope<unknown> } | undefined
    if (r?.kind === 'ok') r.envelope?.sources.forEach((s) => loaded.add(s.id))
  }
  const list = loaded.size ? ALL.filter((s) => loaded.has(s.id)) : ALL
  return (
    <footer style={{ borderTop: '1px solid var(--edge)', padding: '24px 0 48px' }}>
      <div className="wrap stack">
        <p>
          Meridian is open source under the MIT licence.{' '}
          <a href={REPO} target="_blank" rel="noopener noreferrer">
            Source code
          </a>
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {list.map((s) => (
            <li key={s.id} className="note">
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.text}
              </a>
            </li>
          ))}
        </ul>
        <p className="note">Open-Meteo data is used under its non-commercial terms.</p>
        <p className="note">
          For information only: values are modelled and can differ from local measurements.
        </p>
      </div>
    </footer>
  )
}
