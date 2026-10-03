import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { BoundaryData, PlacesData, SeismicData, WaterData } from '../api/types'
import { compass } from '../copy'
import { dist, n1, type Units } from '../units'
import { quakeRadius } from '../charts/Seismic'
import { mapStyle } from './style'

export interface MapProps {
  lat: number
  lon: number
  theme: 'light' | 'dark'
  units: Units
  boundary: BoundaryData | null
  places: PlacesData | null
  seismic: SeismicData | null
  water: WaterData | null
  layers: Record<string, boolean>
  focus: { lat: number; lon: number; n: number } | null
  onSelect: (text: string) => void
  onFail: () => void
}

function circleGeo(lat: number, lon: number, km: number) {
  const pts: [number, number][] = []
  for (let i = 0; i <= 128; i++) {
    const a = (2 * Math.PI * i) / 128
    const dLat = (km / 6371) * Math.cos(a) * (180 / Math.PI)
    const dLon = ((km / 6371) * Math.sin(a) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180)
    pts.push([lon + dLon, lat + dLat])
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [pts] },
  }
}

export default function MapView(p: MapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(0)
  const propsRef = useRef(p)
  propsRef.current = p

  useEffect(() => {
    if (!el.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: el.current,
        style: mapStyle(p.theme),
        center: [p.lon, p.lat],
        zoom: 10,
        minZoom: 2,
        maxZoom: 16,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
        attributionControl: false,
      })
    } catch {
      p.onFail()
      return
    }
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new maplibregl.ScaleControl({
        unit: propsRef.current.units === 'metric' ? 'metric' : 'imperial',
      }),
      'bottom-left',
    )
    map.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>, data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }),
    )
    map.on('error', (e) => {
      if (!map.isStyleLoaded() && String(e.error?.message).includes('style'))
        propsRef.current.onFail()
    })
    map.on('load', () => setReady((n) => n + 1))
    map.on('style.load', () => setReady((n) => n + 1))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme changes re-style the map; layers are re-added by the sync effect below.
  const lastTheme = useRef(p.theme)
  useEffect(() => {
    const m = mapRef.current
    if (m && lastTheme.current !== p.theme) {
      lastTheme.current = p.theme
      m.setStyle(mapStyle(p.theme), { diff: false })
    }
  }, [p.theme])

  useEffect(() => {
    const m = mapRef.current
    if (!m || !m.isStyleLoaded()) return
    const { boundary, places, seismic, water, layers, lat, lon, theme, units } = propsRef.current
    const accent = theme === 'dark' ? '#8FB0E8' : '#25447A'
    const a = theme === 'dark' ? '#EE9C7A' : '#A5432C'
    const b = theme === 'dark' ? '#9CBBDD' : '#4C6E91'
    const edge = theme === 'dark' ? '#626B78' : '#7A8494'
    const ink = theme === 'dark' ? '#E6E8EB' : '#171A1F'
    const ground = theme === 'dark' ? '#14171B' : '#F2F3F5'
    for (const id of [
      'boundary-fill',
      'boundary-line',
      'places',
      'quakes',
      'radius',
      'water-lines',
      'water-labels',
      'centre',
    ]) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    for (const id of ['boundary', 'places', 'quakes', 'radius', 'water', 'centre']) {
      if (m.getSource(id)) m.removeSource(id)
    }
    if (boundary && layers.boundary) {
      m.addSource('boundary', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: boundary.geometry } as never,
      })
      m.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': accent, 'fill-opacity': 0.08 },
      })
      m.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: {
          'line-color': accent,
          'line-width': 2,
          ...(boundary.kind === 'circle' ? { 'line-dasharray': [3, 2] } : {}),
        },
      })
    }
    if (places && layers.places) {
      m.addSource('places', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: places.notable.map((n) => ({
            type: 'Feature',
            properties: {
              name: n.name,
              text: `${n.name}, ${n.category}, ${dist(n.distanceKm, units)} from the centre`,
            },
            geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
          })),
        },
      })
      m.addLayer({
        id: 'places',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': 5,
          'circle-color': a,
          'circle-stroke-color': ground,
          'circle-stroke-width': 1.5,
        },
      })
    }
    if (seismic && layers.quakes) {
      const q = seismic.points
      m.addSource('quakes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: q.t.map((t, i) => ({
            type: 'Feature',
            properties: {
              r: quakeRadius(q.mag[i]),
              text: `${Math.floor(t)}: magnitude ${n1(q.mag[i])}, depth ${dist(q.depth[i], units)}`,
            },
            geometry: { type: 'Point', coordinates: [q.lon[i], q.lat[i]] },
          })),
        },
      })
      m.addLayer({
        id: 'quakes',
        type: 'circle',
        source: 'quakes',
        paint: {
          'circle-radius': ['get', 'r'],
          'circle-color': a,
          'circle-opacity': 0.35,
          'circle-stroke-color': a,
          'circle-stroke-width': 1,
        },
      })
      m.addSource('radius', { type: 'geojson', data: circleGeo(lat, lon, seismic.radiusKm) })
      m.addLayer({
        id: 'radius',
        type: 'line',
        source: 'radius',
        paint: { 'line-color': edge, 'line-width': 1.5, 'line-dasharray': [3, 2] },
      })
    }
    if (water && layers.water) {
      const hits = [
        ['Coast', water.coast],
        ['Lake', water.lake],
        ['River', water.river],
      ] as const
      const feats = hits
        .filter(([, h]) => h)
        .map(([n, h]) => ({
          type: 'Feature' as const,
          properties: { label: `${n} ${dist(h!.km, units)} ${compass(h!.bearingDeg)}` },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [lon, lat],
              [h!.lon, h!.lat],
            ],
          },
        }))
      m.addSource('water', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: feats },
      })
      m.addLayer({
        id: 'water-lines',
        type: 'line',
        source: 'water',
        paint: { 'line-color': b, 'line-width': 2, 'line-dasharray': [2, 2] },
      })
      m.addLayer({
        id: 'water-labels',
        type: 'symbol',
        source: 'water',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
        },
        paint: { 'text-color': ink, 'text-halo-color': ground, 'text-halo-width': 2 },
      })
    }
    m.addSource('centre', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lon, lat] },
      },
    })
    m.addLayer({
      id: 'centre',
      type: 'circle',
      source: 'centre',
      paint: {
        'circle-radius': 5,
        'circle-color': ink,
        'circle-stroke-color': ground,
        'circle-stroke-width': 2,
      },
    })
  }, [ready, p.boundary, p.places, p.seismic, p.water, p.layers, p.units, p.theme, p.lat, p.lon])

  useEffect(() => {
    const m = mapRef.current
    if (!m || !p.boundary) return
    const [w, s, e, n] = p.boundary.bbox
    m.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 32, maxZoom: 13, duration: 0 },
    )
  }, [p.boundary, ready])

  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const click = (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, {
        layers: ['places', 'quakes'].filter((l) => m.getLayer(l)),
      })[0]
      if (f?.properties?.text) propsRef.current.onSelect(String(f.properties.text))
    }
    m.on('click', click)
    return () => {
      m.off('click', click)
    }
  }, [ready])

  useEffect(() => {
    const m = mapRef.current
    if (!m || !p.focus) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const opts = { center: [p.focus.lon, p.focus.lat] as [number, number], zoom: 14 }
    if (reduce) m.jumpTo(opts)
    else m.flyTo(opts)
  }, [p.focus])

  return (
    <div
      ref={el}
      style={{ height: 'var(--map-h, 420px)' }}
      className="map-box"
      tabIndex={0}
      aria-label="Map"
    />
  )
}
