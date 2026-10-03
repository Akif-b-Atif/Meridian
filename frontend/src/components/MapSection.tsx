import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type {
  BoundaryData,
  Envelope,
  IdentityData,
  PlacesData,
  SeismicData,
  WaterData,
} from '../api/types'
import { webglAvailable } from '../map/style'
import { usePrefs } from '../state/preferences'
import { Notes } from './Section'

const MapView = lazy(() => import('../map/MapView'))

interface Props {
  ident: IdentityData
  boundary: Envelope<BoundaryData> | null
  places: Envelope<PlacesData> | null
  seismic: Envelope<SeismicData> | null
  water: Envelope<WaterData> | null
  focus: { lat: number; lon: number; n: number } | null
  layersRequest: number
}

const TOGGLES = [
  ['boundary', 'Boundary', true],
  ['places', 'Notable places', true],
  ['quakes', 'Earthquakes', false],
  ['water', 'Nearest water', false],
] as const

export function MapSection({
  ident,
  boundary,
  places,
  seismic,
  water,
  focus,
  layersRequest,
}: Props) {
  const { units, resolvedTheme } = usePrefs()
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState('')
  const [layers, setLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map(([k, , d]) => [k, d])),
  )
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!box.current) return
    if (typeof IntersectionObserver === 'undefined') return setVisible(true)
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true), {
      rootMargin: '400px',
    })
    io.observe(box.current)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (layersRequest) setLayers((l) => ({ ...l, places: true }))
  }, [layersRequest])

  const noGl = typeof document !== 'undefined' && !webglAvailable()
  return (
    <div ref={box} className="stack">
      {boundary && <Notes env={boundary} only={['boundary_circle', 'boundary_blocked']} />}
      <fieldset>
        <legend>Map layers</legend>
        {TOGGLES.map(([k, label]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={layers[k]}
              onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {failed || noGl ? (
        <p>
          The map could not be loaded. Location: {ident.lat.toFixed(4)}, {ident.lon.toFixed(4)}.
        </p>
      ) : visible ? (
        <Suspense
          fallback={
            <div className="skeleton" style={{ height: 420 }}>
              Loading map...
            </div>
          }
        >
          <MapView
            lat={ident.lat}
            lon={ident.lon}
            theme={resolvedTheme}
            units={units}
            boundary={boundary?.data ?? null}
            places={places?.data ?? null}
            seismic={seismic?.data ?? null}
            water={water?.data ?? null}
            layers={layers}
            focus={focus}
            onSelect={setSelected}
            onFail={() => setFailed(true)}
          />
        </Suspense>
      ) : (
        <div className="skeleton" style={{ height: 420 }}>
          Map loads when you scroll here.
        </div>
      )}
      <p className="readout" aria-live="polite">
        {selected ||
          'Select a place marker or an earthquake circle for details. The nearest-water lines are straight lines on the map.'}
      </p>
    </div>
  )
}
