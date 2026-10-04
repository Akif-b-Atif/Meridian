import { useEffect, useRef, useState } from 'react'
import type { ClimateData, SolarData } from '../api/types'
import { YearClock, type ClockStage } from '../charts/YearClock'
import { LAG_DISAGREE, WEAK_CYCLE, coldLag, dateOf, warmLag } from '../copy'
import { hm, temp, type Units } from '../units'
import { Term } from './Term'

interface Props {
  climate: ClimateData | null
  solar: SolarData | null
  hemisphere: 'N' | 'S'
  day: number
  onDay: (n: number) => void
  units: Units
  label: string
  animate: boolean
}

/** Scrollytelling: the dial stays in view while the text beside it walks through what each ring
 *  means. The step in view decides which layers of the dial are shown. */
export function YearStory({
  climate,
  solar,
  hemisphere,
  day,
  onDay,
  units,
  label,
  animate,
}: Props) {
  const [stage, setStage] = useState<ClockStage>(1)
  const stepsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = stepsRef.current
    if (!root || typeof IntersectionObserver === 'undefined') {
      setStage(4)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting)
            setStage(Number((e.target as HTMLElement).dataset.step) as ClockStage)
        }
      },
      { rootMargin: '-42% 0px -42% 0px' },
    )
    root.querySelectorAll('[data-step]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const sm = climate?.dailyMeanSmooth
  const hot = sm ? Math.max(...sm) : null
  const cold = sm ? Math.min(...sm) : null
  const cyc = climate?.cycle
  const sol = hemisphere === 'N' ? 'June' : 'December'
  const step = (n: ClockStage, children: React.ReactNode) => (
    <div className="step" data-step={n} data-active={stage === n}>
      {children}
    </div>
  )

  return (
    <div className="story">
      <div className="story-stage">
        <YearClock
          label={label}
          climate={climate}
          solar={solar}
          hemisphere={hemisphere}
          day={day}
          onDay={onDay}
          units={units}
          animate={animate}
          stage={stage}
        />
      </div>
      <div className="story-steps" ref={stepsRef}>
        {step(
          1,
          <>
            <h3>The outer curve is the temperature</h3>
            <p>
              Think of the dial as a calendar bent into a circle, January at the top. The further a
              point sits from the centre, the warmer the average day.
            </p>
            {hot !== null && cold !== null && (
              <p>
                Here an average day peaks at <strong>{temp(hot, units)}</strong> and bottoms out at{' '}
                <strong>{temp(cold, units)}</strong>.
              </p>
            )}
          </>,
        )}
        {step(
          2,
          <>
            <h3>The inner band is daylight</h3>
            <p>
              The blue band shows how many hours the sun is up. It is widest when days are long and
              narrowest when they are short.
            </p>
            {solar && (
              <p>
                Day length runs from <strong>{hm(solar.shortestDay.hours)}</strong> on{' '}
                {dateOf(solar.shortestDay.doy)} to <strong>{hm(solar.longestDay.hours)}</strong> on{' '}
                {dateOf(solar.longestDay.doy)}.
              </p>
            )}
          </>,
        )}
        {step(
          3,
          <>
            <h3>The heat arrives late</h3>
            {cyc &&
            cyc.mode === 'ok' &&
            cyc.peakDoy !== null &&
            cyc.peakLagDays !== null &&
            cyc.peakLagCi ? (
              <>
                <p>{warmLag(cyc.peakDoy, cyc.peakLagDays, cyc.peakLagCi, hemisphere)}</p>
                {cyc.troughDoy !== null && cyc.troughLagDays !== null && (
                  <p>{coldLag(cyc.troughDoy, cyc.troughLagDays, hemisphere)}</p>
                )}
                <p className="note">
                  The blue arcs on the rim measure those gaps. The longest day is a{' '}
                  <Term id="solstice">solstice</Term>, but land and sea keep soaking up heat for
                  weeks afterwards, so the warmest day trails behind it.
                </p>
                {cyc.lagCheck === 'disagree' && <p className="note">{LAG_DISAGREE}</p>}
              </>
            ) : (
              <p>
                {cyc?.mode === 'weak'
                  ? WEAK_CYCLE
                  : `Waiting for the climate data to measure the gap after the ${sol} solstice.`}
              </p>
            )}
          </>,
        )}
        {step(
          4,
          <>
            <h3>Now try it</h3>
            <p>
              Drag around the dial, tap it, or use the arrow keys. The date you pick is shared with
              the charts below, so the climate chart and the seasons light up for that month.
            </p>
            <p>
              <strong>{dateOf(day)}</strong>
              {climate && sm ? `: typically ${temp(sm[day - 1], units)}` : ''}
              {solar ? `, with ${hm(solar.daylight365[day - 1])} of daylight` : ''}.
            </p>
          </>,
        )}
      </div>
    </div>
  )
}
