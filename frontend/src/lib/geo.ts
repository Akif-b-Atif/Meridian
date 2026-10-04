// Small geometry and solar helpers used by the radar and the "right now" panel.
const R = 6371.0088
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dphi = rad(lat2 - lat1)
  const dl = rad(lon2 - lon1)
  const h =
    Math.sin(dphi / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial great-circle bearing from point 1 to point 2, in degrees clockwise from north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = rad(lat1)
  const p2 = rad(lat2)
  const dl = rad(lon2 - lon1)
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/** Mean solar hour (0 to 24) at a longitude. Ignores the equation of time (up to about 16 min). */
export function solarHour(now: Date, lon: number): number {
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  return (((utc + lon / 15) % 24) + 24) % 24
}

export interface SunState {
  up: boolean
  /** 0 at sunrise, 1 at sunset, null at night */
  progress: number | null
  solarHour: number
}

export function sunState(now: Date, lon: number, dayLengthHours: number): SunState {
  const h = solarHour(now, lon)
  if (dayLengthHours >= 24) return { up: true, progress: (h - 0) / 24, solarHour: h }
  if (dayLengthHours <= 0) return { up: false, progress: null, solarHour: h }
  const rise = 12 - dayLengthHours / 2
  const set = 12 + dayLengthHours / 2
  const up = h >= rise && h <= set
  return { up, progress: up ? (h - rise) / dayLengthHours : null, solarHour: h }
}

/** If n things were spread evenly over an area, the grid spacing between neighbours in metres. */
export function evenSpacingM(areaKm2: number, count: number): number | null {
  if (!count || count <= 0 || areaKm2 <= 0) return null
  return Math.sqrt((areaKm2 * 1e6) / count)
}

/** Position of an event around a centre as (angle in radians clockwise from north, distance km). */
export function polarOf(cLat: number, cLon: number, lat: number, lon: number) {
  return { bearing: rad(bearingDeg(cLat, cLon, lat, lon)), km: distanceKm(cLat, cLon, lat, lon) }
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
