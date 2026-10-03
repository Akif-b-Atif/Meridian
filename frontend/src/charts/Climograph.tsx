import { scaleBand, scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { IDLE_READOUT, MONTH_FULL, MONTH_INITIALS } from '../copy'
import { useChartFocus } from '../components/useChartFocus'
import { n0, n1, tempNumber, tempUnit, temp, type Units } from '../units'

const W = 720,
  H = 360,
  M = { l: 52, r: 52, t: 16, b: 40 }

export function Climograph({ d, units, label }: { d: ClimateData; units: Units; label: string }) {
  const m = d.monthly
  const { index, setIndex, onKeyDown } = useChartFocus(12)
  const x = scaleBand<number>()
    .domain([...Array(12).keys()])
    .range([M.l, W - M.r])
    .padding(0.3)
  const tLo = Math.min(0, ...m.tmin),
    tHi = Math.max(...m.tmax)
  const yT = scaleLinear()
    .domain([tempNumber(tLo, units), tempNumber(tHi, units)])
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
  const i = index
  const readout =
    i === null
      ? IDLE_READOUT
      : `${MONTH_FULL[i]}: mean ${temp(m.tmean[i], units)} (max ${temp(m.tmax[i], units)}, min ${temp(m.tmin[i], units)}), precipitation ${n0(m.precip[i])} mm, ${n1(m.wetDays[i])} wet days${m.sunHoursPerDay?.[i] != null ? `, ${n1(m.sunHoursPerDay[i] as number)} hours of sunshine a day` : ''}`
  const tallest = m.precip.indexOf(Math.max(...m.precip))

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart chart-focus"
        role="group"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <text x={M.l} y={12}>
          Temperature ({tempUnit(units)})
        </text>
        <text x={W - M.r} y={12} textAnchor="end">
          Precipitation (mm)
        </text>
        {yT.ticks(5).map((t) => (
          <g key={t}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={yT(t)}
              y2={yT(t)}
              stroke="var(--edge)"
              strokeOpacity={0.35}
            />
            <text x={M.l - 6} y={yT(t) + 5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {yP.ticks(5).map((t) => (
          <text key={t} x={W - M.r + 6} y={yP(t) + 5}>
            {t}
          </text>
        ))}
        {m.precip.map((p, k) => (
          <rect
            key={k}
            x={x(k)}
            width={x.bandwidth()}
            y={yP(p)}
            height={H - M.b - yP(p)}
            fill="var(--series-b)"
            fillOpacity={k === i ? 0.95 : 0.7}
            onPointerEnter={() => setIndex(k)}
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
          <circle key={k} cx={cx(k)} cy={ty(c)} r={3.5} fill="var(--series-a)" />
        ))}
        {MONTH_INITIALS.map((l, k) => (
          <text key={k} x={cx(k)} y={H - 16} textAnchor="middle">
            {l}
          </text>
        ))}
        <text x={cx(11) + 6} y={ty(m.tmean[11]) - 4} className="ink" style={{ fontSize: 12 }}>
          Mean
        </text>
        <text x={cx(11) + 6} y={ty(m.tmax[11]) - 4} style={{ fontSize: 12 }}>
          Max
        </text>
        <text x={cx(11) + 6} y={ty(m.tmin[11]) + 14} style={{ fontSize: 12 }}>
          Min
        </text>
        <text
          x={cx(tallest)}
          y={yP(m.precip[tallest]) - 4}
          textAnchor="middle"
          style={{ fontSize: 12 }}
        >
          Precipitation
        </text>
        {i !== null && (
          <rect
            x={x(i)! - 4}
            y={M.t}
            width={x.bandwidth() + 8}
            height={H - M.b - M.t}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
        )}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <DataTable
        caption="Monthly climate normals"
        head={[
          'Month',
          `Mean ${tempUnit(units)}`,
          `Max ${tempUnit(units)}`,
          `Min ${tempUnit(units)}`,
          'Precip mm',
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
