/** Calculateur de disques pour une charge à la barre. */
import { formatPlates, platesPerSide } from '../../engine'
import { fmtKg } from '../ui'

export function PlateCalc({ load }: { load: number | null }) {
  if (load === null || load <= 0) return null
  const r = platesPerSide(load)
  return (
    <div className="small muted" style={{ marginBottom: 6 }}>
      <span className="accent">{fmtKg(load)}</span> : {formatPlates(r)}
      {r.remainder > 0 && <span className="warn"> · chargeable : {fmtKg(r.achieved)}</span>}
    </div>
  )
}
