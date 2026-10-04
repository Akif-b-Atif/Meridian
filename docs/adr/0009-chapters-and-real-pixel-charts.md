# 0009. Chapters, plain-language takeaways and charts drawn in real pixels

**Status:** accepted (supersedes the "one section per module" layout)

## Context
The first front end was a stack of eleven identical panels in the order the modules were built.
Charts were drawn on a fixed 720-unit canvas and scaled to fit, which shrank labels to about 7 px
on a phone. Several charts named their series only in a legend, none said what they showed, and
technical statistics (tau, b-value, bootstrap intervals) sat next to the headline numbers.

## Decision
- Reorder into ten chapters that follow a story (where, how it began, what is there, then the
  physical data) and give each the same shape: a question, headline numbers, one chart, a computed
  "What this shows" sentence and a "How to read this" fold.
- Draw every chart at the width of its container, so text keeps its pixel size.
- Move technical detail into "For the curious", controlled by a Plain/Detailed switch, and keep the
  dense charts and data tables there.
- Replace charts that did not answer their question (dot strips, six small bar charts, a three-line
  scatter) with range bars, dumbbells and decade dots.
- Add interaction where it explains something: a scroll-driven year dial, a seismic radar with a
  time-lapse, one date shared across charts.

## Alternatives
- **Keep the panels and only restyle:** does not fix the ordering or the missing explanations.
- **A charting library:** faster, but the dial, the radar and the stripes are not stock charts, and
  I wanted full control over labels and keyboard behaviour.
- **Server-written sentences:** would break the unit switch (see ADR 0006), so takeaways are
  computed in the browser from the same numbers.

## Consequences
More front-end code than before, and the layout depends on `IntersectionObserver` for its
scroll-driven parts. Each of those degrades to a static, readable layout without it.
