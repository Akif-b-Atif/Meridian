import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useModule } from '../api/hooks'
import type {
  AirData,
  BoundaryData,
  ClimateData,
  HistoryData,
  IdentityData,
  PlacesData,
  SeismicData,
  SolarData,
  WaterData,
} from '../api/types'
import { AirChart, AqiBands } from '../charts/Air'
import { Climograph } from '../charts/Climograph'
import { DayStrip, DaylightCurve } from '../charts/Daylight'
import { Dumbbells, YearByYear } from '../charts/Extremes'
import { HistoryTimeline } from '../charts/HistoryTimeline'
import { NotableList, PlaceTiles } from '../charts/Places'
import { SeasonBars } from '../charts/SeasonBars'
import {
  ActivityMeter,
  GutenbergRichter,
  MagnitudeLadder,
  PerYear,
  Scatter,
  SeismicRadar,
  Tables,
} from '../charts/Seismic'
import { DecadeDots, Stripes, TrendScatter } from '../charts/Warming'
import { WaterCards } from '../charts/Water'
import { Chapter, Curious, HowTo, Legend, Takeaway } from '../components/Chapter'
import { Hero } from '../components/Hero'
import { KoppenBlock } from '../components/KoppenBlock'
import { MapSection } from '../components/MapSection'
import { ModuleView, Notes, SourceLine } from '../components/Section'
import { Term } from '../components/Term'
import { YearStory } from '../components/YearStory'
import { Rail, jumpChapter } from '../components/Rail'
import {
  ACTIVITY,
  AQI_WORDS,
  CONTINENTALITY,
  MONTH_FULL,
  MONTH_START,
  SEASONALITY,
  chartLabels,
  dateOf,
  doyOfDate,
  founded,
  heatwaveSentence,
  radiusLabel,
  trendSentence,
} from '../copy'
import { slugify } from '../copy/slug'
import {
  airTakeaway,
  dayLengthTakeaway,
  decadeTakeaway,
  extremesPairs,
  extremesTakeaway,
  normalsTakeaway,
  placesTakeaway,
  quakeTakeaway,
  seasonsTakeaway,
  whereTakeaway,
} from '../copy/takeaways'
import { prefersReducedMotion } from '../lib/hooks'
import { usePrefs } from '../state/preferences'
import {
  delta,
  deltaNumber,
  dist,
  distNumber,
  distUnit,
  hm,
  n0,
  n1,
  n2,
  n3,
  temp,
  thresholdLabel,
  tempNumber,
  tempUnit,
} from '../units'

const RADII = [100, 300, 500] as const
const CHAPTERS = [
  { id: 'where', title: 'Where it is' },
  { id: 'story', title: 'How it began' },
  { id: 'places', title: 'What’s there' },
  { id: 'year', title: 'The year' },
  { id: 'weather', title: 'Typical weather' },
  { id: 'light', title: 'Daylight' },
  { id: 'extremes', title: 'Extremes' },
  { id: 'warming', title: 'Warming' },
  { id: 'ground', title: 'Earthquakes' },
  { id: 'air', title: 'Air' },
]
const IDS = CHAPTERS.map((c) => c.id)

function todayDoy(tz: string): number {
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date())
    return doyOfDate(
      Number(p.find((x) => x.type === 'month')?.value),
      Number(p.find((x) => x.type === 'day')?.value),
    )
  } catch {
    return 172
  }
}
const monthOf = (doy: number) => {
  let m = 11
  while (MONTH_START[m] >= doy) m--
  return m
}

export function City() {
  const { geonameId = '', slug = '' } = useParams()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { units, resolvedTheme } = usePrefs()
  const valid = /^\d{1,10}$/.test(geonameId)
  const radius = RADII.find((r) => String(r) === sp.get('r')) ?? 300
  const base = valid ? `/api/cities/${geonameId}` : null

  const ident = useModule<IdentityData>('identity', base)
  const idData = ident.result?.kind === 'ok' ? ident.result.envelope.data : null
  const ready = idData !== null
  const sub = (p: string) => (base && ready ? `${base}/${p}` : null)

  const climate = useModule<ClimateData>('climate', sub('climate'), ready)
  const solar = useModule<SolarData>('solar', sub('solar'), ready)
  const water = useModule<WaterData>('water', sub('water'), ready)
  const history = useModule<HistoryData>('history', sub('history'), ready)
  const air = useModule<AirData>('air', sub('air'), ready)
  const seismic = useModule<SeismicData>('seismic', sub(`seismic?radius=${radius}`), ready)
  const boundary = useModule<BoundaryData>('boundary', sub('boundary'), ready)
  const places = useModule<PlacesData>(
    'places',
    sub('places'),
    ready && !!boundary.result && !boundary.isFetching,
  )

  const [day, setDay] = useState(172)
  const [clockAnim, setClockAnim] = useState(true)
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number } | null>(null)
  const [layersReq, setLayersReq] = useState(0)
  const reduce = prefersReducedMotion()

  useEffect(() => {
    if (idData) setDay(todayDoy(idData.timezone))
  }, [idData?.timezone]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => setClockAnim(false), 1500)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!idData) return
    document.title = `${idData.name}${idData.country ? `, ${idData.country}` : ''} - Meridian`
    const canon = slugify(idData.name)
    if (slug !== canon)
      nav(`/city/${idData.geonameId}/${canon}${sp.toString() ? `?${sp}` : ''}`, { replace: true })
  }, [idData, slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // j and k move between chapters
  useEffect(() => {
    if (!idData) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') jumpChapter(IDS, 1)
      if (e.key === 'k') jumpChapter(IDS, -1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [idData])

  const cEnv = climate.result?.kind === 'ok' ? climate.result.envelope : null
  const sEnv = solar.result?.kind === 'ok' ? solar.result.envelope : null
  const wEnv = water.result?.kind === 'ok' ? water.result.envelope : null
  const cData = cEnv?.data ?? null
  const sData = sEnv?.data ?? null
  const labels = useMemo(
    () => chartLabels(idData?.name ?? '', cData?.dataWindow.end),
    [idData, cData],
  )

  if (!valid) return <NotFoundInline />
  if (!idData) {
    return (
      <div style={{ paddingTop: 48 }}>
        <ModuleView q={ident} title="Location" height={220}>
          {() => null}
        </ModuleView>
      </div>
    )
  }
  const hemi = idData.lat < 0 ? 'S' : 'N'
  const month = monthOf(day)
  const showMap = (p: { lat: number; lon: number }) => {
    setLayersReq((n) => n + 1)
    setFocus({ lat: p.lat, lon: p.lon, n: Date.now() })
    document.getElementById('where')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }
  const distStat = (km: number) => ({
    value: distNumber(km, units),
    format: (x: number) => `${n0(Math.round(x))} ${distUnit(units)}`,
  })

  return (
    <div>
      <Hero d={idData} solar={sData} day={day} />
      <div className="report">
        <Rail items={CHAPTERS} />
        <div>
          {/* 1 ------------------------------------------------------------------ */}
          <Chapter
            id="where"
            num={1}
            title="Where it is"
            question="Where on Earth is this, and what is nearby?"
            stats={[
              ...(idData.elevationM !== null
                ? [
                    {
                      value: idData.elevationM,
                      format: (x: number) => `${n0(Math.round(x))} m`,
                      label: 'above sea level',
                    },
                  ]
                : []),
              ...(wEnv?.data
                ? [{ ...distStat(wEnv.data.coast.km), label: 'to the nearest coast' }]
                : []),
              ...(idData.areaKm2
                ? [
                    {
                      value: idData.areaKm2,
                      format: (x: number) => `${n0(Math.round(x))} km²`,
                      label: 'area of the city',
                    },
                  ]
                : []),
            ]}
          >
            <Takeaway>{whereTakeaway(idData, wEnv?.data ?? null, units)}</Takeaway>
            <MapSection
              ident={idData}
              boundary={boundary.result?.kind === 'ok' ? boundary.result.envelope : null}
              places={places.result?.kind === 'ok' ? places.result.envelope : null}
              seismic={seismic.result?.kind === 'ok' ? seismic.result.envelope : null}
              water={wEnv}
              focus={focus}
              layersRequest={layersReq}
            />
            <ModuleView q={water} title="Water" height={120}>
              {(env) => (
                <div className="stack">
                  <h3>How far is the water?</h3>
                  <WaterCards d={env.data} units={units} city={idData.name} />
                  <SourceLine env={env} />
                </div>
              )}
            </ModuleView>
          </Chapter>

          {/* 2 ------------------------------------------------------------------ */}
          <Chapter
            id="story"
            num={2}
            title="How it began"
            question="How old is this place, and what is it part of?"
            stats={[
              ...(idData.inception
                ? [
                    {
                      value: founded(idData.inception).replace(/\u00a0\(.*$/, ''),
                      label: 'founded',
                    },
                  ]
                : []),
              ...(history.result?.kind === 'ok' && history.result.envelope.data?.country?.name
                ? [{ value: history.result.envelope.data.country.name as string, label: 'country' }]
                : []),
              ...(history.result?.kind === 'ok' && history.result.envelope.data?.country?.capital
                ? [
                    {
                      value: history.result.envelope.data.country.capital as string,
                      label: 'national capital',
                    },
                  ]
                : []),
            ]}
          >
            <ModuleView q={history} title="History" height={200}>
              {(env) => {
                const c = env.data.country
                const rows: [string, string | null][] = [
                  ['Currency', c?.currencies.length ? c.currencies.join(', ') : null],
                  ['Languages', c?.languages.length ? c.languages.join(', ') : null],
                  ['Dialling code', c?.callingCode ?? null],
                  ['Drives on the', c?.drivingSide ?? null],
                ]
                return (
                  <div className="stack-lg">
                    <Notes env={env} only={['wikidata_missing', 'country_facts_failed']} />
                    {env.data.inception && (
                      <HistoryTimeline inception={env.data.inception} name={idData.name} />
                    )}
                    {env.data.wikipedia ? (
                      <div className="stack">
                        <p className="pull">{env.data.wikipedia.text}</p>
                        <p>
                          <a
                            href={env.data.wikipedia.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Read the full article on Wikipedia
                          </a>
                        </p>
                        <p className="note">Text from Wikipedia, CC BY-SA 4.0.</p>
                      </div>
                    ) : (
                      <p>This place has no English Wikipedia article.</p>
                    )}
                    {rows.some(([, v]) => v) && (
                      <dl className="facts">
                        {rows
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} style={{ display: 'contents' }}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                      </dl>
                    )}
                    <SourceLine env={env} />
                  </div>
                )
              }}
            </ModuleView>
          </Chapter>

          {/* 3 ------------------------------------------------------------------ */}
          <Chapter
            id="places"
            num={3}
            title="What’s there"
            question="What does a day here look like on the ground?"
            stats={(() => {
              const c = places.result?.kind === 'ok' ? places.result.envelope.data?.counts : null
              if (!c) return []
              return [
                ...(c.foodAndDrink
                  ? [
                      {
                        value: c.foodAndDrink,
                        format: (x: number) => n0(Math.round(x)),
                        label: 'restaurants and cafes',
                      },
                    ]
                  : []),
                ...(c.parks
                  ? [{ value: c.parks, format: (x: number) => n0(Math.round(x)), label: 'parks' }]
                  : []),
                ...(c.museums
                  ? [
                      {
                        value: c.museums,
                        format: (x: number) => n0(Math.round(x)),
                        label: 'museums',
                      },
                    ]
                  : []),
              ]
            })()}
          >
            <ModuleView q={places} title="Places" height={260}>
              {(env) => (
                <div className="stack-lg">
                  <Notes env={env} />
                  <Takeaway>{placesTakeaway(env.data, idData.name)}</Takeaway>
                  <PlaceTiles d={env.data} units={units} />
                  <div className="stack">
                    <h3>Notable places</h3>
                    <NotableList d={env.data} units={units} onShow={showMap} />
                  </div>
                  <SourceLine env={env} />
                </div>
              )}
            </ModuleView>
          </Chapter>

          {/* 4 ------------------------------------------------------------------ */}
          <Chapter
            id="year"
            num={4}
            title="The year"
            question="How does the year unfold here, and when does the heat actually arrive?"
            stats={
              cData && cData.cycle.mode === 'ok' && cData.cycle.peakDoy !== null
                ? [
                    { value: dateOf(cData.cycle.peakDoy), label: 'warmest day of a typical year' },
                    ...(cData.cycle.peakLagDays !== null
                      ? [
                          {
                            value: Math.abs(cData.cycle.peakLagDays),
                            format: (x: number) => `${Math.round(x)} days`,
                            label: `${cData.cycle.peakLagDays >= 0 ? 'after' : 'before'} the ${hemi === 'N' ? 'June' : 'December'} solstice`,
                          },
                        ]
                      : []),
                    {
                      value: cData.annual.dT,
                      format: (x: number) => `${n1(deltaNumber(x, units))} ${tempUnit(units)}`,
                      label: 'swing between coldest and warmest month',
                    },
                  ]
                : undefined
            }
          >
            <ModuleView q={climate} title="The year" height={420}>
              {(env) => (
                <div className="stack-lg">
                  <Notes env={env} />
                  <YearStory
                    climate={env.data}
                    solar={sData}
                    hemisphere={hemi}
                    day={day}
                    onDay={setDay}
                    units={units}
                    label={labels.clock}
                    animate={clockAnim && !reduce}
                  />
                  <div className="stack">
                    <h3>The four seasons</h3>
                    <Takeaway>{seasonsTakeaway(env.data, units)}</Takeaway>
                    <SeasonBars
                      d={env.data}
                      units={units}
                      label={labels.seasons}
                      highlight={month}
                    />
                    <HowTo>
                      <p>
                        Each bar runs from the typical overnight low (left end) to the typical
                        afternoon high (right end) of a season. The dot is the average. A longer bar
                        means bigger swings between night and day.
                      </p>
                      <p>
                        Seasons are the calendar kind: in the{' '}
                        {hemi === 'N' ? 'northern' : 'southern'} hemisphere winter is{' '}
                        {hemi === 'N' ? 'December to February' : 'June to August'}.
                      </p>
                    </HowTo>
                  </div>
                  <Curious>
                    <p className="note">
                      The lag comes from fitting a smooth annual wave to 30 years of daily averages.
                      The range after the lag is a 90% interval from 500 resamples of those years (
                      <Term id="bootstrap">bootstrap</Term>). Temperatures are{' '}
                      <Term id="era5">ERA5</Term> <Term id="reanalysis">reanalysis</Term> values for
                      the area around the city.
                    </p>
                  </Curious>
                  <SourceLine env={env} />
                </div>
              )}
            </ModuleView>
          </Chapter>

          {/* 5 ------------------------------------------------------------------ */}
          <Chapter
            id="weather"
            num={5}
            title="Typical weather"
            question="What should I pack, month by month?"
            stats={
              cData
                ? [
                    {
                      value: tempNumber(cData.annual.mat, units),
                      format: (x) => `${n1(x)} ${tempUnit(units)}`,
                      label: 'average temperature',
                    },
                    {
                      value: cData.annual.map,
                      format: (x) => `${n0(Math.round(x))} mm`,
                      label: 'rain in a year',
                    },
                    { value: cData.koppen.code, label: 'climate type' },
                  ]
                : undefined
            }
          >
            <ModuleView q={climate} title="Climate" height={380}>
              {(env) => {
                const d = env.data
                return (
                  <div className="stack-lg">
                    <Takeaway>{normalsTakeaway(d, units)}</Takeaway>
                    <div>
                      <Legend
                        items={[
                          { label: 'Average temperature', kind: 'line' },
                          { label: 'Typical high and low', kind: 'dash' },
                          { label: 'Rain', kind: 'box' },
                        ]}
                      />
                      <Climograph d={d} units={units} label={labels.normals} highlight={month} />
                    </div>
                    <HowTo>
                      <p>
                        The solid line is the average temperature for each month, read on the left
                        axis. The dashed lines above and below it are the typical afternoon high and
                        overnight low. The bars are rainfall, read on the right axis. The
                        highlighted month follows the date on the year dial.
                      </p>
                    </HowTo>
                    <KoppenBlock d={d} units={units} />
                    <Curious>
                      <dl className="facts">
                        <dt>Wet days a year</dt>
                        <dd>{n0(d.monthly.wetDays.reduce((a, b) => a + b, 0))}</dd>
                        {d.annual.sunHours !== null && (
                          <>
                            <dt>Sunshine</dt>
                            <dd>
                              {n0(d.annual.sunHours)} hours a year
                              {d.annual.sunPercent !== null &&
                                `, ${n0(d.annual.sunPercent)}% of the daylight hours`}
                            </dd>
                          </>
                        )}
                        <dt>
                          <Term id="continentality">Continentality</Term>
                        </dt>
                        <dd>
                          K = {n1(d.indices.gorczynskiK)},{' '}
                          {CONTINENTALITY[d.indices.continentality]}
                        </dd>
                        {d.indices.seasonalityClass !== null && (
                          <>
                            <dt>Rainfall seasonality</dt>
                            <dd>
                              {n3(d.indices.seasonalityIndex ?? 0)},{' '}
                              {SEASONALITY[d.indices.seasonalityClass]}
                            </dd>
                          </>
                        )}
                      </dl>
                      {d.annual.sunHours !== null && (
                        <p className="note">
                          Sunshine is a model value and is not comparable with station records.
                        </p>
                      )}
                      <p className="note">
                        Climate types follow Peel, Finlayson and McMahon (2007), applied to ERA5
                        monthly normals.
                      </p>
                    </Curious>
                    <SourceLine env={env} />
                  </div>
                )
              }}
            </ModuleView>
          </Chapter>

          {/* 6 ------------------------------------------------------------------ */}
          <Chapter
            id="light"
            num={6}
            title="Daylight"
            question="How much daylight do you get, and how fast does it change?"
            stats={
              sData
                ? [
                    {
                      value: hm(sData.longestDay.hours),
                      label: `longest day, ${dateOf(sData.longestDay.doy)}`,
                    },
                    {
                      value: hm(sData.shortestDay.hours),
                      label: `shortest day, ${dateOf(sData.shortestDay.doy)}`,
                    },
                    { value: hm(sData.daylight365[day - 1]), label: `on ${dateOf(day)}` },
                  ]
                : undefined
            }
          >
            <ModuleView q={solar} title="Daylight" height={300}>
              {(env) => (
                <div className="stack-lg">
                  <Takeaway>{dayLengthTakeaway(env.data)}</Takeaway>
                  <DaylightCurve d={env.data} day={day} onDay={setDay} label={labels.daylight} />
                  <div className="stack">
                    <h3>{dateOf(day)}, hour by hour</h3>
                    <DayStrip
                      hours={env.data.daylight365[day - 1]}
                      label={`The ${dateOf(day)} in ${idData.name}: ${hm(env.data.daylight365[day - 1])} of daylight`}
                    />
                    <p className="note">
                      The bar covers the 24 hours of the chosen date, centred on solar noon, when
                      the sun is highest. Drag the curve above to change the date.
                    </p>
                  </div>
                  <HowTo>
                    <p>
                      The curve shows day length for every day of the year. The blue marker is the
                      date you picked on the year dial. Near the equator the curve is almost flat;
                      the closer to a pole, the bigger the swing.
                    </p>
                  </HowTo>
                </div>
              )}
            </ModuleView>
          </Chapter>

          {/* 7 ------------------------------------------------------------------ */}
          <Chapter
            id="extremes"
            num={7}
            title="Extremes"
            question="Are the hot and cold days changing?"
          >
            <ModuleView q={climate} title="Extremes" height={420}>
              {(env) => {
                const d = env.data
                const pairs = extremesPairs(d, units, thresholdLabel)
                const ys = d.extremes.years
                const half = Math.floor(ys.length / 2)
                const first = `${ys[0]}–${ys[half - 1]}`
                const last = `${ys[ys.length - half]}–${ys[ys.length - 1]}`
                return (
                  <div className="stack-lg">
                    <Takeaway>
                      {extremesTakeaway(pairs, ys[0], ys[half - 1], ys[ys.length - 1])}
                    </Takeaway>
                    <Dumbbells
                      pairs={pairs}
                      firstLabel={first}
                      lastLabel={last}
                      label={`Extreme days in ${idData.name}, ${first} against ${last}`}
                    />
                    <HowTo>
                      <p>
                        Each row compares two halves of the same 30-year period. The open dot is the
                        yearly average in the earlier half, the filled dot the later half, and the
                        line between them is the change. Rows have their own scales, so compare the
                        numbers, not the line lengths.
                      </p>
                      <p>
                        A <Term id="heatwave">heatwave</Term> is three or more days in a row hotter
                        than 90% of the days normal for that time of year (the{' '}
                        <Term id="percentile">90th percentile</Term>).
                      </p>
                    </HowTo>
                    <Curious title="Year by year">
                      <p>
                        {heatwaveSentence(d.extremes.heatwave.first15, d.extremes.heatwave.last15)}
                      </p>
                      <YearByYear d={d} units={units} />
                    </Curious>
                    <SourceLine env={env} />
                  </div>
                )
              }}
            </ModuleView>
          </Chapter>

          {/* 8 ------------------------------------------------------------------ */}
          <Chapter
            id="warming"
            num={8}
            title="Warming"
            question="Is this place warming up, and by how much?"
            stats={(() => {
              if (!cData) return undefined
              const t = cData.trend.annual
              const dec = cData.decades
              const valid = cData.annualMean
                .map((v, i) => ({ v, y: cData.dataWindow.trendStart + i }))
                .filter((p): p is { v: number; y: number } => p.v !== null)
              const hot = valid.length ? valid.reduce((a, b) => (b.v > a.v ? b : a)) : null
              return [
                ...(t
                  ? [{ value: delta(t.perDecade, units), label: 'per decade since 1950' }]
                  : []),
                ...(dec.length > 1
                  ? [
                      {
                        value: delta(dec[dec.length - 1].mean - dec[0].mean, units),
                        label: `${dec[dec.length - 1].decade}s compared with the ${dec[0].decade}s`,
                      },
                    ]
                  : []),
                ...(hot
                  ? [
                      {
                        value: String(hot.y),
                        label: `warmest year on record (${temp(hot.v, units)})`,
                      },
                    ]
                  : []),
              ]
            })()}
          >
            <ModuleView q={climate} title="Warming" height={420}>
              {(env) => {
                const d = env.data
                const t = d.trend.annual
                return (
                  <div className="stack-lg">
                    <Takeaway>{decadeTakeaway(d, units)}</Takeaway>
                    <div className="stack">
                      <h3>Every year since {d.dataWindow.trendStart}, as a stripe</h3>
                      <Stripes d={d} units={units} theme={resolvedTheme} label={labels.stripes} />
                    </div>
                    <div className="stack">
                      <h3>The same story by decade</h3>
                      <DecadeDots d={d} units={units} label={labels.trend} />
                    </div>
                    <HowTo>
                      <p>
                        Each stripe is one year. Its colour shows how far that year’s average
                        temperature was from the <Term id="anomaly">1961 to 1990 average</Term>:
                        blue-grey for cooler, brick for warmer. The lower chart averages each decade
                        so the pattern is easier to see.
                      </p>
                    </HowTo>
                    <Curious>
                      {t ? (
                        <p>
                          {trendSentence(t, units)} The line is a{' '}
                          <Term id="theilsen">Theil–Sen trend</Term>, and the “Kendall tau” (
                          <Term id="tau">τ</Term>) says how consistently values rose.
                        </p>
                      ) : (
                        <p>Trend information is not available for this place.</p>
                      )}
                      <p className="note">
                        Annual values are autocorrelated, so the p-value is optimistic.
                      </p>
                      {t && <TrendScatter d={d} units={units} label={labels.trend} />}
                      <div
                        className="scroll-x"
                        tabIndex={0}
                        role="region"
                        aria-label="Seasonal trends"
                      >
                        <table>
                          <caption>Change per decade by season</caption>
                          <thead>
                            <tr>
                              <th scope="col">Season</th>
                              <th scope="col">Change per decade</th>
                              <th scope="col">Significant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.trend.seasons.map((s) => (
                              <tr key={s.season}>
                                <th scope="row">{s.season}</th>
                                <td>{s.trend ? delta(s.trend.perDecade, units) : '–'}</td>
                                <td>{s.trend ? (s.trend.significant ? 'yes' : 'no') : '–'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Curious>
                    <SourceLine env={env} />
                  </div>
                )
              }}
            </ModuleView>
          </Chapter>

          {/* 9 ------------------------------------------------------------------ */}
          <Chapter
            id="ground"
            num={9}
            title="Earthquakes"
            question="How restless is the ground here?"
            stats={(() => {
              const s = seismic.result?.kind === 'ok' ? seismic.result.envelope.data : null
              if (!s) return undefined
              return [
                {
                  value: s.n,
                  format: (x: number) => n0(Math.round(x)),
                  label: `earthquakes of magnitude 4.5+ since ${s.start.slice(0, 4)}`,
                },
                ...(s.top[0]
                  ? [
                      {
                        value: `M${n1(s.top[0].mag)}`,
                        label: `strongest, ${s.top[0].time.slice(0, 4)}`,
                      },
                    ]
                  : []),
                { value: s.ratePerYear, format: (x: number) => n1(x), label: 'a year, on average' },
              ]
            })()}
          >
            <div
              role="radiogroup"
              aria-label="Search radius"
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
            >
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={r === radius}
                  onClick={() =>
                    setSp(
                      (p) => {
                        const n = new URLSearchParams(p)
                        n.set('r', String(r))
                        return n
                      },
                      { replace: true },
                    )
                  }
                >
                  {radiusLabel(r, units)}
                </button>
              ))}
            </div>
            <ModuleView q={seismic} title="Earthquake" height={360}>
              {(env) => {
                const d = env.data
                return (
                  <div className="stack-lg">
                    <Notes env={env} only={['seismic_partial', 'seismic_truncated']} />
                    <Takeaway>{quakeTakeaway(d, units)}</Takeaway>
                    {d.n === 0 ? null : (
                      <>
                        <div className="cols-2">
                          <div className="stack">
                            <SeismicRadar
                              d={d}
                              lat={idData.lat}
                              lon={idData.lon}
                              units={units}
                              label={labels.quakes}
                              theme={resolvedTheme}
                            />
                          </div>
                          <div className="stack">
                            <ActivityMeter cls={d.activityClass} />
                            <MagnitudeLadder />
                            <p className="note">
                              Each dot is an earthquake, placed at its real distance and compass
                              direction from the city (the square in the middle). Bigger dots are
                              stronger. Press Play to watch the record build up since{' '}
                              {d.start.slice(0, 4)}.
                            </p>
                          </div>
                        </div>
                        <HowTo>
                          <p>
                            The rings mark one third, two thirds and the full search radius. Dots
                            that glow are from the last year or so of the time shown. Only
                            earthquakes of <Term id="magnitude">magnitude</Term> 4.5 or more are
                            counted, because smaller ones are not recorded reliably everywhere.
                          </p>
                        </HowTo>
                        <Curious>
                          <p>
                            {`${n0(d.n)} earthquakes since ${d.start.slice(0, 4)}: about ${n1(d.ratePerYear)} a year (90% range ${n1(d.ratePerYearCi[0])} to ${n1(d.ratePerYearCi[1])}). Activity class: ${ACTIVITY[d.activityClass]}, ${n2(d.ratePer100kKm2)} per 100,000 km² a year. The balance of large to small quakes is the `}
                            <Term id="bvalue">b-value</Term>.
                          </p>
                          <Scatter d={d} units={units} label={labels.quakes} />
                          <div className="cols-2">
                            <PerYear d={d} />
                            <GutenbergRichter d={d} />
                          </div>
                          <Tables d={d} units={units} />
                          <p className="note">
                            Catalogue completeness varies by region and era. Results concern the
                            chosen radius ({dist(d.radiusKm, units)}), not local fault geometry.
                          </p>
                        </Curious>
                      </>
                    )}
                    <SourceLine env={env} />
                  </div>
                )
              }}
            </ModuleView>
          </Chapter>

          {/* 10 ----------------------------------------------------------------- */}
          <Chapter
            id="air"
            num={10}
            title="Air"
            question="Is the air clean right now?"
            stats={(() => {
              const a = air.result?.kind === 'ok' ? air.result.envelope.data : null
              if (!a) return undefined
              const cat = a.daily.length ? a.daily[a.daily.length - 1].category : null
              return [
                ...(cat !== null
                  ? [{ value: AQI_WORDS[a.scale][cat], label: 'air quality now' }]
                  : []),
                ...(a.current.pm25 !== null
                  ? [
                      {
                        value: a.current.pm25,
                        format: (x: number) => `${n1(x)} µg/m³`,
                        label: 'fine particles',
                      },
                    ]
                  : []),
              ]
            })()}
          >
            <ModuleView q={air} title="Air quality" height={300}>
              {(env) => (
                <div className="stack-lg">
                  <Notes env={env} />
                  <Takeaway>{airTakeaway(env.data, AQI_WORDS[env.data.scale])}</Takeaway>
                  <AirChart d={env.data} label={labels.air} />
                  <HowTo>
                    <p>
                      <Term id="pm25">PM2.5</Term> is the main particle pollutant. The dashed line
                      is the World Health Organization’s guideline for a 24-hour average. The word
                      above each day is the highest <Term id="aqi">air quality index</Term> reached
                      that day. These are model values for a grid cell, not a measurement at a
                      station.
                    </p>
                  </HowTo>
                  <Curious title="Index bands">
                    <AqiBands d={env.data} />
                  </Curious>
                  <SourceLine env={env} />
                </div>
              )}
            </ModuleView>
          </Chapter>
        </div>
      </div>
    </div>
  )
}

function NotFoundInline() {
  return (
    <div className="stack" style={{ paddingTop: 48 }}>
      <h1>Page not found</h1>
      <p>That address is not a valid city. Search for a city above.</p>
    </div>
  )
}

export { MONTH_FULL }
