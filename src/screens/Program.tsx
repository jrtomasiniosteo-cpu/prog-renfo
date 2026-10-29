import { useEffect, useRef, useState } from 'react'
import type { AppState } from '../hooks/useAppState'
import { deloadPrescription, type ProgramWeek } from '../engine'
import type { Block, Macrocycle, MainPrescription, Program } from '../types/program'
import { fmtDate } from '../components/ui'

const SLOT_LABELS: Record<string, string> = {
  LOWER_ACC: 'Bas du corps', ROW: 'Tirage', PRESS: 'Poussée épaules', DIP: 'Dips / triceps',
}
const TEST_LABELS: Record<string, string> = {
  e1rm: 'e1RM', bench_1rm: '1RM bench', cmj: 'CMJ', pullups: 'tractions', body: 'mesures',
}

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`.replace('.', ',')
const short = (d: Date) => fmtDate(d, { day: 'numeric', month: 'short' })

function mainLine(program: Program, block: Block, deload: boolean): string {
  return Object.entries(block.main).map(([id, raw]) => {
    const p: MainPrescription = deload ? deloadPrescription(raw) : raw
    const name = program.exercises[id]?.name ?? id
    const base = `${name} ${p.sets}×${p.reps} @${pct(p.pct)}`
    return p.top ? `${name} 1 @RPE ${p.top.rpe} + ${p.sets}×${p.reps} @${pct(p.pct)}` : base
  }).join(' · ')
}

function plyoLine(block: Block, deload: boolean): string {
  return block.plyo.map((p) => `${p.name} ${deload ? Math.ceil(p.sets / 2) : p.sets}×${p.reps}`).join(' · ')
}

function rulesText(m: Macrocycle): string[] {
  const r = m.rules
  if (!r) return []
  const out: string[] = []
  if (r.sessions) out.push(`Séances ${r.sessions.join(' et ')} seulement${r.dropSession ? ` (séance ${r.dropSession} supprimée)` : ''}.`)
  if (r.mainSetsMax !== undefined) out.push(`${r.mainSetsMax} séries maximum sur les lifts principaux.`)
  if (r.accessorySets !== undefined) out.push(`${r.accessorySets} séries par accessoire.`)
  if (r.plyoContactsMax !== undefined) out.push(`Pliométrie : ${r.plyoContactsMax} contacts maximum.`)
  if (r.singleSessionWeek) out.push(`Semaine à une seule séance : ${r.singleSessionWeek}.`)
  return out
}

function MacroCard({ program, macro, weeks, open, onToggle, currentIndex, currentRef }: {
  program: Program; macro: Macrocycle; weeks: ProgramWeek[]; open: boolean; onToggle: () => void
  currentIndex: number | null; currentRef: React.RefObject<HTMLTableRowElement | null>
}) {
  const first = weeks[0], last = weeks[weeks.length - 1]
  const slots = program.slots[macro.slots] ?? {}
  const rules = rulesText(macro)
  return (
    <div className="card">
      <button type="button" className="btn-ghost btn-block" style={{ justifyContent: 'space-between' }} onClick={onToggle} aria-expanded={open}>
        <span style={{ textAlign: 'left' }}>
          <strong>{macro.name}</strong>
          <span className="tiny" style={{ display: 'block' }}>
            {first ? `${short(first.start)} → ${short(last.end)}` : ''} · {macro.weeks} sem.
          </span>
        </span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {macro.goal && <p className="accent">Objectif : {macro.goal}</p>}
          {rules.length > 0 && (
            <div className="banner info">
              <strong>Règles de ce macrocycle</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rules.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          <p className="small muted">
            {Object.entries(slots).map(([k, id]) => `${SLOT_LABELS[k] ?? k} : ${program.exercises[id]?.name ?? id}`).join(' · ')}
          </p>
          {macro.blocks.map((b) => {
            const bw = weeks.filter((w) => w.block.id === b.id)
            return (
              <div key={b.id} style={{ marginTop: 12 }}>
                <h3>{b.id} · {b.name} <span className="tiny">
                  {bw.length ? `sem. ${b.weeks[0]}–${b.weeks[1]} · ${short(bw[0].start)} → ${short(bw[bw.length - 1].end)}` : ''}
                </span></h3>
                <table className="tbl">
                  <tbody>
                    {bw.map((w) => (
                      <tr key={w.key} className={w.index === currentIndex ? 'current' : ''} ref={w.index === currentIndex ? currentRef : undefined}>
                        <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          <strong>S{w.weekInMacro}</strong>
                          <div className="tiny">{short(w.start)} → {short(w.end)}</div>
                        </td>
                        <td>
                          <div className="row wrap" style={{ gap: 4, marginBottom: 2 }}>
                            {w.isDeload && <span className="chip warn">allégée</span>}
                            {w.tests.length > 0 && <span className="chip accent">tests : {w.tests.map((t) => TEST_LABELS[t] ?? t).join(', ')}</span>}
                          </div>
                          <div className="small">{mainLine(program, w.block, w.isDeload)}</div>
                          <div className="tiny">Plio : {plyoLine(w.block, w.isDeload)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProgramScreen({ state }: { state: AppState }) {
  const { program, weeks, currentWeek } = state
  const [open, setOpen] = useState<Record<number, boolean>>(() => ({ [currentWeek?.macroIndex ?? 0]: true }))
  const currentRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div className="screen">
      <h1>Programme</h1>
      {program.macrocycles.map((macro, i) => (
        <MacroCard
          key={macro.id}
          program={program}
          macro={macro}
          weeks={weeks.filter((w) => w.macroIndex === i)}
          open={!!open[i]}
          onToggle={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
          currentIndex={currentWeek?.index ?? null}
          currentRef={currentRef}
        />
      ))}
    </div>
  )
}
