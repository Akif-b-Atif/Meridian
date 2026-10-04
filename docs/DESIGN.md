# Design system and accessibility

## Intent

The report should feel like a well-made field instrument or a good reference book: calm, precise,
spacious. The visual language is restrained; the personality comes from how the page behaves. It is
meant to be readable by someone who has never seen a climograph, without being dull.

## Rules I set for myself

- **No gradients.** Colour scales appear only where they encode data.
- **No pill shapes.** Nothing is fully rounded: no badges, chips, toggles or status dots. Corner
  radius never exceeds 4 px, and states are shown as text, underlines or square marks.
- **No templated look.** No identical grid of shadowed cards, no glass effects, no decorative icons
  or emoji, no tracked all-caps labels over headings, no animation on every section, no component
  kit.
- **Uncluttered.** One primary visualisation per section and a few supporting numbers. Secondary
  detail sits behind a "Data table" disclosure or a method note.

## Reading model

Every chart has to answer three questions for a newcomer before it is allowed on the page: *what
am I looking at*, *how do I read it*, and *what is it telling me*.

- **Chapters, not panels.** Ten chapters in a story order: where it is, how it began, what is
  there, the year, typical weather, daylight, extremes, warming, earthquakes, air. Place and
  history come first because they orient you; the data chapters follow.
- **Same shape every time.** A question in plain words, two or three headline numbers, one chart,
  then a **What this shows** sentence computed from the data, then a **How to read this** fold.
- **Plain and Detailed.** Method notes (Köppen rules, Kendall tau, b-value, bootstrap) sit in a
  "For the curious" fold. Plain keeps it closed; Detailed opens it. The choice is stored locally.
- **Glossary popovers.** Terms such as *anomaly*, *solstice*, *magnitude* and *heatwave* are dotted
  words that open a one- or two-sentence definition (keyboard and touch friendly, Escape closes).
- **Direct labels.** Charts name their own parts ("Warmest: 18.0", "Longest: Jun 21, 16:38")
  instead of sending you to a legend, and where a legend is needed it sits above the chart.
- **Charts draw in real pixels.** Each chart measures its container and draws at that width, so a
  14 px label is 14 px on a phone. (An earlier version scaled a fixed 720-unit canvas down, which
  shrank labels to about 7 px on small screens.)

## Chart choices

| Question | Chart | Why this and not another |
| --- | --- | --- |
| How does temperature and daylight run through the year? | Radial year dial | The year is a cycle, so a circle shows that December meets January |
| What are the seasons like? | Floating range bars | A bar from the typical low to the typical high on one shared axis beats scattered dots |
| What is the weather month by month? | Climograph with a highlighted month | The classic form, with the axes named in the colour of their series |
| How much has it warmed? | Warming stripes plus decade dots with the change spelled out | Stripes show the pattern; the decade dots give the number |
| Are extremes changing? | Dumbbells, earlier half against later half | The question is "before versus after", so show exactly two dots per measure |
| How restless is the ground? | Seismic radar with a time-lapse | Distance and direction from the city are what a reader cares about, and time can be played |
| How far is the water? | Compass dials | Distance and direction together, no axis to decode |
| Is the air clean? | Hourly line against the WHO guideline | A reference line turns a number into a judgement |

The dense versions (every year as a bar, the trend scatter, the magnitude-frequency plot) still
exist, inside "For the curious", and every chart keeps a data table behind a "Data table" fold.

## Interaction and techniques

- **Scroll-driven year dial.** The dial stays pinned while four steps of text scroll past; an
  `IntersectionObserver` decides which layers (temperature, daylight, lag arcs) are shown, with
  opacity transitions. Without the observer, or for anyone who ignores the text, the dial still
  works as a slider on its own.
- **The meridian.** A progress line down the left side (a bar under the header on phones) fills
  as you read; its ticks are square and link to each chapter. `j` and `k` move between chapters
  and `/` focuses the search.
- **One shared date.** Scrubbing the dial sets a day that the climograph (highlighted month), the
  season bars and the daylight curve all follow.
- **Seismic radar.** A canvas drawing earthquakes at their real bearing and distance
  (great-circle formulas in `src/lib/geo.ts`), with a time-lapse driven by `requestAnimationFrame`,
  pulses for new large events, and a range slider that works from the keyboard. Pulses are skipped
  under reduced motion.
- **Globe map.** The map opens as a globe and flies to the city once its boundary is known.
- **Right now.** The hero works out from the city's longitude whether the sun is up there. It
  ignores the equation of time, so it can be off by up to about a quarter of an hour.
- **Count-up numbers** start when they scroll into view and show their final value at once under
  reduced motion or without `IntersectionObserver`.

All of it is hand-written React and SVG or canvas. No animation library and no chart library are
used.

## Type and colour

One typeface, Source Sans 3 (variable), self-hosted and subset to Latin, with tabular figures for
numbers. Sizes: 14 (captions and axes), 16 (body), 18 (lead), 22 (section titles), 28 and 36
(page title). Colours are CSS custom properties with one value set per theme, so no component
hard-codes a colour.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ground` | `#F2F3F5` | `#14171B` | Page background |
| `--ink` | `#171A1F` | `#E6E8EB` | Text |
| `--mute` | `#566070` | `#9AA3AF` | Secondary text and axes |
| `--accent` | `#25447A` | `#8FB0E8` | Links, focus ring, pointer |
| `--edge` | `#7A8494` | `#626B78` | Borders, gridlines |
| `--series-a` | `#A5432C` | `#EE9C7A` | First data series (temperature) |
| `--series-b` | `#4C6E91` | `#9CBBDD` | Second data series (daylight, rain) |

Contrast ratios against the theme's own ground, computed from the hex values with the WCAG
relative-luminance formula:

| Pair | Light | Dark | Needed |
| --- | --- | --- | --- |
| ink | 15.71 | 14.64 | 4.5 |
| mute | 5.73 | 7.05 | 4.5 |
| accent | 8.65 | 8.17 | 4.5 |
| edge (borders, gridlines) | 3.40 | 3.33 | 3 |
| series-a | 5.50 | 8.28 | 3 |
| series-b | 4.79 | 9.05 | 3 |

The two series colours are close in lightness (ratio 1.15 light, 1.09 dark), so the charts never
rely on colour alone to tell them apart: series also differ by line style, position and a direct
label.

The anomaly scale (warming stripes) is a nine-stop diverging scale from steel through a neutral to
ochre and brick, with a separately tuned dark version. It is mapped onto a symmetric range, and
every value is also available as text.

## Themes

Both themes ship and neither is an inversion of the other. The initial theme follows
`prefers-color-scheme`; an explicit choice (light, dark, or back to automatic) is stored in
`localStorage` and wins. A small external script, `public/theme-init.js`, sets the theme before
first paint so the page never flashes. It is a file rather than inline code because the
Content-Security-Policy forbids inline scripts.

## Accessibility

The target is WCAG 2.2 AA.

- A skip link, landmarks, one `h1`, and `h2` section titles.
- Everything works from the keyboard. The Year Clock is a `slider` (arrows move a day, Page Up and
  Page Down a month, Home and End the ends). Charts with a readout are focusable and step through
  their values with the arrow keys. The search is an ARIA combobox.
- Every chart has a text alternative: a live readout line and a real data table behind a
  "Data table" disclosure.
- Visible focus on every control (2 px outline with an offset) and 44 px minimum touch targets.
- `prefers-reduced-motion` removes the clock draw-in, smooth scrolling, the map's fly-in, the radar
  pulses and the count-up.
- Loading and errors are announced (`aria-live`, `role="alert"`), and the waking banner is a
  `status`.
- Skeleton blocks have a fixed height, so content does not shift when data arrives.
- Body text is 17 px, chart text never drops below 13 px, and only the map's own controls are smaller.
- Nothing relies on colour alone: the radar's recent quakes also get a thicker outline, and the
  activity meter is filled squares with a text label.

The Playwright suite runs axe-core on the landing page and a city page in both themes, and on an
error state, and fails on any serious or critical violation.

## Performance budget

Landing JavaScript under 200 KB gzipped (it is about 98 KB), enforced by
`npm run check:bundle`. The city route and the MapLibre library load on demand. Only the Latin
variable font file ships.
