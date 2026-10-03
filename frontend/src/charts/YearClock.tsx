import { arc, line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { useMemo, useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { ClimateData, SolarData } from '../api/types'
import { MONTH_INITIALS, MONTH_START, dateOf } from '../copy'
import { hours as fmtHours, temp, tempUnit, tempNumber, type Units } from '../units'

const C = 360
const angle = (doy: number) => (2 * Math.PI * (doy - 0.5)) / 365
const pt = (r: number, a: number): [number, number] => [C + r * Math.sin(a), C - r * Math.cos(a)]

interface Props {
  city: string
  label: string
  climate: ClimateData | null
  solar: SolarData | null
  hemisphere: 'N' | 'S'
  day: number
  onDay: (d: number) => void
  units: Units
  animate: boolean
}

export function YearClock({
  label,
  climate,
  solar,
  hemisphere,
  day,
  onDay,
  units,
  animate,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const tempRing = useMemo(() => {
    if (!climate) return null
    const v = climate.dailyMeanSmooth
    let lo = Math.floor(Math.min(...v) / 5) * 5
    let hi = Math.ceil(Math.max(...v) / 5) * 5
    if (hi - lo < 10) {
      const short = (10 - (hi - lo)) / 2
      lo -= short
      hi += short
    }
    const r = scaleLinear().domain([lo, hi]).range([130, 260])
    const pts = v.map((t, i) => pt(r(t), angle(i + 1)))
    const d = line()(pts as [number, number][]) + 'Z'
    const step = units === 'metric' ? 10 : 20
    const gl: number[] = []
    const a = tempNumber(lo, units)
    const b = tempNumber(hi, units)
    for (let g = Math.ceil(a / step) * step; g <= b; g += step) gl.push(g)
    const inv = (disp: number) => (units === 'metric' ? disp : ((disp - 32) * 5) / 9)
    return { r, d, guides: gl.map((g) => ({ label: g, radius: r(inv(g)) })) }
  }, [climate, units])

  const dayRing = useMemo(() => {
    if (!solar) return null
    const pts = solar.daylight365.map((h, i) => pt(50 + (50 * h) / 24, angle(i + 1)))
    return line()(pts as [number, number][]) + 'Z'
  }, [solar])

  const lagArc = (from: number, to: number) => {
    let a0 = angle(from)
    let a1 = angle(to)
    if (a1 - a0 > Math.PI) a0 += 2 * Math.PI
    if (a0 - a1 > Math.PI) a1 += 2 * Math.PI
    const gen = arc()({
      innerRadius: 303,
      outerRadius: 305,
      startAngle: Math.min(a0, a1),
      endAngle: Math.max(a0, a1),
    })
    return gen ?? ''
  }

  const warmSol = hemisphere === 'N' ? 172 : 355
  const coldSol = hemisphere === 'N' ? 355 : 172

  const tAt = climate ? climate.dailyMeanSmooth[day - 1] : null
  const hAt = solar ? solar.daylight365[day - 1] : null
  const valueText = `${dateOf(day)}${tAt !== null ? `, mean ${temp(tAt, units)}` : ''}${hAt !== null ? `, daylight ${hAt.toFixed(1)} hours` : ''}`

  const setFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 720 - C
    const y = ((e.clientY - rect.top) / rect.height) * 720 - C
    let a = Math.atan2(x, -y)
    if (a < 0) a += 2 * Math.PI
    onDay(Math.min(365, Math.max(1, Math.round((a * 365) / (2 * Math.PI) + 0.5))))
  }
  const onKey = (e: KeyboardEvent) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : e.key === 'PageUp'
            ? 30
            : e.key === 'PageDown'
              ? -30
              : 0
    if (step) {
      e.preventDefault()
      onDay(((day - 1 + step + 365) % 365) + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onDay(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      onDay(365)
    }
  }

  const pointerPos = tempRing && tAt !== null ? pt(tempRing.r(tAt), angle(day)) : null
  const len = 2000

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 720 720"
      className="chart chart-focus"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={365}
      aria-valuenow={day}
      aria-valuetext={valueText}
      onKeyDown={onKey}
      onPointerDown={setFromPointer}
      onPointerMove={(e) => e.buttons === 1 && setFromPointer(e)}
      style={{ touchAction: 'pan-y' }}
    >
      <circle cx={C} cy={C} r={50} fill="none" stroke="var(--edge)" />
      {dayRing ? (
        <path
          d={dayRing}
          fill="var(--series-b)"
          fillOpacity={0.55}
          stroke="var(--series-b)"
          strokeWidth={1}
        />
      ) : (
        <circle cx={C} cy={C} r={75} fill="none" stroke="var(--edge)" strokeDasharray="4 4" />
      )}
      {tempRing ? (
        <>
          {tempRing.guides.map((g) => (
            <g key={g.label}>
              <circle
                cx={C}
                cy={C}
                r={g.radius}
                fill="none"
                stroke="var(--edge)"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <text x={C} y={C - g.radius - 3} textAnchor="middle">
                {g.label}
                {tempUnit(units)}
              </text>
            </g>
          ))}
          <path
            d={tempRing.d}
            fill="var(--series-a)"
            fillOpacity={0.12}
            stroke="var(--series-a)"
            strokeWidth={2.5}
            className={animate ? 'draw-in' : undefined}
            style={animate ? ({ '--len': len } as React.CSSProperties) : undefined}
          />
        </>
      ) : (
        <circle cx={C} cy={C} r={195} fill="none" stroke="var(--edge)" strokeDasharray="4 4" />
      )}
      {MONTH_START.map((s, i) => {
        const a = angle(s + 0.5) - Math.PI / 365
        const [x1, y1] = pt(264, a)
        const [x2, y2] = pt(270, a)
        const mid = angle(s + (i === 11 ? 15 : (MONTH_START[i + 1] - s) / 2))
        const [tx, ty] = pt(286, mid)
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--edge)" />
            <text x={tx} y={ty + 5} textAnchor="middle">
              {MONTH_INITIALS[i]}
            </text>
          </g>
        )
      })}
      {climate &&
        climate.cycle.mode === 'ok' &&
        climate.cycle.peakDoy &&
        climate.cycle.troughDoy && (
          <>
            <path
              d={lagArc(warmSol, climate.cycle.peakDoy)}
              transform={`translate(${C} ${C})`}
              fill="var(--accent)"
              stroke="var(--accent)"
              strokeWidth={2}
            />
            <path
              d={lagArc(coldSol, climate.cycle.troughDoy)}
              transform={`translate(${C} ${C})`}
              fill="var(--accent)"
              stroke="var(--accent)"
              strokeWidth={2}
            />
          </>
        )}
      {[172, 355].map((d) => {
        const [x1, y1] = pt(264, angle(d))
        const [x2, y2] = pt(312, angle(d))
        const [tx, ty] = pt(334, angle(d))
        return (
          <g key={d}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={1.5} />
            <text x={tx} y={ty + 5} textAnchor="middle" className="ink">
              {dateOf(d)}
            </text>
          </g>
        )
      })}
      <line
        x1={pt(50, angle(day))[0]}
        y1={pt(50, angle(day))[1]}
        x2={pt(260, angle(day))[0]}
        y2={pt(260, angle(day))[1]}
        stroke="var(--accent)"
        strokeWidth={1.5}
      />
      {pointerPos && <circle cx={pointerPos[0]} cy={pointerPos[1]} r={6} fill="var(--accent)" />}
      <text
        x={C}
        y={C - 8}
        textAnchor="middle"
        className="ink"
        style={{ fontWeight: 600, fontSize: 16 }}
      >
        {dateOf(day)}
      </text>
      {tAt !== null && (
        <text x={C} y={C + 10} textAnchor="middle" style={{ fontSize: 13 }}>
          {temp(tAt, units)}
        </text>
      )}
      {hAt !== null && (
        <text x={C} y={C + 26} textAnchor="middle" style={{ fontSize: 13 }}>
          {fmtHours(hAt)}
        </text>
      )}
    </svg>
  )
}
