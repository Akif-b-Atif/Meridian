import { useEffect } from 'react'
import { Link } from 'react-router'
import { SAMPLES } from '../app/samples'
import { SearchBox } from '../components/SearchBox'
import { slugify } from '../copy/slug'

export function Landing() {
  useEffect(() => {
    document.title = 'Meridian'
  }, [])
  return (
    <div className="stack" style={{ paddingTop: 32 }}>
      <h1>Meridian</h1>
      <p style={{ fontSize: 18 }}>
        Search any city in the world and read one page about it: how its seasons run, how far peak
        heat lags behind the solstice, how much it has warmed since 1950, where the earthquakes have
        been, how far the sea is, what is mapped there and how it began.
      </p>
      <div style={{ maxWidth: 560 }}>
        <SearchBox autoFocus />
      </div>
      <h2 style={{ marginTop: 32 }}>Sample cities</h2>
      <p className="note">These are pre-computed and open straight away.</p>
      <div className="grid-samples">
        {SAMPLES.map((s) => (
          <Link
            key={s.id}
            to={`/city/${s.id}/${slugify(s.name)}`}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 14px',
              border: '1px solid var(--edge)',
              borderRadius: 4,
              textDecoration: 'none',
              color: 'var(--ink)',
            }}
          >
            {s.name}, {s.country}
          </Link>
        ))}
      </div>
      <h2 style={{ marginTop: 32 }}>Where the numbers come from</h2>
      <p>
        Every figure is computed on a small server from free public sources: ERA5 reanalysis through
        Open-Meteo for climate, the USGS catalogue for earthquakes, OpenStreetMap for places and
        boundaries, Wikidata and Wikipedia for history, and Natural Earth for coastlines. Each
        section says how its numbers were made and what they cannot tell you.
      </p>
    </div>
  )
}

export function NotFound() {
  useEffect(() => {
    document.title = 'Meridian'
  }, [])
  return (
    <div className="stack" style={{ paddingTop: 32 }}>
      <h1>Page not found</h1>
      <p>
        That address does not match a page or a city. Search for a city above, or pick a sample.
      </p>
      <p>
        <Link to="/">Back to the start</Link>
      </p>
    </div>
  )
}
