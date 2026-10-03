# Design system and accessibility

## Intent

The report should feel like a well-made field instrument or a good reference book: calm, precise,
spacious. One element is allowed to be memorable, the Year Clock. Everything else is deliberately
quiet, and structure comes from typography, spacing and alignment rather than boxes and decoration.

## Rules I set for myself

- **No gradients.** Colour scales appear only where they encode data.
- **No pill shapes.** Nothing is fully rounded: no badges, chips, toggles or status dots. Corner
  radius never exceeds 4 px, and states are shown as text, underlines or square marks.
- **No templated look.** No identical grid of shadowed cards, no glass effects, no decorative icons
  or emoji, no tracked all-caps labels over headings, no animation on every section, no component
  kit.
- **Uncluttered.** One primary visualisation per section and a few supporting numbers. Secondary
  detail sits behind a "Data table" disclosure or a method note.

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
- `prefers-reduced-motion` removes the one clock draw-in animation, smooth scrolling and map
  flights.
- Loading and errors are announced (`aria-live`, `role="alert"`), and the waking banner is a
  `status`.
- Skeleton blocks have a fixed height, so content does not shift when data arrives.

The Playwright suite runs axe-core on the landing page and a city page in both themes, and on an
error state, and fails on any serious or critical violation.

## Performance budget

Landing JavaScript under 200 KB gzipped (it is about 94 KB), enforced by
`npm run check:bundle`. The city route and the MapLibre library load on demand. Only the Latin
variable font file ships.
