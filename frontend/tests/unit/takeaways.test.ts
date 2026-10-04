import { describe, expect, it } from 'vitest'
import type { ClimateData, SeismicData, SolarData } from '../../src/api/types'
import { FIXTURES } from '../e2e/fixtures'
import {
  airTakeaway,
  dayLengthTakeaway,
  decadeTakeaway,
  extremesPairs,
  extremesTakeaway,
  koppenPlain,
  normalsTakeaway,
  pairSentence,
  quakeTakeaway,
  seasonsTakeaway,
} from '../../src/copy/takeaways'
import { thresholdLabel } from '../../src/units'

const clim = (FIXTURES.climate as { data: ClimateData }).data
const solar = (FIXTURES.solar as { data: SolarData }).data
const quake = (FIXTURES.seismic as { data: SeismicData }).data
const plain = (s: string) => s.replace(/\u00a0/g, ' ')

describe('plain-language takeaways', () => {
  it('names the warmest and wettest months from the data', () => {
    const t = plain(normalsTakeaway(clim, 'metric'))
    expect(t).toContain('July is the warmest month (18.0 °C')
    expect(t).toContain('spread fairly evenly') // 40 to 70 mm is a mild range
    const skew = {
      ...clim,
      monthly: { ...clim.monthly, precip: [10, 10, 10, 10, 10, 10, 10, 10, 10, 200, 20, 20] },
    }
    expect(normalsTakeaway(skew, 'metric')).toContain(
      'October is the wettest month (200 mm) and January the driest (10 mm)',
    )
    expect(plain(normalsTakeaway(clim, 'imperial'))).toContain('64.4 °F')
  })
  it('says rain is even when months barely differ', () => {
    const flat = { ...clim, monthly: { ...clim.monthly, precip: Array(12).fill(50) } }
    expect(normalsTakeaway(flat, 'metric')).toContain('spread fairly evenly')
  })
  it('describes the season swing', () => {
    expect(plain(seasonsTakeaway(clim, 'metric'))).toContain('Summer is the warmest season')
    expect(seasonsTakeaway({ ...clim, seasonMode: 'wetdry' }, 'metric')).toContain(
      'wet and the dry',
    )
  })
  it('compares the first and last decade', () => {
    const t = plain(decadeTakeaway(clim, 'metric'))
    expect(t).toContain('The 2020s have averaged 1.6 °C warmer than the 1950s')
    expect(t).toContain('statistically significant')
  })
  it('summarises day length, including polar cases', () => {
    expect(plain(dayLengthTakeaway(solar))).toContain('7:48 on Dec 21 to 16:36 on Jun 21')
    expect(dayLengthTakeaway({ ...solar, polarDayCount: 60, polarNightCount: 50 })).toContain(
      'never sets for 60 days and never rises for 50 days',
    )
  })
  it('compares halves of the period for extremes', () => {
    const pairs = extremesPairs(clim, 'metric', thresholdLabel)
    expect(pairs).toHaveLength(6)
    expect(pairs[0].label).toContain('Hot days')
    expect(extremesTakeaway(pairs, 1996, 2010, 2025)).toContain('1996–2010')
    expect(pairSentence({ label: 'x', earlier: 2, later: 2.1, unit: '' })).toBe('about the same')
    expect(pairSentence({ label: 'x', earlier: 2, later: 5, unit: '' })).toBe('3.0 more')
    expect(pairSentence({ label: 'x', earlier: 9, later: 4, unit: '' })).toBe('5.0 fewer')
  })
  it('explains quiet and active places', () => {
    expect(quakeTakeaway(quake, 'metric')).toContain('No earthquakes')
    const busy = {
      ...quake,
      n: 120,
      activityClass: 4 as const,
      ratePerYear: 2.2,
      top: [
        {
          time: '2011-03-11T00:00',
          mag: 7.1,
          magType: 'mw',
          depth: 10,
          place: null,
          id: 'x',
          distanceKm: 150,
        },
      ],
    }
    expect(plain(quakeTakeaway(busy, 'metric'))).toContain('active area')
    expect(plain(quakeTakeaway(busy, 'metric'))).toContain('magnitude 7.1 in 2011, 150 km away')
  })
  it('compares fine particles with the WHO guideline', () => {
    const a = {
      scale: 'eaqi',
      utcOffsetSeconds: 0,
      current: { time: 't', pm25: 8, pm10: 1, ozone: 1, aqi: 25 },
      hourly: { time: [], pm25: [] },
      daily: [{ date: 'd', pm25Mean: 8, aqiMax: 25, category: 1, partial: true }],
    } as never
    expect(airTakeaway(a, ['good', 'fair'])).toContain('fair (index 25)')
    expect(airTakeaway(a, ['good', 'fair'])).toContain('under the World Health Organization')
    const dirty = {
      ...(a as object),
      current: { time: 't', pm25: 40, pm10: 1, ozone: 1, aqi: 90 },
    } as never
    expect(airTakeaway(dirty, ['good', 'fair'])).toContain('over the World Health Organization')
  })
  it('breaks a climate code into plain letters', () => {
    expect(koppenPlain('Cfb').map((x) => x.letter)).toEqual(['C', 'f', 'b'])
    expect(koppenPlain('BWh')[1].meaning).toContain('Desert')
    expect(koppenPlain('ET')).toHaveLength(2)
  })
})
