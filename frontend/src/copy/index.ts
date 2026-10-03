// Every visible sentence is built here from numbers, so unit changes never need new data.
import type { SeasonName } from '../api/types'
import { MINUS, NBSP, delta, dist, n0, n1, n2, n3, radiusLabel, temp, type Units } from '../units'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const MONTH_START = MONTH_DAYS.map((_, i) =>
  MONTH_DAYS.slice(0, i).reduce((a, b) => a + b, 0),
)

/** Day of the 365-day calendar (1 to 365) to "Jun 21". */
export function dateOf(doy: number): string {
  const d = Math.min(365, Math.max(1, Math.round(doy)))
  let m = 11
  while (MONTH_START[m] >= d) m--
  return `${MONTHS[m]} ${d - MONTH_START[m]}`
}
/** A JS date to the 365-day calendar; 29 February counts as day 59. */
export function doyOfDate(month: number, day: number): number {
  if (month === 2 && day === 29) return 59
  return MONTH_START[month - 1] + day
}

export const compass = (deg: number) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(((deg + 22.5) % 360) / 45)]

export const population = (p: { value: number; year: number | null; source: string }) =>
  `Population ${n0(p.value)} (${p.year ? `${p.year}, ` : ''}${p.source === 'wikidata' ? 'Wikidata' : 'GeoNames'})`

export function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}

export function founded(
  i: { year: number; precision: 7 | 8 | 9 },
  currentYear = new Date().getFullYear(),
): string {
  const bce = i.year < 0
  const y = Math.abs(i.year)
  if (i.precision === 9) {
    return bce ? `${y} BCE` : `${y}${NBSP}(about ${n0(currentYear - i.year)} years ago)`
  }
  if (i.precision === 8) {
    const d = Math.floor(y / 10) * 10
    return bce ? `the ${d}s BCE` : `the ${d}s`
  }
  const c = Math.ceil(y / 100)
  return bce ? `the ${ordinal(c)} century BCE` : `the ${ordinal(c)} century`
}

export function localTime(tz: string, now = new Date()): string {
  try {
    const t = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)
    const part =
      new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(now)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    return `Local time ${t} (${part.replace('GMT', 'UTC').replace('-', MINUS)})`
  } catch {
    return ''
  }
}

const after = (n: number) =>
  n === 0 ? 'on' : `${Math.abs(n)} days ${n > 0 ? 'after' : 'before'} the`
export function warmLag(doy: number, lag: number, ci: [number, number], hemi: 'N' | 'S'): string {
  const sol = hemi === 'N' ? 'June' : 'December'
  const rel = lag === 0 ? `on the ${sol} solstice` : `${after(lag)} ${sol} solstice`
  return `The warmest day of a typical year is ${dateOf(doy)}, ${rel} (90% range ${ci[0]} to ${ci[1]}; negative values mean before).`
}
export function coldLag(doy: number, lag: number, hemi: 'N' | 'S'): string {
  const sol = hemi === 'N' ? 'December' : 'June'
  const rel = lag === 0 ? `on the ${sol} solstice` : `${after(lag)} ${sol} solstice`
  return `The coldest day is ${dateOf(doy)}, ${rel}.`
}
export const WEAK_CYCLE = 'The annual cycle is too weak to measure a seasonal lag.'
export const LAG_DISAGREE =
  'The smooth curve and the 31-day average disagree about the warmest day by more than 10 days, so read the lag with caution.'

export function trendSentence(
  t: {
    perDecade: number
    slopeLo: number
    slopeHi: number
    significant: boolean
    tau: number
    p: number
  },
  u: Units,
): string {
  return `Average temperature has changed by ${delta(t.perDecade, u)} per decade since 1950 (95% range ${delta(t.slopeLo * 10, u)} to ${delta(t.slopeHi * 10, u)}); the trend ${t.significant ? 'is' : 'is not'} statistically significant (Kendall tau ${n2(t.tau)}, p = ${n3(t.p)}).`
}
export const heatwaveSentence = (
  f: { events: number; days: number },
  l: { events: number; days: number },
) =>
  `Heatwave events: ${n1(f.events)} a year on average in the first 15 years of the period and ${n1(l.events)} in the last 15 years; heatwave days: ${n1(f.days)} and ${n1(l.days)}.`

export const ACTIVITY = ['none recorded', 'very low', 'low', 'moderate', 'high', 'very high']
export function seismicSummary(
  s: {
    n: number
    radiusKm: number
    start: string
    ratePerYear: number
    ratePerYearCi: [number, number]
    activityClass: number
    ratePer100kKm2: number
  },
  u: Units,
): string {
  return `${n0(s.n)} earthquakes of magnitude 4.5 or more within ${dist(s.radiusKm, u)} of the centre since ${s.start.slice(0, 4)}: about ${n1(s.ratePerYear)} a year (90% range ${n1(s.ratePerYearCi[0])} to ${n1(s.ratePerYearCi[1])}). Activity: ${ACTIVITY[s.activityClass]}, ${n2(s.ratePer100kKm2)} per 100,000 km² a year.`
}
export const noQuakes = (radiusKm: number, start: string, u: Units) =>
  `No earthquakes of magnitude 4.5 or more were recorded within ${dist(radiusKm, u).replace(NBSP, ' ')} since ${start.slice(0, 4)}.`

export const stale = (iso: string) => `Showing data computed on ${iso.slice(0, 10)}.`
export const REFRESHING = ' A fresh calculation is running; reload in a minute.'
export const unavailable = (title: string) =>
  `${title} information is not available for this place.`

export function note(code: string, extra: { coverageStart?: string | null; units: Units }): string {
  switch (code) {
    case 'population_geonames':
      return 'Population is from GeoNames; no reference year is available.'
    case 'wikidata_missing':
      return 'Some facts could not be read from Wikidata.'
    case 'sunshine_unavailable':
      return 'Sunshine data is not available for this place.'
    case 'seismic_partial':
      return `The earthquake catalogue is incomplete: only events since ${extra.coverageStart ?? 'an unknown date'} could be downloaded.`
    case 'seismic_truncated':
      return 'At least one 31-day period held more events than could be downloaded, so some events are missing.'
    case 'boundary_circle':
      return `No city boundary was found, so a circle of ${dist(5, extra.units)} around the centre is used.`
    case 'boundary_blocked':
      return `The boundary service is busy, so a ${dist(5, extra.units)} circle is used for now.`
    case 'overpass_failed':
      return 'Place counts could not be loaded right now.'
    case 'wikipedia_nearby_failed':
      return 'Nearby Wikipedia articles could not be loaded right now.'
    case 'wikipedia_missing':
      return 'This place has no English Wikipedia article.'
    case 'country_facts_failed':
      return 'Country facts could not be read from Wikidata.'
    case 'air_no_data':
      return 'The air-quality model has no values for this location.'
    default:
      return ''
  }
}

export const KOPPEN: Record<string, string> = {
  Af: 'Tropical rainforest',
  Am: 'Tropical monsoon',
  Aw: 'Tropical savanna',
  BWh: 'Hot desert',
  BWk: 'Cold desert',
  BSh: 'Hot semi-arid',
  BSk: 'Cold semi-arid',
  Csa: 'Hot-summer Mediterranean',
  Csb: 'Warm-summer Mediterranean',
  Csc: 'Cold-summer Mediterranean',
  Cwa: 'Humid subtropical, dry winter',
  Cwb: 'Subtropical highland, dry winter',
  Cwc: 'Cold subtropical highland, dry winter',
  Cfa: 'Humid subtropical',
  Cfb: 'Temperate oceanic',
  Cfc: 'Subpolar oceanic',
  Dsa: 'Hot-summer continental, dry summer',
  Dsb: 'Warm-summer continental, dry summer',
  Dsc: 'Subarctic, dry summer',
  Dsd: 'Extremely cold subarctic, dry summer',
  Dwa: 'Hot-summer continental, dry winter',
  Dwb: 'Warm-summer continental, dry winter',
  Dwc: 'Subarctic, dry winter',
  Dwd: 'Extremely cold subarctic, dry winter',
  Dfa: 'Hot-summer humid continental',
  Dfb: 'Warm-summer humid continental',
  Dfc: 'Subarctic',
  Dfd: 'Extremely cold subarctic',
  ET: 'Tundra',
  EF: 'Ice cap',
}
export const CONTINENTALITY = ['oceanic', 'transitional', 'continental']
export const SEASONALITY = [
  'very equable',
  'equable but with a definite wetter season',
  'rather seasonal with a short drier season',
  'seasonal',
  'marked seasonal with a long dry season',
  'most rain in 3 months or less',
  'extreme seasonality, almost all rain in 1 to 2 months',
]
export const SEASON_LABEL: Record<SeasonName | 'wet' | 'dry', string> = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  wet: 'Wet months',
  dry: 'Dry months',
}
export const AQI_WORDS = {
  usaqi: [
    'good',
    'moderate',
    'unhealthy for sensitive groups',
    'unhealthy',
    'very unhealthy',
    'hazardous',
  ],
  eaqi: ['good', 'fair', 'moderate', 'poor', 'very poor', 'extremely poor'],
}
export const AQI_BANDS = { usaqi: [50, 100, 150, 200, 300], eaqi: [20, 40, 60, 80, 100] }
export const SCALE_NAME = { usaqi: 'US AQI', eaqi: 'European AQI' }

export const CATEGORY_WORD: Record<string, string> = {
  museum: 'Museum',
  attraction: 'Attraction',
  historic: 'Historic site',
  park: 'Park',
  culture: 'Culture',
  worship: 'Place of worship',
  university: 'University',
  other: 'Other',
}
export const COUNT_LABEL: Record<string, string> = {
  foodAndDrink: 'Restaurants and cafes',
  healthcare: 'Hospitals and clinics',
  pharmacies: 'Pharmacies',
  schools: 'Schools',
  universities: 'Universities',
  museums: 'Museums',
  attractions: 'Attractions',
  hotels: 'Hotels',
  parks: 'Parks',
  railwayStations: 'Railway stations',
  busStops: 'Bus stops',
  historicSites: 'Historic sites',
  airports: 'Airports',
}
export const SOURCE_LABEL = {
  osm: 'OpenStreetMap',
  wikipedia: 'Wikipedia',
  both: 'OpenStreetMap and Wikipedia',
}

export function chartLabels(city: string, end?: number) {
  return {
    clock: `Year clock for ${city}: daily temperature and daylight through the year`,
    seasons: `Seasons in ${city}: temperature and precipitation by season`,
    normals: `Climograph for ${city}: monthly temperature and precipitation`,
    stripes: `Warming stripes for ${city}, 1950 to ${end ?? ''}`,
    trend: `Annual average temperature of ${city} with trend line`,
    daylight: `Hours of daylight through the year in ${city}`,
    quakes: `Earthquakes of magnitude 4.5 or more near ${city} by date and magnitude`,
    air: `Hourly PM2.5 near ${city} over the last 8 days`,
    water: `Distance from ${city} to the nearest coast, lake and river`,
  }
}
export { radiusLabel, temp }
export const IDLE_READOUT = 'Hover, tap or use the arrow keys to read values.'
