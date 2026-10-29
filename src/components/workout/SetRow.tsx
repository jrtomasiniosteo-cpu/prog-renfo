/** Une série : champs pré-remplis avec la cible, bouton ✓ pour valider tel quel. */
import type { CSSProperties } from 'react'
import { db, type SetRow as SetRowData } from '../../db/schema'
import { NumField, fmtNum } from '../ui'

export interface SetFields {
  /** pas du champ charge, null = pas de champ */
  loadStep: number | null
  reps: boolean
  rir: boolean
  /** libellé du champ cm, null = pas de champ */
  cmLabel: string | null
}

type Cell = 'load' | 'reps' | 'rir' | 'cm'

/**
 * Mise en page tenue d'une main sur 375 px : trois champs ne tiennent pas sur une ligne,
 * donc charge pleine largeur en haut, reps + RIR dessous, ✓ haut sur deux lignes à droite.
 */
function rowLayout(f: SetFields) {
  const cells: Cell[] = []
  if (f.loadStep !== null) cells.push('load')
  if (f.reps) cells.push('reps')
  if (f.rir) cells.push('rir')
  if (f.cmLabel) cells.push('cm')
  const n = Math.max(cells.length, 1)
  if (n <= 2) {
    return {
      grid: { gridTemplateColumns: `28px repeat(${n}, minmax(0, 1fr)) 56px` } as CSSProperties,
      idx: {} as CSSProperties,
      cell: (_c: Cell): CSSProperties => ({ minWidth: 0 }),
      check: {} as CSSProperties,
    }
  }
  // 3 champs ou plus : première cellule sur toute la largeur, les autres dessous par deux
  const pos = new Map<Cell, CSSProperties>()
  cells.forEach((c, i) => {
    if (i === 0) pos.set(c, { gridColumn: '2 / 4', gridRow: 1, minWidth: 0 })
    else pos.set(c, { gridColumn: 2 + ((i - 1) % 2), gridRow: 2 + Math.floor((i - 1) / 2), minWidth: 0 })
  })
  const rows = 1 + Math.ceil((cells.length - 1) / 2)
  return {
    grid: { gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1fr) 56px', rowGap: 6 } as CSSProperties,
    idx: { gridColumn: 1, gridRow: `1 / ${rows + 1}`, alignSelf: 'center', paddingBottom: 0 } as CSSProperties,
    cell: (c: Cell): CSSProperties => pos.get(c) ?? {},
    check: { gridColumn: 4, gridRow: `1 / ${rows + 1}`, alignSelf: 'stretch', height: 'auto' } as CSSProperties,
  }
}

export function SetRow({ row, fields, topRpe, onToggle, readOnly }: {
  row: SetRowData
  fields: SetFields
  topRpe?: number
  onToggle: (row: SetRowData) => void
  readOnly?: boolean
}) {
  const id = row.id!
  const set = (patch: Partial<SetRowData>) => { void db.sets.update(id, patch) }
  const layout = rowLayout(fields)

  return (
    <>
      {row.isTop && (
        <div style={{ paddingTop: 8 }}>
          <span className="chip accent">Top{topRpe !== undefined ? ` @ RPE ${fmtNum(topRpe)}` : ' @ RPE'}</span>
        </div>
      )}
      <div className={`set-row${row.done ? ' done' : ''}`} style={layout.grid}>
        <span className="idx" style={layout.idx}>{row.isTop ? 'T' : row.setIndex + 1}</span>
        {fields.loadStep !== null && (
          <div style={layout.cell('load')}>
            <NumField label="kg" value={row.load} step={fields.loadStep} onChange={(v) => set({ load: v })} inputMode="decimal" />
          </div>
        )}
        {fields.reps && (
          <div style={layout.cell('reps')}>
            <NumField label="reps" value={row.reps} step={1} onChange={(v) => set({ reps: v })} />
          </div>
        )}
        {fields.rir && (
          <div style={layout.cell('rir')}>
            <NumField label="RIR" value={row.rir} step={1} min={0} max={5} onChange={(v) => set({ rir: v })} />
          </div>
        )}
        {fields.cmLabel && (
          <div style={layout.cell('cm')}>
            <NumField label={fields.cmLabel} value={row.measureCm} step={1} onChange={(v) => set({ measureCm: v })} inputMode="decimal" />
          </div>
        )}
        <button
          type="button"
          className={`check ${row.done ? 'btn-ok' : ''}`}
          style={layout.check}
          aria-label={row.done ? 'Annuler la validation' : 'Valider la série'}
          aria-pressed={row.done}
          disabled={readOnly}
          onClick={() => onToggle(row)}
        >✓</button>
      </div>
    </>
  )
}
