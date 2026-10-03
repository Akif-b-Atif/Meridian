import { describe, expect, it } from 'vitest'
import { DIVERGING, divergingColor } from '../../src/charts/scales'
import { quakeRadius } from '../../src/charts/Seismic'

describe('diverging scale', () => {
  it('maps the limits and zero to the first, middle and last stops', () => {
    expect(divergingColor(-2, 2, 'light').toLowerCase()).toBe('rgb(47, 75, 107)')
    expect(divergingColor(2, 2, 'light')).toBe('rgb(122, 42, 30)')
    expect(divergingColor(0, 2, 'light')).toBe('rgb(228, 227, 223)')
    expect(DIVERGING.light).toHaveLength(9)
    expect(DIVERGING.dark).toHaveLength(9)
  })
  it('clamps values beyond the limit', () => {
    expect(divergingColor(99, 1, 'dark')).toBe(divergingColor(1, 1, 'dark'))
  })
})

describe('earthquake symbol size', () => {
  it('interpolates between the documented stops', () => {
    expect(quakeRadius(4.5)).toBe(3)
    expect(quakeRadius(5.5)).toBe(6)
    expect(quakeRadius(6.5)).toBe(12)
    expect(quakeRadius(7.5)).toBe(22)
    expect(quakeRadius(9)).toBe(40)
    expect(quakeRadius(5)).toBeCloseTo(4.5, 5)
  })
})
