// Wire types. These mirror the backend envelope and module payloads (docs/API.md).
export type ModuleName =
  | 'search'
  | 'identity'
  | 'climate'
  | 'seismic'
  | 'places'
  | 'boundary'
  | 'history'
  | 'air'
  | 'water'
  | 'solar'

export interface Source {
  id: string
  text: string
  url: string
}
export interface Envelope<T> {
  module: ModuleName
  status: 'ok' | 'partial' | 'unavailable'
  data: T | null
  computedAt: string
  stale: boolean
  refreshing: boolean
  notes: string[]
  sources: Source[]
}
export interface ProgressBody {
  module: ModuleName
  status: 'computing'
  progress: { step: number; steps: number; label: string }
  retryAfterSeconds: number
}
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'CITY_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'BUDGET_EXHAUSTED'
  | 'HOURLY_LIMIT'
  | 'BUSY'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_BAD_DATA'
  | 'INITIALISING'
  | 'INTERNAL'
export interface ApiErrorBody {
  code: ErrorCode
  message: string
  retryAfterSeconds?: number
}
export interface StatusBody {
  ok: boolean
  warm: boolean
  cacheMode: 'redis' | 'memory'
  version: string
  budget: { freshCitiesToday: number; freshCitiesLimit: number; resetsAt: string }
}

export interface SearchResult {
  geonameId: number
  name: string
  admin1: string | null
  country: string | null
  countryCode: string
  lat: number
  lon: number
  population: number | null
}
export interface SearchData {
  results: SearchResult[]
}

export interface IdentityData {
  geonameId: number
  name: string
  admin1: string | null
  country: string | null
  countryCode: string
  lat: number
  lon: number
  elevationM: number | null
  timezone: string
  population: { value: number; year: number | null; source: 'wikidata' | 'geonames' } | null
  areaKm2: number | null
  densityPerKm2: number | null
  inception: { year: number; precision: 7 | 8 | 9 } | null
  wikidataQid: string | null
  osmRelationId: number | null
  countryQid: string | null
  enwikiTitle: string | null
}

export interface Trend {
  n: number
  slopePerYear: number
  slopeLo: number
  slopeHi: number
  perDecade: number
  tau: number
  p: number
  significant: boolean
}
export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn'
export interface SeasonStats {
  name: SeasonName | 'wet' | 'dry'
  firstMonth: number
  days: number
  tmean: number
  tmax: number
  tmin: number
  precip: number
  sunHoursPerDay: number | null
}
export interface Run {
  start: number
  length: number
}
export interface ClimateData {
  dataWindow: { trendStart: 1950; normalsStart: number; end: number }
  hemisphere: 'N' | 'S'
  seasonMode: 'thermal' | 'wetdry'
  seasons: SeasonStats[]
  wetDry: { wet: boolean[]; wetRun: Run | null; dryRun: Run | null } | null
  monthly: {
    tmean: number[]
    tmax: number[]
    tmin: number[]
    precip: number[]
    wetDays: number[]
    sunHoursPerDay: (number | null)[] | null
  }
  annual: {
    mat: number
    map: number
    dT: number
    sunHours: number | null
    sunPercent: number | null
    hottestMonth: number
    coldestMonth: number
    hottestDoy: number
    coldestDoy: number
  }
  sunPercentMonthly: (number | null)[] | null
  dailyMeanSmooth: number[]
  cycle: {
    mode: 'ok' | 'weak'
    amplitude: number
    peakDoy: number | null
    troughDoy: number | null
    peakLagDays: number | null
    troughLagDays: number | null
    peakLagCi: [number, number] | null
    lagCheck: 'ok' | 'disagree' | null
  }
  koppen: { code: string; thot: number; tcold: number; pthreshold: number }
  trend: { annual: Trend | null; seasons: { season: SeasonName; trend: Trend | null }[] }
  annualMean: (number | null)[]
  annualAnomaly: (number | null)[]
  baseline: { start: 1961; end: 1990; mean: number | null }
  stripesLimit: number
  decades: { decade: number; mean: number; years: number }[]
  extremes: {
    years: number[]
    hot30: (number | null)[]
    hot35: (number | null)[]
    frost: (number | null)[]
    wet: (number | null)[]
    means: { hot30: number; hot35: number; frost: number; wet: number }
    heatwave: {
      events: number[]
      days: number[]
      first15: { events: number; days: number }
      last15: { events: number; days: number }
    }
  }
  indices: {
    gorczynskiK: number
    continentality: 0 | 1 | 2
    seasonalityIndex: number | null
    seasonalityClass: number | null
  }
}

export interface SeismicEvent {
  time: string
  mag: number
  magType: string | null
  depth: number | null
  place: string | null
  id: string
  distanceKm: number
}
export interface SeismicData {
  radiusKm: 100 | 300 | 500
  start: string
  end: string
  years: number
  n: number
  areaKm2: number
  ratePerYear: number
  ratePerYearCi: [number, number]
  ratePer100kKm2: number
  ratePer100kKm2Ci: [number, number]
  activityClass: 0 | 1 | 2 | 3 | 4 | 5
  mc: number | null
  nc: number
  b: number | null
  bSe: number | null
  recurrence: {
    m5: number | 'gt10000' | null
    m6: number | 'gt10000' | null
    m7: number | 'gt10000' | null
  } | null
  partial: boolean
  coverageStart: string | null
  truncated: boolean
  droppedRows: number
  points: { t: number[]; lat: number[]; lon: number[]; mag: number[]; depth: number[] }
  top: SeismicEvent[]
  perYear: { firstYear: number; counts: number[] }
  gr: { m0: number; step: 0.1; counts: number[] }
}

export type PlaceCategory =
  'museum' | 'attraction' | 'historic' | 'park' | 'culture' | 'worship' | 'university' | 'other'
export const COUNT_KEYS = [
  'foodAndDrink',
  'healthcare',
  'pharmacies',
  'schools',
  'universities',
  'museums',
  'attractions',
  'hotels',
  'parks',
  'railwayStations',
  'busStops',
  'historicSites',
  'airports',
] as const
export type CountKey = (typeof COUNT_KEYS)[number]
export interface PlacesData {
  areaMode: 'relation' | 'radius'
  areaKm2: number
  counts: Record<CountKey, number | null> | null
  perKm2: Record<string, number | null> | null
  notable: {
    name: string
    category: PlaceCategory
    lat: number
    lon: number
    source: 'osm' | 'wikipedia' | 'both'
    wikipediaTitle: string | null
    views30d: number | null
    description: string | null
    distanceKm: number
  }[]
  ranking: 'views' | 'distance' | null
}

export interface BoundaryData {
  kind: 'polygon' | 'circle'
  osmRelationId: number | null
  areaKm2: number
  bbox: [number, number, number, number]
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
  vertexCount: number
}
export interface HistoryData {
  inception: { year: number; precision: 7 | 8 | 9 } | null
  country: {
    name: string | null
    currencies: string[]
    languages: string[]
    capital: string | null
    callingCode: string | null
    drivingSide: 'left' | 'right' | null
  } | null
  wikipedia: { text: string; url: string; license: 'CC BY-SA 4.0' } | null
}
export interface AirData {
  scale: 'eaqi' | 'usaqi'
  utcOffsetSeconds: number
  current: {
    time: string
    pm25: number | null
    pm10: number | null
    ozone: number | null
    aqi: number | null
  }
  hourly: { time: string[]; pm25: (number | null)[] }
  daily: {
    date: string
    pm25Mean: number | null
    aqiMax: number | null
    category: 0 | 1 | 2 | 3 | 4 | 5 | null
    partial: boolean
  }[]
}
export interface WaterHit {
  km: number
  lat: number
  lon: number
  bearingDeg: number
  name: string | null
}
export interface WaterData {
  coast: WaterHit
  lake: WaterHit | null
  river: WaterHit | null
  coastClass: 'coastal' | 'near-coast' | 'inland'
}
export interface SolarData {
  lat: number
  daylight365: number[]
  reference: { doy: 79 | 172 | 265 | 355; hours: number }[]
  longestDay: { doy: number; hours: number }
  shortestDay: { doy: number; hours: number }
  polarDayCount: number
  polarNightCount: number
}
