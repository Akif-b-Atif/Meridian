import { arc, line } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { useMemo, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { ClimateData, SolarData } from '../api/types'
import { MONTH_INITIALS, MONTH_START, dateOf } from '../copy'
import { useWidth } from '../lib/hooks'
import { hm, temp, tempNumber, tempUnit, type Units } from '../units'

const C = 360
const VB = { x: -100, y: -20, w: 920, h: 760 }
const angle = (doy: number) => (2 * Math.PI * (doy - 0.5)) / 365
const pt = (r: number, a: number): [number, number] => [C + r * Math.sin(a), C - r * Math.cos(a)]

export type ClockStage = 1 | 2 | 3 | 4

interface Props {
  label: string
  climate: ClimateData | null
  solar: SolarData | null
  hemisphere: 'N' | 'S'
  day: number
  onDay: (d: number) => void
  units: Units
  animate: boolean
  stage: ClockStage
}

/** The signature chart: the year as a dial. Temperature is the outer curve, daylight the inner
 *  band, and the arcs on the rim measure the lag between a solstice and the hottest or coldest day. */
export function YearClock({
  label,
  climate,
  solar,
  hemisphere,
  day,
  onDay,
  units,
  animate,
  stage,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hostRef, width] = useWidth<HTMLDivElement>(420)
  const s = VB.w / Math.max(220, width) // viewBox units per pixel, so text stays a real size
  const fs = (px: number) => px * s
  const showLabels = width >= 380

  const ring = useMemo(() => {
    if (!climate) return null
    const v = climate.dailyMeanSmooth
    let lo = Math.floor(Math.min(...v) / 5) * 5
    let hi = Math.ceil(Math.max(...v) / 5) * 5
    if (hi - lo < 10) {
      const short = (10 - (hi - lo)) / 2
      lo -= short
      hi += short
    }
    const r = scaleLinear().domain([lo, hi]).range([120, 235])
    const pts = v.map((t, i) => pt(r(t), angle(i + 1))) as [number, number][]
    const step = units === 'metric' ? 10 : 20
    const a = tempNumber(lo, units)
    const b = tempNumber(hi, units)
    const inv = (d: number) => (units === 'metric' ? d : ((d - 32) * 5) / 9)
    const guides: { label: number; radius: number }[] = []
    for (let g = Math.ceil(a / step) * step; g <= b; g += step)
      guides.push({ label: g, radius: r(inv(g)) })
    return { r, d: line()(pts) + 'Z', guides }
  }, [climate, units])

  const dayPath = useMemo(() => {
    if (!solar) return null
    const pts = solar.daylight365.map((h, i) => pt(46 + (46 * h) / 24, angle(i + 1))) as [
      number,
      number,
    ][]
    return line()(pts) + 'Z'
  }, [solar])

  const lagArc = (from: number, to: number) => {
    let a0 = angle(from)
    let a1 = angle(to)
    if (a1 - a0 > Math.PI) a0 += 2 * Math.PI
    if (a0 - a1 > Math.PI) a1 += 2 * Math.PI
    return (
      arc()({
        innerRadius: 281,
        outerRadius: 285,
        startAngle: Math.min(a0, a1),
        endAngle: Math.max(a0, a1),
      }) ?? ''
    )
  }

  const warmSol = hemisphere === 'N' ? 172 : 355
  const coldSol = hemisphere === 'N' ? 355 : 172
  const cyc = climate?.cycle
  const tAt = climate ? climate.dailyMeanSmooth[day - 1] : null
  const hAt = solar ? solar.daylight365[day - 1] : null
  const valueText = `${dateOf(day)}${tAt !== null ? `, mean ${temp(tAt, units)}` : ''}${hAt !== null ? `, daylight ${hm(hAt)}` : ''}`

  const setFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const el = svgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = VB.x + ((e.clientX - rect.left) / rect.width) * VB.w - C
    const y = VB.y + ((e.clientY - rect.top) / rect.height) * VB.h - C
    let a = Math.atan2(x, -y)
    if (a < 0) a += 2 * Math.PI
    onDay(Math.min(365, Math.max(1, Math.round((a * 365) / (2 * Math.PI) + 0.5))))
  }
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 30,
      PageDown: -30,
    }
    if (e.key in map) {
      e.preventDefault()
      onDay(((day - 1 + map[e.key] + 365) % 365) + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onDay(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      onDay(365)
    }
  }

  const anchor = (a: number) =>
    Math.sin(a) > 0.3 ? 'start' : Math.sin(a) < -0.3 ? 'end' : 'middle'
  const callout = (doy: number, r: number, text: string, strong = false) => {
    const a = angle(doy)
    const [x, y] = pt(r, a)
    return (
      <text
        x={x}
        y={y + (Math.cos(a) > 0.5 ? -fs(4) : Math.cos(a) < -0.5 ? fs(16) : fs(5))}
        textAnchor={anchor(a)}
        className={strong ? 'strong' : 'ink'}
        style={{ fontSize: fs(14) }}
      >
        {text}
      </text>
    )
  }
  const pointer = ring && tAt !== null ? pt(ring.r(tAt), angle(day)) : null
  const showDay = stage >= 2
  const showLag = stage >= 3
  const layerStyle = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0 })

  return (
    <div ref={hostRef} className="chart-host clock">
      <svg
        ref={svgRef}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        width="100%"
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
        style={{ touchAction: 'pan-y', fontSize: fs(14) }}
      >
        <style>{`.clock svg text{font-size:${fs(14)}px}`}</style>
        <circle cx={C} cy={C} r={46} fill="none" stroke="var(--edge)" />
        <g className="layer" style={layerStyle(showDay)}>
          {dayPath && (
            <path
              d={dayPath}
              fill="var(--series-b)"
              fillOpacity={0.55}
              stroke="var(--series-b)"
              strokeWidth={s}
            />
          )}
        </g>
        {ring ? (
          <>
            {ring.guides.map((g) => (
              <g key={g.label}>
                <circle
                  cx={C}
                  cy={C}
                  r={g.radius}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={s}
                  strokeOpacity={0.5}
                />
                <text
                  x={C}
                  y={C - g.radius - fs(3)}
                  textAnchor="middle"
                  style={{ fontSize: fs(13) }}
                >
                  {g.label}
                  {tempUnit(units)}
                </text>
              </g>
            ))}
            <path
              d={ring.d}
              fill="var(--series-a)"
              fillOpacity={0.12}
              stroke="var(--series-a)"
              strokeWidth={2.5 * s}
              className={animate ? 'draw-in' : undefined}
              style={animate ? ({ '--len': 2000 } as CSSProperties) : undefined}
            />
          </>
        ) : (
          <circle cx={C} cy={C} r={180} fill="none" stroke="var(--edge)" strokeDasharray="4 4" />
        )}
        {MONTH_START.map((st, i) => {
          const a = angle(st + 0.5) - Math.PI / 365
          const [x1, y1] = pt(240, a)
          const [x2, y2] = pt(246, a)
          const mid = angle(st + (i === 11 ? 15 : (MONTH_START[i + 1] - st) / 2))
          const [tx, ty] = pt(262, mid)
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--edge)" strokeWidth={s} />
              <text x={tx} y={ty + fs(5)} textAnchor="middle" style={{ fontSize: fs(14) }}>
                {MONTH_INITIALS[i]}
              </text>
            </g>
          )
        })}
        <g className="layer" style={layerStyle(showLag)}>
          {climate && cyc && cyc.mode === 'ok' && cyc.peakDoy && cyc.troughDoy && (
            <>
              <path
                d={lagArc(warmSol, cyc.peakDoy)}
                transform={`translate(${C} ${C})`}
                fill="var(--accent)"
                stroke="var(--accent)"
                strokeWidth={2 * s}
              />
              <path
                d={lagArc(coldSol, cyc.troughDoy)}
                transform={`translate(${C} ${C})`}
                fill="var(--accent)"
                stroke="var(--accent)"
                strokeWidth={2 * s}
              />
              {(() => {
                const [x, y] = pt(283, angle(cyc.peakDoy))
                return <circle cx={x} cy={y} r={5 * s} fill="var(--series-a)" />
              })()}
              {showLabels &&
                cyc.peakLagDays !== null &&
                callout(cyc.peakDoy, 306, `Warmest day · ${dateOf(cyc.peakDoy)}`, true)}
              {showLabels &&
                cyc.troughDoy &&
                callout(cyc.troughDoy, 306, `Coldest day · ${dateOf(cyc.troughDoy)}`)}
            </>
          )}
        </g>
        {[warmSol, coldSol].map((d) => {
          const [x1, y1] = pt(240, angle(d))
          const [x2, y2] = pt(292, angle(d))
          return (
            <g key={d}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={1.5 * s} />
              {showLabels &&
                showLag &&
                callout(
                  d,
                  320,
                  d === warmSol
                    ? `${hemisphere === 'N' ? 'Longest' : 'Longest'} day`
                    : 'Shortest day',
                )}
            </g>
          )
        })}
        <line
          x1={pt(46, angle(day))[0]}
          y1={pt(46, angle(day))[1]}
          x2={pt(235, angle(day))[0]}
          y2={pt(235, angle(day))[1]}
          stroke="var(--accent)"
          strokeWidth={1.5 * s}
        />
        {pointer && <circle cx={pointer[0]} cy={pointer[1]} r={6 * s} fill="var(--accent)" />}
        <text
          x={C}
          y={C - fs(2)}
          textAnchor="middle"
          className="strong"
          style={{ fontSize: fs(17) }}
        >
          {dateOf(day)}
        </text>
        {tAt !== null && (
          <text x={C} y={C + fs(15)} textAnchor="middle" style={{ fontSize: fs(13) }}>
            {temp(tAt, units)}
          </text>
        )}
        {hAt !== null && showDay && (
          <text x={C} y={C + fs(30)} textAnchor="middle" style={{ fontSize: fs(13) }}>
            {hm(hAt)} of light
          </text>
        )}
      </svg>
    </div>
  )
}
