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
import { Air } from '../charts/Air'
import { Climograph } from '../charts/Climograph'
import { Daylight } from '../charts/Daylight'
import { Extremes } from '../charts/Extremes'
import { GutenbergRichter, PerYear, Scatter, Tables } from '../charts/Seismic'
import { SeasonStrips } from '../charts/SeasonStrips'
import { Stripes, TrendPlot } from '../charts/Warming'
import { Water } from '../charts/Water'
import { YearClock } from '../charts/YearClock'
import { MapSection } from '../components/MapSection'
import { HistoryView, NormalsText, PlacesView } from '../components/Sections2'
import { ModuleView, Notes, Panel, SourceLine } from '../components/Section'
import {
  LAG_DISAGREE,
  WEAK_CYCLE,
  chartLabels,
  coldLag,
  doyOfDate,
  heatwaveSentence,
  localTime,
  noQuakes,
  population,
  radiusLabel,
  seismicSummary,
  trendSentence,
  warmLag,
} from '../copy'
import { slugify } from '../copy/slug'
import { usePrefs } from '../state/preferences'
import { dist, n0, delta } from '../units'

const RADII = [100, 300, 500] as const
const NAV = [
  ['location', 'Location'],
  ['seasons', 'Seasons'],
  ['normals', 'Normals'],
  ['warming', 'Warming'],
  ['extremes', 'Extremes'],
  ['daylight', 'Daylight'],
  ['earthquakes', 'Earthquakes'],
  ['air', 'Air'],
  ['water', 'Water'],
  ['places', 'Places'],
  ['history', 'History'],
] as const

function todayDoy(tz: string): number {
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date())
    const m = Number(p.find((x) => x.type === 'month')?.value)
    const d = Number(p.find((x) => x.type === 'day')?.value)
    return doyOfDate(m, d)
  } catch {
    return 172
  }
}

export function City() {
  const { geonameId = '', slug = '' } = useParams()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { units, resolvedTheme } = usePrefs()
  const valid = /^\d{1,10}$/.test(geonameId)
  const id = valid ? geonameId : null
  const radius = RADII.find((r) => String(r) === sp.get('r')) ?? 300

  const base = id ? `/api/cities/${id}` : null
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
  const boundarySettled = !!boundary.result && !boundary.isFetching
  const places = useModule<PlacesData>('places', sub('places'), ready && boundarySettled)

  const [day, setDay] = useState(172)
  const [clockAnim, setClockAnim] = useState(true)
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number } | null>(null)
  const [layersReq, setLayersReq] = useState(0)
  const [, tick] = useState(0)

  const reduce =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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
  useEffect(() => {
    if (!idData) return
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [idData])

  const labels = useMemo(
    () =>
      chartLabels(
        idData?.name ?? '',
        climate.result?.kind === 'ok' ? climate.result.envelope.data?.dataWindow.end : undefined,
      ),
    [idData, climate.result],
  )
  const cEnv = climate.result?.kind === 'ok' ? climate.result.envelope : null
  const sEnv = solar.result?.kind === 'ok' ? solar.result.envelope : null
  const cData = cEnv?.data ?? null

  if (!valid) return <NotFoundInline />

  return (
    <div>
      <ModuleView q={ident} title="Location" height={160}>
        {(env) => {
          const d = env.data
          return (
            <div className="head-grid">
              <div className="stack">
                <h1>{d.name}</h1>
                <p className="mute" style={{ fontSize: 18 }}>
                  {[d.admin1, d.country].filter(Boolean).join(', ')}
                </p>
                <p>
                  {d.lat.toFixed(4)}°, {d.lon.toFixed(4)}°
                  {d.elevationM !== null && ` · elevation ${n0(d.elevationM)} m`}
                </p>
                <p>
                  {[
                    d.population ? population(d.population) : null,
                    d.areaKm2 ? `area ${n0(d.areaKm2)} km²` : null,
                    d.densityPerKm2 ? `${n0(d.densityPerKm2)} per km²` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p>
                  {localTime(d.timezone)} · {d.timezone}
                </p>
                <Notes env={env} />
                {cData &&
                  cData.cycle.mode === 'ok' &&
                  cData.cycle.peakDoy !== null &&
                  cData.cycle.peakLagDays !== null &&
                  cData.cycle.peakLagCi && (
                    <p>
                      {warmLag(
                        cData.cycle.peakDoy,
                        cData.cycle.peakLagDays,
                        cData.cycle.peakLagCi,
                        cData.hemisphere,
                      )}
                    </p>
                  )}
                {cData &&
                  cData.cycle.mode === 'ok' &&
                  cData.cycle.troughDoy !== null &&
                  cData.cycle.troughLagDays !== null && (
                    <p>
                      {coldLag(cData.cycle.troughDoy, cData.cycle.troughLagDays, cData.hemisphere)}
                    </p>
                  )}
                {cData && cData.cycle.mode === 'weak' && <p>{WEAK_CYCLE}</p>}
                {cData?.cycle.lagCheck === 'disagree' && <p className="note">{LAG_DISAGREE}</p>}
                <p className="note">
                  Drag or use the arrow keys on the clock to move through the year.
                </p>
              </div>
              <div style={{ maxWidth: 360, width: '100%' }}>
                <YearClock
                  city={d.name}
                  label={labels.clock}
                  climate={cData}
                  solar={sEnv?.data ?? null}
                  hemisphere={d.lat < 0 ? 'S' : 'N'}
                  day={day}
                  onDay={setDay}
                  units={units}
                  animate={clockAnim && !reduce}
                />
              </div>
            </div>
          )
        }}
      </ModuleView>

      {idData && (
        <>
          <nav aria-label="Sections" className="section-nav">
            {NAV.map(([a, t]) => (
              <a key={a} href={`#${a}`}>
                {t}
              </a>
            ))}
          </nav>

          <Panel id="location" title="Location">
            <MapSection
              ident={idData}
              boundary={boundary.result?.kind === 'ok' ? boundary.result.envelope : null}
              places={places.result?.kind === 'ok' ? places.result.envelope : null}
              seismic={seismic.result?.kind === 'ok' ? seismic.result.envelope : null}
              water={water.result?.kind === 'ok' ? water.result.envelope : null}
              focus={focus}
              layersRequest={layersReq}
            />
          </Panel>

          <Panel id="seasons" title="Seasons">
            <ModuleView q={climate} title="Seasons" height={260}>
              {(env) => (
                <>
                  <Notes env={env} />
                  {env.data.seasonMode === 'wetdry' && (
                    <p>
                      Temperature barely changes through the year here (annual range under 3
                      {'\u00a0'}°C), so the seasons follow rainfall.
                    </p>
                  )}
                  <SeasonStrips d={env.data} units={units} label={labels.seasons} />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="normals" title="Climate normals">
            <ModuleView q={climate} title="Climate normals" height={360}>
              {(env) => (
                <>
                  <Climograph d={env.data} units={units} label={labels.normals} />
                  <NormalsText d={env.data} units={units} />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="warming" title="Warming">
            <ModuleView q={climate} title="Warming" height={410}>
              {(env) => {
                const t = env.data.trend.annual
                return (
                  <>
                    <Stripes
                      d={env.data}
                      units={units}
                      theme={resolvedTheme}
                      label={labels.stripes}
                    />
                    {t ? (
                      <>
                        <TrendPlot d={env.data} units={units} label={labels.trend} />
                        <p>{trendSentence(t, units)}</p>
                        <p className="note">
                          Annual values are autocorrelated, so the p-value is optimistic.
                        </p>
                        <div
                          className="scroll-x"
                          tabIndex={0}
                          role="region"
                          aria-label="Seasonal trends"
                        >
                          <table>
                            <caption>Seasonal trends</caption>
                            <thead>
                              <tr>
                                <th scope="col">Season</th>
                                <th scope="col">Change per decade</th>
                                <th scope="col">Significant</th>
                              </tr>
                            </thead>
                            <tbody>
                              {env.data.trend.seasons.map((s) => (
                                <tr key={s.season}>
                                  <th scope="row">{s.season}</th>
                                  <td>{s.trend ? delta(s.trend.perDecade, units) : '–'}</td>
                                  <td>{s.trend ? (s.trend.significant ? 'yes' : 'no') : '–'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p>Trend information is not available for this place.</p>
                    )}
                    <SourceLine env={env} />
                  </>
                )
              }}
            </ModuleView>
          </Panel>

          <Panel id="extremes" title="Extremes">
            <ModuleView q={climate} title="Extremes" height={560}>
              {(env) => (
                <>
                  <Extremes d={env.data} units={units} />
                  <p>
                    {heatwaveSentence(
                      env.data.extremes.heatwave.first15,
                      env.data.extremes.heatwave.last15,
                    )}
                  </p>
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="daylight" title="Daylight">
            <ModuleView q={solar} title="Daylight" height={260}>
              {(env) => <Daylight d={env.data} day={day} onDay={setDay} label={labels.daylight} />}
            </ModuleView>
          </Panel>

          <Panel id="earthquakes" title="Earthquakes">
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
                  style={{ minHeight: 44 }}
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
            <ModuleView q={seismic} title="Earthquake" height={300}>
              {(env) => {
                const d = env.data
                return (
                  <>
                    <Notes env={env} only={['seismic_partial', 'seismic_truncated']} />
                    {d.n === 0 ? (
                      <p>{noQuakes(d.radiusKm, d.start, units)}</p>
                    ) : (
                      <>
                        <p>{seismicSummary(d, units)}</p>
                        <Scatter d={d} units={units} label={labels.quakes} />
                        <div className="grid-2">
                          <PerYear d={d} />
                          <GutenbergRichter d={d} />
                        </div>
                        <Tables d={d} units={units} />
                        <p className="note">
                          Catalogue completeness varies by region and era; results concern the
                          chosen radius ({dist(d.radiusKm, units)}), not local fault geometry.
                        </p>
                      </>
                    )}
                    <SourceLine env={env} />
                  </>
                )
              }}
            </ModuleView>
          </Panel>

          <Panel id="air" title="Air quality">
            <ModuleView q={air} title="Air quality" height={260}>
              {(env) => (
                <>
                  <Notes env={env} />
                  <Air d={env.data} label={labels.air} />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="water" title="Water">
            <ModuleView q={water} title="Water" height={200}>
              {(env) => (
                <>
                  <Water d={env.data} units={units} label={labels.water} city={idData.name} />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="places" title="Places">
            <ModuleView q={places} title="Places" height={300}>
              {(env) => (
                <>
                  <Notes env={env} />
                  <PlacesView
                    d={env.data}
                    units={units}
                    onShow={(p) => {
                      setLayersReq((n) => n + 1)
                      setFocus({ lat: p.lat, lon: p.lon, n: Date.now() })
                      document
                        .getElementById('location')
                        ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
                    }}
                  />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>

          <Panel id="history" title="History">
            <ModuleView q={history} title="History" height={200}>
              {(env) => (
                <>
                  <Notes env={env} only={['wikidata_missing', 'country_facts_failed']} />
                  <HistoryView d={env.data} />
                  <SourceLine env={env} />
                </>
              )}
            </ModuleView>
          </Panel>
        </>
      )}
    </div>
  )
}

function NotFoundInline() {
  return (
    <div className="stack" style={{ paddingTop: 32 }}>
      <h1>Page not found</h1>
      <p>That address is not a valid city. Search for a city above.</p>
    </div>
  )
}
