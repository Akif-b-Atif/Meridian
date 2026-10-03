import type { Page, Route } from '@playwright/test'

const sources = [
  {
    id: 'open-meteo',
    text: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    url: 'https://open-meteo.com/',
  },
]
const env = (module: string, data: unknown, extra: object = {}) => ({
  module,
  status: 'ok',
  data,
  computedAt: '2026-10-01T00:00:00Z',
  stale: false,
  refreshing: false,
  notes: [],
  sources,
  ...extra,
})

const doy = Array.from({ length: 365 }, (_, i) => i)
const climate = {
  dataWindow: { trendStart: 1950, normalsStart: 1996, end: 2025 },
  hemisphere: 'N',
  seasonMode: 'thermal',
  seasons: ['winter', 'spring', 'summer', 'autumn'].map((name, i) => ({
    name,
    firstMonth: [12, 3, 6, 9][i],
    days: 90,
    tmean: [5, 10, 17, 11][i],
    tmax: [8, 14, 22, 15][i],
    tmin: [2, 6, 12, 7][i],
    precip: 150,
    sunHoursPerDay: 3,
  })),
  wetDry: null,
  monthly: {
    tmean: [5, 5, 7, 9, 13, 16, 18, 18, 15, 11, 7, 5],
    tmax: [8, 8, 11, 14, 18, 21, 23, 23, 20, 15, 11, 8],
    tmin: [2, 2, 3, 5, 8, 11, 13, 13, 11, 8, 5, 3],
    precip: [50, 40, 40, 45, 50, 50, 45, 50, 50, 70, 65, 55],
    wetDays: [10, 9, 9, 9, 9, 9, 8, 8, 9, 11, 11, 11],
    sunHoursPerDay: [1, 2, 3, 5, 6, 6, 6, 6, 4, 3, 1, 1],
  },
  annual: {
    mat: 11,
    map: 610,
    dT: 13,
    sunHours: 1500,
    sunPercent: 36,
    hottestMonth: 7,
    coldestMonth: 1,
    hottestDoy: 200,
    coldestDoy: 20,
  },
  sunPercentMonthly: null,
  dailyMeanSmooth: doy.map((d) => 11 + 7 * Math.cos((2 * Math.PI * (d - 200)) / 365)),
  cycle: {
    mode: 'ok',
    amplitude: 7,
    peakDoy: 200,
    troughDoy: 18,
    peakLagDays: 28,
    troughLagDays: 29,
    peakLagCi: [25, 31],
    lagCheck: 'ok',
  },
  koppen: { code: 'Cfb', thot: 18, tcold: 5, pthreshold: 150 },
  trend: {
    annual: {
      n: 76,
      slopePerYear: 0.025,
      slopeLo: 0.02,
      slopeHi: 0.03,
      perDecade: 0.25,
      tau: 0.6,
      p: 0,
      significant: true,
    },
    seasons: ['winter', 'spring', 'summer', 'autumn'].map((season) => ({
      season,
      trend: {
        n: 75,
        slopePerYear: 0.02,
        slopeLo: 0.01,
        slopeHi: 0.03,
        perDecade: 0.2,
        tau: 0.4,
        p: 0.01,
        significant: true,
      },
    })),
  },
  annualMean: Array.from({ length: 76 }, (_, i) => 10 + 0.025 * i + (i % 3) * 0.1),
  annualAnomaly: Array.from({ length: 76 }, (_, i) => -0.6 + 0.025 * i),
  baseline: { start: 1961, end: 1990, mean: 10.4 },
  stripesLimit: 1,
  decades: [
    { decade: 1950, mean: 10.2, years: 10 },
    { decade: 2020, mean: 11.8, years: 6 },
  ],
  extremes: {
    years: Array.from({ length: 30 }, (_, i) => 1996 + i),
    hot30: Array.from({ length: 30 }, (_, i) => i % 5),
    hot35: Array(30).fill(0),
    frost: Array.from({ length: 30 }, (_, i) => 20 - (i % 7)),
    wet: Array.from({ length: 30 }, () => 100),
    means: { hot30: 2, hot35: 0, frost: 17, wet: 100 },
    heatwave: {
      events: Array.from({ length: 30 }, (_, i) => i % 3),
      days: Array.from({ length: 30 }, (_, i) => (i % 3) * 4),
      first15: { events: 0.8, days: 3 },
      last15: { events: 1.1, days: 4.5 },
    },
  },
  indices: { gorczynskiK: 6.2, continentality: 0, seasonalityIndex: 0.12, seasonalityClass: 0 },
}

export const FIXTURES: Record<string, unknown> = {
  identity: env(
    'identity',
    {
      geonameId: 2643743,
      name: 'London',
      admin1: 'England',
      country: 'United Kingdom',
      countryCode: 'GB',
      lat: 51.5085,
      lon: -0.1257,
      elevationM: 25,
      timezone: 'Europe/London',
      population: { value: 8799800, year: 2021, source: 'wikidata' },
      areaKm2: 1572,
      densityPerKm2: 5598,
      inception: { year: 43, precision: 9 },
      wikidataQid: 'Q84',
      osmRelationId: 65606,
      countryQid: 'Q145',
      enwikiTitle: 'London',
    },
    {
      sources: [
        {
          id: 'geonames',
          text: 'Place data from GeoNames (CC BY 4.0)',
          url: 'https://www.geonames.org/',
        },
      ],
    },
  ),
  climate: env('climate', climate),
  solar: env('solar', {
    lat: 51.5,
    daylight365: doy.map((d) => 12.2 - 4.4 * Math.cos((2 * Math.PI * (d + 10)) / 365)),
    reference: [
      { doy: 79, hours: 12.2 },
      { doy: 172, hours: 16.6 },
      { doy: 265, hours: 12.1 },
      { doy: 355, hours: 7.8 },
    ],
    longestDay: { doy: 172, hours: 16.6 },
    shortestDay: { doy: 355, hours: 7.8 },
    polarDayCount: 0,
    polarNightCount: 0,
  }),
  water: env('water', {
    coast: { km: 72.4, lat: 51.4, lon: 0.9, bearingDeg: 95, name: null },
    lake: null,
    river: { km: 1.2, lat: 51.5, lon: -0.1, bearingDeg: 180, name: 'Thames' },
    coastClass: 'inland',
  }),
  seismic: env(
    'seismic',
    {
      radiusKm: 300,
      start: '1973-01-01',
      end: '2026-10-01',
      years: 53.7,
      n: 0,
      areaKm2: 279000,
      ratePerYear: 0,
      ratePerYearCi: [0, 0.06],
      ratePer100kKm2: 0,
      ratePer100kKm2Ci: [0, 0.02],
      activityClass: 0,
      mc: null,
      nc: 0,
      b: null,
      bSe: null,
      recurrence: null,
      partial: false,
      coverageStart: null,
      truncated: false,
      droppedRows: 0,
      points: { t: [], lat: [], lon: [], mag: [], depth: [] },
      top: [],
      perYear: { firstYear: 1974, counts: [] },
      gr: { m0: 4.5, step: 0.1, counts: [] },
    },
    {
      sources: [
        {
          id: 'usgs',
          text: 'Earthquake data: U.S. Geological Survey',
          url: 'https://earthquake.usgs.gov/',
        },
      ],
    },
  ),
  boundary: env(
    'boundary',
    {
      kind: 'circle',
      osmRelationId: null,
      areaKm2: 78.5,
      bbox: [-0.19, 51.46, -0.06, 51.55],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.19, 51.46],
            [-0.06, 51.46],
            [-0.06, 51.55],
            [-0.19, 51.55],
            [-0.19, 51.46],
          ],
        ],
      },
      vertexCount: 64,
    },
    { status: 'partial', notes: ['boundary_circle'] },
  ),
  places: env('places', {
    areaMode: 'radius',
    areaKm2: 78.5,
    counts: Object.fromEntries(
      [
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
      ].map((k, i) => [k, (i + 1) * 10]),
    ),
    perKm2: null,
    notable: [
      {
        name: 'Big Ben',
        category: 'attraction',
        lat: 51.5,
        lon: -0.12,
        source: 'both',
        wikipediaTitle: 'Big Ben',
        views30d: 1200,
        description: null,
        distanceKm: 1.2,
      },
    ],
    ranking: 'views',
  }),
  history: env('history', {
    inception: { year: 43, precision: 9 },
    country: {
      name: 'United Kingdom',
      currencies: ['pound sterling'],
      languages: ['English'],
      capital: 'London',
      callingCode: '+44',
      drivingSide: 'left',
    },
    wikipedia: {
      text: 'London is the capital and largest city of the United Kingdom.',
      url: 'https://en.wikipedia.org/wiki/London',
      license: 'CC BY-SA 4.0',
    },
  }),
  air: env('air', {
    scale: 'eaqi',
    utcOffsetSeconds: 3600,
    current: { time: '2026-10-03T10:00', pm25: 8, pm10: 12, ozone: 40, aqi: 25 },
    hourly: {
      time: Array.from(
        { length: 48 },
        (_, i) => `2026-10-0${2 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`,
      ),
      pm25: Array(48).fill(8),
    },
    daily: [
      { date: '2026-10-02', pm25Mean: 8, aqiMax: 25, category: 1, partial: false },
      { date: '2026-10-03', pm25Mean: 8, aqiMax: 25, category: 1, partial: true },
    ],
  }),
}

export interface MockOptions {
  statusFailures?: number
  overrides?: Record<string, (route: Route) => Promise<void> | void>
  computingFirst?: string[]
}

/** Intercept every API call and answer from fixtures. No real network is used. */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  let statusCalls = 0
  const seen = new Set<string>()
  await page.route('http://api.test/**', async (route) => {
    const url = new URL(route.request().url())
    const headers = { 'access-control-allow-origin': '*' }
    if (url.pathname === '/api/status') {
      statusCalls++
      if (statusCalls <= (opts.statusFailures ?? 0)) return route.abort('failed')
      return route.fulfill({
        status: 200,
        headers,
        json: {
          ok: true,
          warm: true,
          cacheMode: 'memory',
          version: 'test',
          budget: { freshCitiesToday: 0, freshCitiesLimit: 15, resetsAt: '2026-10-04T00:00:00Z' },
        },
      })
    }
    if (url.pathname === '/api/search') {
      const q = url.searchParams.get('q') ?? ''
      const mk = (id: number, admin1: string) => ({
        geonameId: id,
        name: 'Springfield',
        admin1,
        country: 'United States',
        countryCode: 'US',
        lat: 1,
        lon: 1,
        population: 1000 * id,
      })
      return route.fulfill({
        status: 200,
        headers,
        json: env('search', {
          results: q.toLowerCase().startsWith('spr') ? [mk(1, 'Illinois'), mk(2, 'Missouri')] : [],
        }),
      })
    }
    const m = url.pathname.match(/^\/api\/cities\/(\d+)(?:\/(\w+))?$/)
    if (!m)
      return route.fulfill({
        status: 404,
        headers,
        json: {
          error: { code: 'CITY_NOT_FOUND', message: 'No populated place with that ID was found.' },
        },
      })
    const mod = m[2] ?? 'identity'
    const override = opts.overrides?.[mod]
    if (override) return override(route)
    if (opts.computingFirst?.includes(mod) && !seen.has(mod)) {
      seen.add(mod)
      return route.fulfill({
        status: 202,
        headers,
        json: {
          module: mod,
          status: 'computing',
          progress: { step: 2, steps: 3, label: 'Reading daily temperatures' },
          retryAfterSeconds: 2,
        },
      })
    }
    return route.fulfill({ status: 200, headers, json: FIXTURES[mod] })
  })
}
