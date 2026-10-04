import { describe, expect, it } from 'vitest'
import {
  bearingDeg,
  distanceKm,
  evenSpacingM,
  polarOf,
  solarHour,
  sunState,
} from '../../src/lib/geo'

describe('geometry', () => {
  it('measures London to Paris', () => {
    expect(distanceKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(343.6, 0)
  })
  it('gives compass bearings in the right quadrants', () => {
    expect(bearingDeg(0, 0, 10, 0)).toBeCloseTo(0, 5)
    expect(bearingDeg(0, 0, 0, 10)).toBeCloseTo(90, 5)
    expect(bearingDeg(0, 0, -10, 0)).toBeCloseTo(180, 5)
    expect(bearingDeg(0, 0, 0, -10)).toBeCloseTo(270, 5)
    expect(bearingDeg(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(148.1, 0)
  })
  it('places events around a centre', () => {
    const p = polarOf(0, 0, 0, 1)
    expect((p.bearing * 180) / Math.PI).toBeCloseTo(90, 3)
    expect(p.km).toBeCloseTo(111.2, 0)
  })
  it('spreads things evenly over an area', () => {
    expect(evenSpacingM(100, 100)).toBeCloseTo(1000, 6)
    expect(evenSpacingM(78.5, 0)).toBeNull()
  })
})

describe('sun', () => {
  const noonUtc = new Date(Date.UTC(2026, 5, 21, 12, 0, 0))
  it('solar hour follows longitude', () => {
    expect(solarHour(noonUtc, 0)).toBeCloseTo(12, 6)
    expect(solarHour(noonUtc, 90)).toBeCloseTo(18, 6)
    expect(solarHour(noonUtc, -180)).toBeCloseTo(0, 6)
  })
  it('knows when the sun is up', () => {
    expect(sunState(noonUtc, 0, 16).up).toBe(true)
    expect(sunState(noonUtc, 0, 16).progress).toBeCloseTo(0.5, 6)
    expect(sunState(new Date(Date.UTC(2026, 5, 21, 1, 0)), 0, 16)).toMatchObject({
      up: false,
      progress: null,
    })
  })
  it('handles polar day and night', () => {
    expect(sunState(noonUtc, 0, 24).up).toBe(true)
    expect(sunState(noonUtc, 0, 0).up).toBe(false)
  })
})
