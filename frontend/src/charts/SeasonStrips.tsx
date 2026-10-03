import { scaleLinear } from 'd3-scale'
import type { ClimateData } from '../api/types'
import { DataTable } from '../components/Section'
import { useChartFocus } from '../components/useChartFocus'
import { IDLE_READOUT, MONTH_FULL, SEASON_LABEL } from '../copy'
import { n0, n1, temp, tempNumber, tempUnit, type Units } from '../units'

export function SeasonStrips({ d, units, label }: { d: ClimateData; units: Units; label: string }) {
  const W = 720,
    LABEL = 150,
    ROW = 56
  const rows = d.seasons
  const H = rows.length * ROW + 30
  const half = (W - LABEL - 24) / 2
  const all = [...d.monthly.tmean, ...rows.flatMap((s) => [s.tmin, s.tmax])]
  const xT = scaleLinear()
    .domain([tempNumber(Math.min(...all), units), tempNumber(Math.max(...all), units)])
    .nice()
    .range([LABEL, LABEL + half])
  const xP = scaleLinear()
    .domain([0, Math.max(...d.monthly.precip, 1)])
    .nice()
    .range([LABEL + half + 24, W - 8])
  const { index, setIndex, onKeyDown } = useChartFocus(rows.length)
  const monthsOf = (s: ClimateData['seasons'][number]) => {
    if (d.seasonMode === 'thermal') return [0, 1, 2].map((k) => (s.firstMonth - 1 + k) % 12)
    return d.wetDry!.wet.map((w, i) => (w === (s.name === 'wet') ? i : -1)).filter((i) => i >= 0)
  }
  const span = (s: ClimateData['seasons'][number]) => {
    const ms = monthsOf(s)
    return `${MONTH_FULL[ms[0]].slice(0, 3)} to ${MONTH_FULL[ms[ms.length - 1]].slice(0, 3)}`
  }
  const run = (name: string) => d.wetDry && (name === 'wet' ? d.wetDry.wetRun : d.wetDry.dryRun)
  const readout =
    index === null
      ? IDLE_READOUT
      : (() => {
          const s = rows[index]
          return `${SEASON_LABEL[s.name]}: ${s.days} days, mean ${temp(s.tmean, units)}, total precipitation ${n0(s.precip)} mm${s.sunHoursPerDay !== null ? `, ${n1(s.sunHoursPerDay)} hours of sunshine a day` : ''}`
        })()
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
        <text x={LABEL} y={12}>
          Temperature ({tempUnit(units)})
        </text>
        <text x={LABEL + half + 24} y={12}>
          Precipitation per month (mm)
        </text>
        {rows.map((s, k) => {
          const cy = 30 + k * ROW + ROW / 2
          const r = run(s.name)
          const title =
            d.seasonMode === 'thermal'
              ? `${SEASON_LABEL[s.name]}, ${span(s)}`
              : `${SEASON_LABEL[s.name]}${r ? `, ${MONTH_FULL[r.start - 1].slice(0, 3)} +${r.length}` : ''}`
          const ms = monthsOf(s)
          return (
            <g
              key={s.name}
              opacity={index === null || index === k ? 1 : 0.65}
              onPointerEnter={() => setIndex(k)}
            >
              <text x={0} y={cy + 5} className="ink">
                {title}
              </text>
              <line
                x1={LABEL}
                x2={LABEL + half}
                y1={cy}
                y2={cy}
                stroke="var(--edge)"
                strokeOpacity={0.4}
              />
              <rect
                x={xT(tempNumber(s.tmin, units))}
                y={cy - 5}
                width={Math.max(2, xT(tempNumber(s.tmax, units)) - xT(tempNumber(s.tmin, units)))}
                height={10}
                fill="var(--series-a)"
                fillOpacity={0.3}
              />
              {ms.map((m) => (
                <circle
                  key={m}
                  cx={xT(tempNumber(d.monthly.tmean[m], units))}
                  cy={cy}
                  r={5}
                  fill="var(--series-a)"
                />
              ))}
              <line
                x1={xT(tempNumber(s.tmean, units))}
                x2={xT(tempNumber(s.tmean, units))}
                y1={cy - 12}
                y2={cy + 12}
                stroke="var(--ink)"
                strokeWidth={2}
              />
              <line
                x1={LABEL + half + 24}
                x2={W - 8}
                y1={cy}
                y2={cy}
                stroke="var(--edge)"
                strokeOpacity={0.4}
              />
              {ms.map((m) => (
                <circle key={m} cx={xP(d.monthly.precip[m])} cy={cy} r={5} fill="var(--series-b)" />
              ))}
              <line
                x1={xP(s.precip / ms.length)}
                x2={xP(s.precip / ms.length)}
                y1={cy - 12}
                y2={cy + 12}
                stroke="var(--ink)"
                strokeWidth={2}
              />
            </g>
          )
        })}
        {xT.ticks(5).map((t) => (
          <text key={t} x={xT(t)} y={H - 4} textAnchor="middle" style={{ fontSize: 12 }}>
            {t}
          </text>
        ))}
        {xP.ticks(4).map((t) => (
          <text key={t} x={xP(t)} y={H - 4} textAnchor="middle" style={{ fontSize: 12 }}>
            {t}
          </text>
        ))}
      </svg>
      <p className="readout" aria-live="polite">
        {readout}
      </p>
      <DataTable
        caption="Seasonal statistics"
        head={[
          'Season',
          `Mean ${tempUnit(units)}`,
          `Max ${tempUnit(units)}`,
          `Min ${tempUnit(units)}`,
          'Precip mm',
          'Days',
        ]}
        rows={rows.map((s) => [
          SEASON_LABEL[s.name],
          n1(tempNumber(s.tmean, units)),
          n1(tempNumber(s.tmax, units)),
          n1(tempNumber(s.tmin, units)),
          n0(s.precip),
          s.days,
        ])}
      />
    </div>
  )
}
