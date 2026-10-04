import { scaleBand, scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { useState } from 'react'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT, MONTH_FULL, MONTH_INITIALS } from '../copy'
import { useWidth } from '../lib/hooks'
import { n0, n1, temp, tempNumber, tempUnit, type Units } from '../units'

/** Rain as bars (right axis) and temperature as lines (left axis), month by month. */
export function Climograph({
  d,
  units,
  label,
  highlight,
}: {
  d: ClimateData
  units: Units
  label: string
  highlight: number | null
}) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = w < 520 ? 300 : 360
  const M = { l: 46, r: 50, t: 34, b: 34 }
  const m = d.monthly
  const { index, setIndex, onKeyDown } = useChartFocus(12)
  const [hover, setHover] = useState<number | null>(null)
  const sel = hover ?? index ?? highlight
  const x = scaleBand<number>()
    .domain([...Array(12).keys()])
    .range([M.l, w - M.r])
    .padding(0.25)
  const yT = scaleLinear()
    .domain([tempNumber(Math.min(0, ...m.tmin), units), tempNumber(Math.max(...m.tmax), units)])
    .nice()
    .range([H - M.b, M.t])
  const yP = scaleLinear()
    .domain([0, Math.max(...m.precip, 1)])
    .nice()
    .range([H - M.b, M.t])
  const cx = (i: number) => (x(i) ?? 0) + x.bandwidth() / 2
  const ty = (c: number) => yT(tempNumber(c, units))
  const path = (v: number[]) =>
    line<number>()
      .x((_, i) => cx(i))
      .y((c) => ty(c))(v) ?? ''
  const full = w >= 560
  const readout =
    index === null && hover === null
      ? IDLE_READOUT
      : (() => {
          const i = (hover ?? index) as number
          return `${MONTH_FULL[i]}: average ${temp(m.tmean[i], units)}, usually between ${temp(m.tmin[i], units)} at night and ${temp(m.tmax[i], units)} by day. ${n0(m.precip[i])} mm of rain over about ${n0(m.wetDays[i])} wet days.`
        })()
  const wetMax = m.precip.indexOf(Math.max(...m.precip))
  const hotMax = m.tmean.indexOf(Math.max(...m.tmean))
  return (
    <div ref={ref} className="chart-host">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
      >
        <text x={M.l} y={14} className="strong" style={{ fill: 'var(--series-a)' }}>
          Temperature ({tempUnit(units)})
        </text>
        <text
          x={w - M.r}
          y={14}
          textAnchor="end"
          className="strong"
          style={{ fill: 'var(--series-b)' }}
        >
          Rain (mm)
        </text>
        {yT.ticks(5).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={w - M.r}
              y1={yT(t)}
              y2={yT(t)}
              stroke="var(--edge)"
              strokeOpacity={0.3}
            />
            <text x={M.l - 6} y={yT(t) + 5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {yP.ticks(5).map((t) => (
          <text key={t} x={w - M.r + 6} y={yP(t) + 5}>
            {t}
          </text>
        ))}
        {sel !== null && (
          <rect
            x={(x(sel) ?? 0) - 4}
            y={M.t}
            width={x.bandwidth() + 8}
            height={H - M.b - M.t}
            fill="var(--accent)"
            fillOpacity={0.1}
          />
        )}
        {m.precip.map((p, k) => (
          <rect
            key={k}
            x={x(k)}
            width={x.bandwidth()}
            y={yP(p)}
            height={H - M.b - yP(p)}
            fill="var(--series-b)"
            fillOpacity={0.65}
          />
        ))}
        <path
          d={path(m.tmax)}
          fill="none"
          stroke="var(--series-a)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <path
          d={path(m.tmin)}
          fill="none"
          stroke="var(--series-a)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <path d={path(m.tmean)} fill="none" stroke="var(--series-a)" strokeWidth={2.5} />
        {m.tmean.map((c, k) => (
          <circle key={k} cx={cx(k)} cy={ty(c)} r={k === sel ? 5.5 : 3.5} fill="var(--series-a)" />
        ))}
        {MONTH_INITIALS.map((l, k) => (
          <text
            key={k}
            x={cx(k)}
            y={H - 12}
            textAnchor="middle"
            className={k === sel ? 'strong' : ''}
          >
            {full ? MONTH_FULL[k].slice(0, 3) : l}
          </text>
        ))}
        {full && (
          <>
            <text x={cx(hotMax)} y={ty(m.tmax[hotMax]) - 8} textAnchor="middle" className="ink">
              Warmest: {n1(tempNumber(m.tmean[hotMax], units))}
            </text>
            <text
              x={cx(wetMax)}
              y={yP(m.precip[wetMax]) - 6}
              textAnchor="middle"
              style={{ fill: 'var(--series-b)', fontWeight: 600 }}
            >
              Wettest: {n0(m.precip[wetMax])} mm
            </text>
          </>
        )}
        {m.tmean.map((_, k) => (
          <rect
            key={k}
            x={x(k)! - 2}
            y={M.t}
            width={x.bandwidth() + 4}
            height={H - M.b - M.t}
            fill="transparent"
            onPointerEnter={() => setHover(k)}
            onClick={() => setIndex(k)}
          />
        ))}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <DataTable
        caption="Monthly climate normals"
        head={[
          'Month',
          `Mean ${tempUnit(units)}`,
          `High ${tempUnit(units)}`,
          `Low ${tempUnit(units)}`,
          'Rain mm',
          'Wet days',
        ]}
        rows={MONTH_FULL.map((mn, k) => [
          mn,
          n1(tempNumber(m.tmean[k], units)),
          n1(tempNumber(m.tmax[k], units)),
          n1(tempNumber(m.tmin[k], units)),
          n0(m.precip[k]),
          n1(m.wetDays[k]),
        ])}
      />
    </div>
  )
}
