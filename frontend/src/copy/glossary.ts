// Short plain-language definitions shown in popovers. Keep each to one or two sentences.
export const GLOSSARY: Record<string, string> = {
  era5: 'A global weather record rebuilt from decades of satellite, balloon and station readings by the European Copernicus service. It is a smooth grid, so it describes the area around a city rather than one thermometer.',
  reanalysis:
    'Past weather rebuilt by feeding old observations into a modern forecasting model, which fills the gaps between stations.',
  solstice:
    'The two days a year when the sun is at its highest (longest day) or lowest (shortest day) in the sky. In the north these fall around 21 June and 21 December.',
  koppen:
    'A widely used way of sorting the world’s climates into types, using only monthly temperature and rainfall. Each letter in the code stands for one feature.',
  anomaly:
    'How far a value is from a reference average. Here the reference is the average of 1961 to 1990, so +1 °C means one degree warmer than that period.',
  heatwave:
    'At least three days in a row hotter than 90% of the days that normally occur at that time of year in this place.',
  percentile:
    'The 90th percentile is the value that 90% of readings fall below, so only the hottest one in ten days is above it.',
  magnitude:
    'A measure of an earthquake’s size. Each whole step up is about 32 times more energy released, so a magnitude 6 is far stronger than a 5.',
  bvalue:
    'The balance between small and large earthquakes in a region. A value near 1 is typical: roughly ten times as many quakes for each magnitude step down.',
  continentality:
    'How strongly a place’s temperature swings between summer and winter. Places far from the sea tend to swing more; places near it less.',
  aqi: 'An air quality index: a single number that rolls pollutant levels into a scale from good to hazardous. Europe and the US use different scales.',
  pm25: 'Tiny airborne particles, under 2.5 micrometres across, small enough to reach deep into the lungs. Measured in micrograms per cubic metre.',
  tau: 'A number from −1 to +1 that says how consistently values rise or fall over time. Near +1 means they nearly always rose.',
  bootstrap:
    'Re-running a calculation many times on randomly re-drawn years to see how much the answer would wobble. It gives the “range” shown next to the lag.',
  theilsen:
    'A trend line that takes the median of all the slopes between pairs of years, so one odd year barely moves it.',
  geonames: 'An open database of places. Every city here is identified by its GeoNames number.',
}
