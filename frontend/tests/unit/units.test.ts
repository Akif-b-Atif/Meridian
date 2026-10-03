import { describe, expect, it } from 'vitest'
import {
  MINUS,
  NBSP,
  cToF,
  dCToF,
  delta,
  dist,
  hm,
  kmToMi,
  n1,
  radiusLabel,
  temp,
  thresholdLabel,
} from '../../src/units'

describe('units', () => {
  it('converts absolute temperatures with an offset', () => {
    expect(cToF(0)).toBe(32)
    expect(cToF(100)).toBe(212)
    expect(cToF(-40)).toBe(-40)
  })
  it('converts temperature differences without an offset', () => {
    expect(dCToF(10)).toBe(18)
    expect(delta(1, 'imperial')).toBe(`+1.8${NBSP}°F`)
    expect(delta(-0.5, 'metric')).toBe(`${MINUS}0.5${NBSP}°C`)
    expect(delta(0.01, 'metric')).toBe(`+0.0${NBSP}°C`)
  })
  it('formats absolute temperature in both systems', () => {
    expect(temp(14.2, 'metric')).toBe(`14.2${NBSP}°C`)
    expect(temp(14.2, 'imperial')).toBe(`57.6${NBSP}°F`)
    expect(temp(-3, 'metric')).toBe(`${MINUS}3.0${NBSP}°C`)
  })
  it('converts distances and round-trips within 0.01', () => {
    expect(kmToMi(1.609344)).toBeCloseTo(1, 6)
    for (const km of [0.5, 12, 340, 5000]) expect(kmToMi(km) * 1.609344).toBeCloseTo(km, 2)
    expect(dist(5, 'metric')).toBe(`5.0${NBSP}km`)
    expect(dist(12.4, 'metric')).toBe(`12${NBSP}km`)
    expect(dist(100, 'imperial')).toBe(`62${NBSP}mi`)
  })
  it('labels radii in both systems', () => {
    expect(radiusLabel(100, 'metric')).toBe('100 km / 62 mi')
    expect(radiusLabel(300, 'imperial')).toBe('186 mi / 300 km')
    expect(radiusLabel(500, 'metric')).toBe('500 km / 311 mi')
  })
  it('converts threshold labels but not counts', () => {
    expect(thresholdLabel(30, 'imperial')).toBe(`86${NBSP}°F`)
    expect(thresholdLabel(35, 'imperial')).toBe(`95${NBSP}°F`)
    expect(thresholdLabel(0, 'imperial')).toBe(`32${NBSP}°F`)
    expect(thresholdLabel(30, 'metric')).toBe(`30${NBSP}°C`)
  })
  it('uses the true minus sign and h:mm', () => {
    expect(n1(-1.25)).toContain(MINUS)
    expect(hm(16.63)).toBe('16:38')
    expect(hm(9.9)).toBe('9:54')
  })
})
