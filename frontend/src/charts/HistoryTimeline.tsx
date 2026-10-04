import { useWidth } from '../lib/hooks'
import { founded } from '../copy'
import { n0 } from '../units'

/** From the founding of the place to today on one line, so the age is felt, not just read. */
export function HistoryTimeline({
  inception,
  name,
  nowYear = new Date().getFullYear(),
}: {
  inception: { year: number; precision: 7 | 8 | 9 }
  name: string
  nowYear?: number
}) {
  const [ref, w] = useWidth<HTMLDivElement>(640)
  const H = 112
  const L = 16
  const R = w - 16
  const age = nowYear - inception.year
  const marks = [1000, 1500, 1800].filter(
    (y) => y > inception.year + age * 0.08 && y < nowYear - age * 0.05,
  )
  const x = (y: number) => L + ((y - inception.year) / Math.max(1, age)) * (R - L)
  const approx = inception.precision < 9
  const ageText = `${approx ? 'about ' : ''}${n0(age)} years`
  return (
    <div ref={ref} className="chart-host">
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="chart"
        role="img"
        aria-label={`${name} was founded ${founded(inception, nowYear)}, ${ageText} ago`}
      >
        <line x1={L} x2={R} y1={50} y2={50} stroke="var(--ink)" strokeWidth={3} />
        {marks.map((y) => (
          <g key={y}>
            <line x1={x(y)} x2={x(y)} y1={44} y2={56} stroke="var(--edge)" strokeWidth={2} />
            <text x={x(y)} y={74} textAnchor="middle">
              {y}
            </text>
          </g>
        ))}
        <rect x={L - 5} y={45} width={10} height={10} fill="var(--series-a)" />
        <rect x={R - 5} y={45} width={10} height={10} fill="var(--accent)" />
        <text x={L} y={30} className="strong lg">
          {inception.year < 0 ? `${Math.abs(inception.year)} BCE` : inception.year}
        </text>
        <text x={L} y={96}>
          {approx ? 'recorded date' : 'founded'}
        </text>
        <text x={R} y={30} textAnchor="end" className="strong lg">
          {nowYear}
        </text>
        <text x={R} y={96} textAnchor="end">
          today
        </text>
        <text x={(L + R) / 2} y={30} textAnchor="middle" className="ink">
          {ageText}
        </text>
      </svg>
    </div>
  )
}
