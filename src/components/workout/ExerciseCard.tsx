/** Carte d'un exercice en séance : prescription, disques, séries, alerte plio, note. */
import { addSet } from '../../db/logic'
import { db, type SetRow as SetRowData } from '../../db/schema'
import { plyoShouldStop } from '../../engine'
import { Banner, fmtNum } from '../ui'
import { Link } from '../../router'
import { KIND_LABEL, prescriptionLine, loadStep, type ExerciseMeta } from './helpers'
import { PlateCalc } from './PlateCalc'
import { SetRow, type SetFields } from './SetRow'

function fieldsFor(meta: ExerciseMeta): SetFields {
  const cmLabel = meta.measure === 'box_cm' ? 'Box cm' : meta.measure === 'cm' ? 'CMJ cm' : null
  if (meta.kind === 'plyo') return { loadStep: null, reps: true, rir: false, cmLabel }
  if (meta.testKind === 'cmj') return { loadStep: null, reps: false, rir: false, cmLabel: cmLabel ?? 'CMJ cm' }
  if (meta.testKind === 'pullups') return { loadStep: null, reps: true, rir: false, cmLabel: null }
  return { loadStep: loadStep(meta), reps: true, rir: true, cmLabel: null }
}

/** Plio : dernière série faite < 95 % du meilleur des précédentes → arrêter. */
function plyoStatus(rows: SetRowData[]): { best: number | null; stop: boolean } {
  const done = rows.filter((r) => r.done && r.measureCm !== null && r.measureCm > 0)
  if (!done.length) return { best: null, stop: false }
  const best = Math.max(...done.map((r) => r.measureCm as number))
  const last = done[done.length - 1]
  const prev = done.slice(0, -1).map((r) => r.measureCm as number)
  const bestPrev = prev.length ? Math.max(...prev) : null
  return { best, stop: plyoShouldStop(bestPrev, last.measureCm as number) }
}

async function saveNote(sessionId: number, exerciseKey: string, note: string): Promise<void> {
  const ex = await db.exerciseNotes.where('[sessionId+exerciseKey]').equals([sessionId, exerciseKey]).first()
  if (ex) { if (ex.note !== note) await db.exerciseNotes.update(ex.id!, { note }) }
  else if (note.trim()) await db.exerciseNotes.add({ sessionId, exerciseKey, note })
}

export function ExerciseCard({ sessionId, meta, rows, note, onSetDone }: {
  sessionId: number
  meta: ExerciseMeta
  rows: SetRowData[]
  note: string
  /** appelé au passage done: false → true */
  onSetDone: (meta: ExerciseMeta, row: SetRowData) => void
}) {
  const fields = fieldsFor(meta)
  const isBarbellLift = meta.loadKind === 'barbell'
    && (meta.kind === 'main' || meta.testKind === 'e1rm' || meta.testKind === 'bench_1rm')
  const nextRow = rows.find((r) => !r.done)
  const hasCm = fields.cmLabel !== null
  const plyo = hasCm ? plyoStatus(rows) : { best: null, stop: false }
  const doneCount = rows.filter((r) => r.done).length

  const toggle = (row: SetRowData) => {
    const done = !row.done
    void db.sets.update(row.id!, { done })
    if (done) onSetDone(meta, row)
  }

  return (
    <section className="card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h2 className="grow" style={{ marginBottom: 4 }}>{meta.name}</h2>
        <span className={`chip${meta.kind === 'main' ? ' accent' : ''}`}>{KIND_LABEL[meta.kind]}</span>
      </div>
      <p className="small muted" style={{ marginBottom: 4 }}>
        {prescriptionLine(meta, rows)}
        {rows.length > 0 && <span className="tiny"> · {doneCount}/{rows.length}</span>}
      </p>
      {meta.progressionName && <p className="small">Variante : <strong>{meta.progressionName}</strong></p>}
      {meta.supersetName && <p className="small accent">Superset avec {meta.supersetName}</p>}
      {meta.note && <p className="small muted">{meta.note}</p>}
      {meta.protocol && <p className="small muted" style={{ fontStyle: 'italic' }}>{meta.protocol}</p>}
      {meta.testKind === 'body' && <p><Link to="/mesures" className="btn btn-sm">Saisir les mesures →</Link></p>}

      {isBarbellLift && nextRow && <PlateCalc load={nextRow.load} />}

      {rows.map((r) => (
        <SetRow key={r.id} row={r} fields={fields} topRpe={meta.topRpe} onToggle={toggle} />
      ))}

      {hasCm && plyo.best !== null && (
        <p className="tiny" style={{ marginTop: 6 }}>Meilleur du jour : {fmtNum(plyo.best)} cm</p>
      )}
      {plyo.stop && <Banner kind="danger"><strong>Arrête l'exercice</strong> — baisse de plus de 5 % par rapport à ta meilleure série.</Banner>}

      {rows.length > 0 && (
        <button type="button" className="btn-ghost btn-block btn-sm" style={{ marginTop: 8 }}
          onClick={() => { void addSet(sessionId, meta.key) }}>+ série</button>
      )}

      <textarea
        defaultValue={note}
        placeholder="Note sur l'exercice"
        style={{ marginTop: 8, minHeight: 48 }}
        onBlur={(e) => { void saveNote(sessionId, meta.key, e.target.value) }}
      />
    </section>
  )
}
