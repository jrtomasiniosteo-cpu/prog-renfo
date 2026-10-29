/** Un exercice d'une séance du journal : note + séries éditables. */
import { useEffect, useState } from 'react'
import type { SetRow } from '../../db/schema'
import type { Program } from '../../types/program'
import CompactNum from './CompactNum'
import { fieldsFor } from './helpers'

export type SetPatch = Partial<Pick<SetRow, 'load' | 'reps' | 'rir' | 'measureCm' | 'done'>>

export default function ExerciseBlock({ name, sets, note, program, onSetChange, onNoteChange, onAddSet }: {
  name: string
  sets: SetRow[]
  note: string
  program: Program
  onSetChange: (id: number, patch: SetPatch) => void
  onNoteChange: (note: string) => void
  onAddSet: () => void
}) {
  const [draft, setDraft] = useState(note)
  useEffect(() => { setDraft(note) }, [note])
  const fields = sets[0] ? fieldsFor(sets[0], program) : 'none'

  return (
    <div className="card">
      <h2 style={{ fontSize: 17 }}>{name}</h2>
      {fields === 'none' && <p className="tiny">Rien à saisir ici (voir l'écran Mesures).</p>}
      {fields !== 'none' && sets.map((s, i) => {
        const cols = fields === 'load-reps-rir' ? '24px 1.3fr 1fr 1fr 52px' : '24px 1fr 52px'
        return (
          <div key={s.id} className={'set-row' + (s.done ? ' done' : '')} style={{ gridTemplateColumns: cols, opacity: s.done ? 1 : 0.6 }}>
            <span className="idx">{i + 1}</span>
            {fields === 'load-reps-rir' && <>
              <CompactNum label="kg" decimal value={s.load} onCommit={(v) => onSetChange(s.id!, { load: v })} />
              <CompactNum label="reps" value={s.reps} onCommit={(v) => onSetChange(s.id!, { reps: v })} />
              <CompactNum label="RIR" decimal value={s.rir} onCommit={(v) => onSetChange(s.id!, { rir: v })} />
            </>}
            {fields === 'cm' && <CompactNum label="cm" decimal value={s.measureCm} onCommit={(v) => onSetChange(s.id!, { measureCm: v })} />}
            {fields === 'reps' && <CompactNum label="reps" value={s.reps} onCommit={(v) => onSetChange(s.id!, { reps: v })} />}
            <button
              type="button"
              className={'check' + (s.done ? ' btn-ok' : '')}
              style={{ minWidth: 52, minHeight: 48 }}
              aria-pressed={s.done}
              aria-label={s.done ? 'Série faite' : 'Série non faite'}
              onClick={() => onSetChange(s.id!, { done: !s.done })}
            >{s.done ? '✓' : '○'}</button>
          </div>
        )
      })}
      {fields !== 'none' && (
        <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={onAddSet}>+ série</button>
      )}
      <textarea
        placeholder="Note sur l'exercice (sensations, réglages…)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== note) onNoteChange(draft) }}
        style={{ marginTop: 10, minHeight: 48 }}
      />
    </div>
  )
}
