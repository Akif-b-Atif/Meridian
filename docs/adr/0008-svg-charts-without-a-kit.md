# 0008. Hand-built SVG charts and no component kit

**Status:** accepted

## Context
The signature visualisation, a radial year clock, and the warming stripes are not available in
off-the-shelf chart libraries, and a component kit would give the template look I wanted to avoid.

## Decision
Use d3's scale, shape and array modules to compute geometry and let React render the SVG. No d3
code touches the DOM. Every chart has a focusable group, a live readout and a data table.

## Consequences
More code than a charting library, but full control over contrast, direct labelling, keyboard
behaviour and the unit switch, and the landing bundle stays around 100 KB gzipped.
