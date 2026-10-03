// All unit conversion happens here, in the browser. The API always sends metric values.
export type Units = 'metric' | 'imperial'
export const KM_PER_MILE = 1.609344
export const MINUS = '\u2212'
export const NBSP = '\u00a0'

export const cToF = (c: number) => (c * 9) / 5 + 32
export const dCToF = (d: number) => (d * 9) / 5
export const kmToMi = (km: number) => km / KM_PER_MILE

const nf = (digits: number) =>
  new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const f0 = nf(0)
const f1 = nf(1)
const f2 = nf(2)
const f3 = nf(3)
const fix = (s: string) => s.replace('-', MINUS)

export const n0 = (x: number) => fix(f0.format(x))
export const n1 = (x: number) => fix(f1.format(x))
export const n2 = (x: number) => fix(f2.format(x))
export const n3 = (x: number) => fix(f3.format(x))
export const pct = (x: number) => `${f0.format(x)}%`
export const mm = (x: number) => `${f0.format(x)}${NBSP}mm`
export const hours = (x: number) => `${f1.format(x)}${NBSP}h`

export const tempUnit = (u: Units) => (u === 'metric' ? '°C' : '°F')
export const distUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi')
export const tempNumber = (c: number, u: Units) => (u === 'metric' ? c : cToF(c))
export const deltaNumber = (d: number, u: Units) => (u === 'metric' ? d : dCToF(d))
export const distNumber = (km: number, u: Units) => (u === 'metric' ? km : kmToMi(km))

export function temp(c: number, u: Units): string {
  return `${n1(tempNumber(c, u))}${NBSP}${tempUnit(u)}`
}
/** Temperature difference: scaled without offset, sign always shown. */
export function delta(d: number, u: Units): string {
  const v = deltaNumber(d, u)
  const rounded = Math.round(Math.abs(v) * 10) / 10
  const sign = v < 0 && rounded !== 0 ? MINUS : '+'
  return `${sign}${f1.format(rounded)}${NBSP}${tempUnit(u)}`
}
export function dist(km: number, u: Units): string {
  const v = distNumber(km, u)
  return `${Math.abs(v) >= 10 ? f0.format(v) : f1.format(v)}${NBSP}${distUnit(u)}`
}
/** "100 km / 62 mi": both systems shown, preferred one first. */
export function radiusLabel(km: number, u: Units): string {
  const mi = Math.round(kmToMi(km))
  return u === 'metric' ? `${km} km / ${mi} mi` : `${mi} mi / ${km} km`
}
/** 30 degrees C is 86 degrees F. Counts do not change with the display unit. */
export function thresholdLabel(c: number, u: Units): string {
  return u === 'metric' ? `${c}${NBSP}°C` : `${Math.round(cToF(c))}${NBSP}°F`
}
export function hm(hoursValue: number): string {
  const total = Math.round(hoursValue * 60)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
