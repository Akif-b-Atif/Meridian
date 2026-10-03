import { describe, expect, it } from 'vitest'
import {
  coldLag,
  compass,
  dateOf,
  doyOfDate,
  founded,
  ordinal,
  population,
  seismicSummary,
  trendSentence,
  warmLag,
  noQuakes,
  note,
} from '../../src/copy'
import { slugify } from '../../src/copy/slug'

const plain = (s: string) => s.replace(/\u00a0/g, ' ')

describe('calendar helpers', () => {
  it('maps day numbers to dates and back', () => {
    expect(dateOf(79)).toBe('Mar 20')
    expect(dateOf(172)).toBe('Jun 21')
    expect(dateOf(265)).toBe('Sep 22')
    expect(dateOf(355)).toBe('Dec 21')
    expect(dateOf(1)).toBe('Jan 1')
    expect(dateOf(365)).toBe('Dec 31')
    expect(doyOfDate(6, 21)).toBe(172)
    expect(doyOfDate(2, 29)).toBe(59)
  })
  it('gives eight compass points', () => {
    expect([0, 45, 90, 180, 270, 315, 359].map(compass)).toEqual([
      'N',
      'NE',
      'E',
      'S',
      'W',
      'NW',
      'N',
    ])
  })
  it('builds ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ])
  })
})

describe('sentences', () => {
  it('founded handles every precision and BCE', () => {
    expect(founded({ year: 43, precision: 9 }, 2026)).toContain('about 1,983 years ago')
    expect(founded({ year: -500, precision: 9 })).toBe('500 BCE')
    expect(founded({ year: 1850, precision: 8 })).toBe('the 1850s')
    expect(founded({ year: -450, precision: 8 })).toBe('the 450s BCE')
    expect(founded({ year: 1150, precision: 7 })).toBe('the 12th century')
    expect(founded({ year: -450, precision: 7 })).toBe('the 5th century BCE')
  })
  it('lag sentences name the right solstice per hemisphere', () => {
    expect(warmLag(210, 38, [35, 41], 'N')).toContain('38 days after the June solstice')
    expect(warmLag(30, -5, [-8, -2], 'S')).toContain('5 days before the December solstice')
    expect(warmLag(172, 0, [-1, 1], 'N')).toContain('on the June solstice')
    expect(coldLag(40, 20, 'N')).toContain('20 days after the December solstice')
  })
  it('trend sentence converts units and states significance', () => {
    const t = {
      perDecade: 0.3,
      slopeLo: 0.02,
      slopeHi: 0.04,
      significant: true,
      tau: 0.5,
      p: 0.0004,
    }
    expect(trendSentence(t, 'metric')).toContain('+0.3')
    expect(trendSentence(t, 'imperial')).toContain('+0.5')
    expect(trendSentence({ ...t, significant: false }, 'metric')).toContain('is not statistically')
  })
  it('population states source and year', () => {
    expect(population({ value: 1234000, year: 2021, source: 'wikidata' })).toBe(
      'Population 1,234,000 (2021, Wikidata)',
    )
    expect(population({ value: 5, year: null, source: 'geonames' })).toBe('Population 5 (GeoNames)')
  })
  it('seismic sentences follow the unit setting', () => {
    const s = {
      n: 120,
      radiusKm: 300,
      start: '1973-01-01',
      ratePerYear: 2.3,
      ratePerYearCi: [1.9, 2.7] as [number, number],
      activityClass: 3,
      ratePer100kKm2: 0.8,
    }
    expect(plain(seismicSummary(s, 'metric'))).toContain('300 km')
    expect(plain(seismicSummary(s, 'imperial'))).toContain('186 mi')
    expect(seismicSummary(s, 'metric')).toContain('moderate')
    expect(noQuakes(100, '1973-01-01', 'metric')).toContain('since 1973')
  })
  it('notes never contain a number that is not an argument', () => {
    expect(plain(note('boundary_circle', { units: 'imperial' }))).toContain('3.1 mi')
    expect(note('seismic_partial', { units: 'metric', coverageStart: '1990-01-01' })).toContain(
      '1990-01-01',
    )
    expect(note('nonsense', { units: 'metric' })).toBe('')
  })
})

describe('slug', () => {
  it('strips accents, lowers, hyphenates and caps length', () => {
    expect(slugify('São Paulo')).toBe('sao-paulo')
    expect(slugify('  Zürich!! ')).toBe('zurich')
    expect(slugify('東京')).toBe('city')
    expect(slugify('a'.repeat(100)).length).toBe(60)
  })
})
