import type { ClimateData } from '../api/types'
import { koppenName, koppenPlain } from '../copy/takeaways'
import { temp, type Units } from '../units'
import { Term } from './Term'

/** The climate type spelled out letter by letter, so the code means something. */
export function KoppenBlock({ d, units }: { d: ClimateData; units: Units }) {
  const k = d.koppen
  return (
    <div className="stack">
      <h3>
        Climate type: <Term id="koppen">{k.code}</Term>, {koppenName(k.code).toLowerCase()}
      </h3>
      <div className="kop">
        {koppenPlain(k.code).map((x) => (
          <div key={x.letter + x.meaning}>
            <span className="letter" aria-hidden="true">
              {x.letter}
            </span>
            <span>
              <span className="sr-only">Letter {x.letter}: </span>
              {x.meaning}
            </span>
          </div>
        ))}
      </div>
      <p className="note">
        Worked out from the average of each month, {d.dataWindow.normalsStart} to {d.dataWindow.end}
        . The warmest month averages {temp(k.thot, units)} and the coldest {temp(k.tcold, units)}.
      </p>
    </div>
  )
}
