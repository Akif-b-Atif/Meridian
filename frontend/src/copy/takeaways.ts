// Plain-language sentences computed from the data. Numbers are arguments, never hard-coded.
import type {
  ClimateData,
  PlacesData,
  SeismicData,
  WaterData,
  AirData,
  SolarData,
  IdentityData,
} from '../api/types'
import { MONTH_FULL, dateOf, KOPPEN } from './index'
import { MINUS, delta, dist, hm, n0, n1, temp, type Units } from '../units'

const argmax = (a: number[]) => a.indexOf(Math.max(...a))
const argmin = (a: number[]) => a.indexOf(Math.min(...a))

export function whereTakeaway(i: IdentityData, w: WaterData | null, units: Units): string {
  const parts: string[] = []
  if (i.elevationM !== null) {
    parts.push(
      i.elevationM < 10 ? 'sits almost at sea level' : `sits ${n0(i.elevationM)} m above sea level`,
    )
  }
  if (w) {
    const c = w.coast
    parts.push(
      w.coastClass === 'coastal'
        ? `is on the coast (${dist(c.km, units)} from the nearest shoreline)`
        : w.coastClass === 'near-coast'
          ? `is close to the sea, about ${dist(c.km, units)} from the coast`
          : `is inland, about ${dist(c.km, units)} from the nearest coast`,
    )
  }
  return parts.length ? `${i.name} ${parts.join(' and ')}.` : ''
}

export function seasonsTakeaway(d: ClimateData, units: Units): string {
  if (d.seasonMode === 'wetdry') {
    return 'Temperature barely changes here, so the real seasons are the wet and the dry ones.'
  }
  const by = Object.fromEntries(d.seasons.map((s) => [s.name, s]))
  const hot = d.seasons.reduce((a, b) => (b.tmean > a.tmean ? b : a))
  const cold = d.seasons.reduce((a, b) => (b.tmean < a.tmean ? b : a))
  const swing = hot.tmean - cold.tmean
  void by
  return `${cap(hot.name)} is the warmest season (about ${temp(hot.tmean, units)} on average) and ${cold.name} the coldest (${temp(cold.tmean, units)}), a swing of ${delta(swing, units).replace('+', '')}.`
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function normalsTakeaway(d: ClimateData, units: Units): string {
  const m = d.monthly
  const hot = argmax(m.tmean)
  const cold = argmin(m.tmean)
  const wet = argmax(m.precip)
  const dry = argmin(m.precip)
  const spread = Math.max(...m.precip) / Math.max(1, Math.min(...m.precip))
  const rain =
    spread < 1.8
      ? 'Rain is spread fairly evenly through the year'
      : `${MONTH_FULL[wet]} is the wettest month (${n0(m.precip[wet])} mm) and ${MONTH_FULL[dry]} the driest (${n0(m.precip[dry])} mm)`
  return `${MONTH_FULL[hot]} is the warmest month (${temp(m.tmean[hot], units)} on average) and ${MONTH_FULL[cold]} the coldest (${temp(m.tmean[cold], units)}). ${rain}. In total about ${n0(d.annual.map)} mm falls in a year.`
}

const FIRST: Record<string, string> = {
  A: 'Tropical: every month is warm (above 18 °C).',
  B: 'Dry: more water evaporates than falls as rain.',
  C: 'Temperate: mild winters and warm or cool summers.',
  D: 'Continental: cold winters and warm summers.',
  E: 'Polar: even the warmest month is cool (below 10 °C).',
}
const SECOND: Record<string, string> = {
  f: 'Rain falls in every season (no dry season).',
  m: 'A short dry spell, but a monsoon soaks the rest of the year.',
  w: 'A dry winter.',
  s: 'A dry summer.',
  W: 'Desert: very little rain.',
  S: 'Steppe: semi-dry grassland.',
  T: 'Tundra: the ground thaws only briefly.',
  F: 'Ice cap: permanently frozen.',
}
const THIRD: Record<string, string> = {
  a: 'Hot summers.',
  b: 'Warm summers.',
  c: 'Short, cool summers.',
  d: 'Extremely cold winters.',
  h: 'Hot all year.',
  k: 'Cold winters.',
}

export function koppenPlain(code: string): { letter: string; meaning: string }[] {
  const out: { letter: string; meaning: string }[] = []
  const l = code.split('')
  if (l[0]) out.push({ letter: l[0], meaning: FIRST[l[0]] ?? '' })
  if (l[1]) out.push({ letter: l[1], meaning: SECOND[l[1]] ?? '' })
  if (l[2]) out.push({ letter: l[2], meaning: THIRD[l[2]] ?? '' })
  return out.filter((x) => x.meaning)
}
export const koppenName = (code: string) => KOPPEN[code] ?? 'Unclassified'

export function dayLengthTakeaway(s: SolarData): string {
  const { longestDay: lo, shortestDay: sh } = s
  if (s.polarDayCount > 0 || s.polarNightCount > 0) {
    return `This is far enough toward a pole that the sun ${s.polarDayCount > 0 ? `never sets for ${s.polarDayCount} days` : ''}${s.polarDayCount > 0 && s.polarNightCount > 0 ? ' and ' : ''}${s.polarNightCount > 0 ? `never rises for ${s.polarNightCount} days` : ''} each year.`
  }
  const swing = lo.hours - sh.hours
  if (swing < 1.5)
    return `Day length hardly changes: it only varies from ${hm(sh.hours)} to ${hm(lo.hours)} over the year.`
  return `Day length swings from ${hm(sh.hours)} on ${dateOf(sh.doy)} to ${hm(lo.hours)} on ${dateOf(lo.doy)}, a difference of ${hm(swing)}.`
}

export interface Pair {
  label: string
  earlier: number
  later: number
  unit: string
}
export function extremesPairs(
  d: ClimateData,
  units: Units,
  thr: (c: number, u: Units) => string,
): Pair[] {
  const e = d.extremes
  const half = Math.floor(e.years.length / 2)
  const mean = (a: (number | null)[]) => {
    const v = a.filter((x): x is number => x !== null)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0
  }
  const split = (a: (number | null)[]) => [mean(a.slice(0, half)), mean(a.slice(-half))] as const
  const row = (label: string, a: (number | null)[], unit = 'days a year'): Pair => {
    const [earlier, later] = split(a)
    return { label, earlier, later, unit }
  }
  return [
    row(`Hot days (${thr(30, units)} or more)`, e.hot30),
    row(`Very hot days (${thr(35, units)} or more)`, e.hot35),
    row(`Frost days (below ${thr(0, units)})`, e.frost),
    row('Rainy days (1 mm or more)', e.wet),
    row('Heatwaves', e.heatwave.events, 'a year'),
    row('Days spent in heatwaves', e.heatwave.days, 'days a year'),
  ]
}
export function pairSentence(p: Pair): string {
  const diff = p.later - p.earlier
  if (Math.abs(diff) < 0.5 && Math.abs(diff) < 0.15 * Math.max(p.earlier, p.later, 1))
    return 'about the same'
  return `${n1(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'}`
}
export function extremesTakeaway(pairs: Pair[], first: number, mid: number, last: number): string {
  const hot = pairs[0]
  const frost = pairs[2]
  const bits: string[] = []
  const dh = hot.later - hot.earlier
  if (hot.earlier + hot.later > 0.5)
    bits.push(
      `hot days went from ${n1(hot.earlier)} to ${n1(hot.later)} a year (${Math.abs(dh) < 0.5 ? 'little change' : dh > 0 ? 'up' : 'down'})`,
    )
  const df = frost.later - frost.earlier
  if (frost.earlier + frost.later > 0.5)
    bits.push(
      `frost days from ${n1(frost.earlier)} to ${n1(frost.later)} (${Math.abs(df) < 0.5 ? 'little change' : df > 0 ? 'up' : 'down'})`,
    )
  if (!bits.length)
    return `Neither very hot nor frosty days were common between ${first} and ${last}.`
  return `Comparing ${first}–${mid} with ${mid + 1}–${last}: ${bits.join(', and ')}.`
}

export function decadeTakeaway(d: ClimateData, units: Units): string {
  const dec = d.decades
  if (dec.length < 2) return ''
  const a = dec[0]
  const b = dec[dec.length - 1]
  const diff = b.mean - a.mean
  const t = d.trend.annual
  const more = diff >= 0 ? 'warmer' : 'cooler'
  const base = `The ${b.decade}s have averaged ${delta(Math.abs(diff), units).replace('+', '')} ${more} than the ${a.decade}s (${temp(b.mean, units)} against ${temp(a.mean, units)}).`
  if (!t) return base
  return `${base} Fitting a line through all the years gives ${delta(t.perDecade, units)} per decade, and that trend ${t.significant ? 'is' : 'is not'} statistically significant.`
}

export function quakeTakeaway(s: SeismicData, units: Units): string {
  if (s.n === 0)
    return `No earthquakes of magnitude 4.5 or more were recorded within ${dist(s.radiusKm, units)} since ${s.start.slice(0, 4)}.`
  const words = ['', 'very quiet', 'quiet', 'moderately active', 'active', 'very active']
  const top = s.top[0]
  return `This is a ${words[s.activityClass]} area for its size: ${n0(s.n)} earthquakes of magnitude 4.5 or more since ${s.start.slice(0, 4)}, about ${n1(s.ratePerYear)} a year. The strongest was magnitude ${n1(top.mag)} in ${top.time.slice(0, 4)}, ${dist(top.distanceKm, units)} away.`
}

export const WHO_PM25_24H = 15
export function airTakeaway(a: AirData, words: string[]): string {
  const c = a.current
  const cat = a.daily.length ? a.daily[a.daily.length - 1].category : null
  const word = cat === null ? null : words[cat]
  const parts: string[] = []
  if (word && c.aqi !== null) parts.push(`Air quality right now is ${word} (index ${n0(c.aqi)})`)
  if (c.pm25 !== null) {
    parts.push(
      `fine particles are at ${n1(c.pm25)} µg/m³, ${c.pm25 <= WHO_PM25_24H ? 'under' : 'over'} the World Health Organization’s 24-hour guideline of ${WHO_PM25_24H}`,
    )
  }
  return parts.length ? `${parts.join(', and ')}.` : ''
}

export function placesTakeaway(p: PlacesData, name: string): string {
  if (!p.counts) return ''
  const entries = Object.entries(p.counts).filter(([, v]) => v !== null) as [string, number][]
  if (!entries.length) return ''
  const food = p.counts.foodAndDrink
  const parks = p.counts.parks
  const bits: string[] = []
  if (food) bits.push(`${n0(food)} restaurants and cafes`)
  if (parks) bits.push(`${n0(parks)} parks`)
  if (p.counts.museums) bits.push(`${n0(p.counts.museums)} museums`)
  return `Within ${p.areaMode === 'relation' ? `${name}’s boundary` : 'a 5 km circle of the centre'}, OpenStreetMap lists ${bits.join(', ')} and more. Counts show where people have mapped, so compare cities with care.`
}

export const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : `${n}`)
