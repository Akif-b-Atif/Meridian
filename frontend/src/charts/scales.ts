import { interpolateRgb } from 'd3-interpolate'

export const DIVERGING = {
  light: [
    '#2F4B6B',
    '#4C6E91',
    '#7C9AB6',
    '#B3C5D6',
    '#E4E3DF',
    '#E3C98E',
    '#D09A45',
    '#A5432C',
    '#7A2A1E',
  ],
  dark: [
    '#A9C4E2',
    '#6F95BE',
    '#46698F',
    '#3A4D63',
    '#3E4046',
    '#5E4E2C',
    '#97702E',
    '#C9783F',
    '#EE9C7A',
  ],
}
export const SEQUENTIAL = {
  light: ['#E1E6EC', '#BCC8D5', '#8FA3B8', '#5F7893', '#38526F'],
  dark: ['#38526F', '#5F7893', '#8FA3B8', '#BCC8D5', '#E1E6EC'],
}

/** Map a value in [-limit, +limit] to one of the nine stops, interpolating between neighbours. */
export function divergingColor(value: number, limit: number, theme: 'light' | 'dark'): string {
  const stops = DIVERGING[theme]
  const t = Math.min(1, Math.max(0, (value + limit) / (2 * limit))) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(t))
  return interpolateRgb(stops[i], stops[i + 1])(t - i)
}
