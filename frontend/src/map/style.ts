import type { StyleSpecification } from 'maplibre-gl'

const TOKENS = {
  light: { ground: '#F2F3F5', ink: '#171A1F', mute: '#566070', edge: '#7A8494', water: '#C9D3DE' },
  dark: { ground: '#14171B', ink: '#E6E8EB', mute: '#9AA3AF', edge: '#626B78', water: '#27323E' },
}

/**
 * A restrained vector style over OpenFreeMap tiles (OpenMapTiles schema), built from the colour
 * tokens. No buildings, POIs or sprites, so no sprite file is requested.
 */
export function mapStyle(theme: 'light' | 'dark'): StyleSpecification {
  const t = TOKENS[theme]
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': t.ground } },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': t.edge, 'fill-opacity': 0.12 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': t.edge, 'fill-opacity': 0.12 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': t.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': t.water, 'line-width': 1 },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        paint: {
          'line-color': t.edge,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 1.5],
        },
      },
      {
        id: 'admin',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': t.mute, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 14,
        },
        paint: { 'text-color': t.ink, 'text-halo-color': t.ground, 'text-halo-width': 2 },
      },
      {
        id: 'place-country',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': t.mute, 'text-halo-color': t.ground, 'text-halo-width': 2 },
      },
    ],
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
