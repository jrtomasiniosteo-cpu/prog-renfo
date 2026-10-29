/** Résumé de fin de séance : volume, nouvelles charges, records. */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SessionRow, type SetRow } from '../../db/schema'
import {
  directSetsByMuscle, e1rm, nextAccessoryTarget, tonnage,
  type AccessoryHistory, type DoneSet, type ProgramWeek,
} from '../../engine'
import type { AccessoryExercise, Program } from '../../types/program'
import { fmtDate, fmtKg, fmtNum } from '../ui'
import { navigate } from '../../router'

const isRefRow = (r: SetRow) =>
  (r.kind === 'main' && (r.exerciseId === 'squat' || r.exerciseId === 'bench_heavy'))
  || (r.kind === 'test' && (r.testKind === 'e1rm' || r.testKind === 'bench_1rm'))

/** Score d'une série d'accessoire pour les records : charge × reps, ou reps si sans charge. */
function accScore(def: AccessoryExercise, r: { load: number | null; reps: number | null }): number {
  const reps = r.reps ?? 0
  if (def.load === 'bodyweight' || def.load === 'band') return reps
  return (r.load ?? 0) * reps
}

function repsText(reps: number[]): string {
  if (!reps.length) return ''
  return reps.every((r) => r === reps[0]) ? `${reps.length} × ${reps[0]}` : reps.join('-')
}

export function WorkoutSummary({ program, session, rows, week, refsBefore, refsAfter }: {
  program: Program
  session: SessionRow
  rows: SetRow[]
  week: ProgramWeek | undefined
  /** références capturées avant finishSession ; null si la séance était déjà terminée */
  refsBefore: Record<string, number> | null
  refsAfter: Record<string, number>
}) {
  const done = useMemo(
    () => rows.filter((r) => r.done).sort((a, b) => a.setIndex - b.setIndex || (a.id ?? 0) - (b.id ?? 0)),
    [rows],
  )
  const doneSets: DoneSet[] = done.map((r) => ({ muscles: r.muscles, reps: r.reps, load: r.load, kind: r.kind }))
  const ton = tonnage(doneSets)
  const perMuscle = Object.entries(directSetsByMuscle(doneSets)).filter(([, n]) => n > 0)

  // accessoires faits dans la séance, par exerciseId, dans l'ordre
  const accessories = useMemo(() => {
    const out: { id: string; def: AccessoryExercise; rows: SetRow[] }[] = []
    for (const r of done) {
      if (r.kind !== 'accessory' || !r.exerciseId || r.reps === null) continue
      const def = program.exercises[r.exerciseId]
      if (!def || def.type !== 'accessory') continue
      const g = out.find((x) => x.id === r.exerciseId)
      if (g) g.rows.push(r)
      else out.push({ id: r.exerciseId, def, rows: [r] })
    }
    return out
  }, [done, program])

  const sessionId = session.id!
  const accIds = accessories.map((a) => a.id).join(',')

  // historique antérieur : meilleur score par accessoire + références juste avant la séance
  const prior = useLiveQuery(async () => {
    const doneSessions = await db.sessions.where('status').equals('done').toArray()
    const priorIds = new Set(doneSessions
      .filter((s) => s.id !== sessionId && (s.date < session.date || (s.date === session.date && s.id! < sessionId)))
      .map((s) => s.id!))
    const best: Record<string, number> = {}
    for (const id of accIds ? accIds.split(',') : []) {
      const def = program.exercises[id] as AccessoryExercise
      const rs = (await db.sets.where('exerciseId').equals(id).toArray())
        .filter((r) => r.done && priorIds.has(r.sessionId))
      if (rs.length) best[id] = Math.max(...rs.map((r) => accScore(def, r)))
    }
    const refRows = (await db.refs.toArray())
      .filter((r) => r.sessionId !== sessionId && r.date <= session.date)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.id! - b.id!))
    const refs: Record<string, number> = {}
    for (const r of refRows) refs[r.lift] = r.e1rm
    return { best, refs }
  }, [sessionId, session.date, accIds, program])

  const before = refsBefore ?? prior?.refs ?? null

  // lifts de référence touchés par la séance
  const refLifts = [...new Set(done.filter(isRefRow).map((r) => r.lift).filter((l): l is string => !!l))]

  // e1RM de séance par lift (toutes les séries principales / tests à la barre de ce lift)
  const sessionE1rmByLift: Record<string, number> = {}
  for (const r of done) {
    if (!r.lift || !(r.kind === 'main' || r.kind === 'test') || !r.load || !r.reps) continue
    const v = e1rm(r.load, r.reps, r.rir ?? r.targetRir ?? 0)
    sessionE1rmByLift[r.lift] = Math.max(sessionE1rmByLift[r.lift] ?? 0, v)
  }

  const setCountFor = (def: AccessoryExercise) => week?.macro.rules?.accessorySets ?? def.sets

  const proposals = accessories.map(({ id, def, rows: rs }) => {
    const hist: AccessoryHistory = {
      load: rs[0].load,
      progressionIndex: rs[0].progressionIndex ?? def.startProgression ?? 0,
      sets: rs.map((r) => ({ load: r.load, reps: r.reps ?? 0, rir: r.rir ?? def.rir })),
    }
    const t = nextAccessoryTarget(def, hist, setCountFor(def))
    let text: string
    if (def.load === 'bodyweight') {
      const variant = def.progressions?.[t.progressionIndex]
      text = t.progressionIndex !== hist.progressionIndex
        ? `variante suivante « ${variant ?? '?'} », cible ${repsText(t.targetReps)}`
        : `même variante${variant ? ` (${variant})` : ''}, cible ${repsText(t.targetReps)}`
    } else if (t.load !== null && t.load !== hist.load) {
      text = `${fmtKg(t.load)} × ${t.targetReps[0]} la prochaine fois`
    } else {
      text = `même charge${t.load ? ` (${fmtKg(t.load)})` : ''}, cible ${repsText(t.targetReps)}`
    }
    return { id, name: def.name, text, progressed: t.progressed }
  })

  const records: string[] = []
  for (const [lift, v] of Object.entries(sessionE1rmByLift)) {
    const ref = before?.[lift]
    if (ref !== undefined && v > ref + 1e-9) {
      records.push(`Record e1RM ${program.mainLifts[lift]?.name ?? lift} : ${fmtKg(Math.round(v * 10) / 10)}`)
    }
  }
  if (prior) {
    for (const { id, def, rows: rs } of accessories) {
      const prev = prior.best[id]
      if (prev === undefined) continue
      const top = rs.reduce((a, r) => (accScore(def, r) > accScore(def, a) ? r : a))
      if (accScore(def, top) > prev) {
        const what = def.load === 'bodyweight' || def.load === 'band'
          ? `${top.reps} reps`
          : `${fmtKg(top.load)} × ${top.reps}`
        records.push(`${def.name} : ${what}`)
      }
    }
  }

  return (
    <div>
      <div className="banner ok">
        <strong>Séance terminée ✓</strong>
        <div className="small muted">{fmtDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>

      <section className="card">
        <h2>Volume</h2>
        <p>Tonnage : <strong>{fmtKg(Math.round(ton))}</strong> · {done.length} séries faites</p>
        {perMuscle.length > 0 && (
          <div className="row wrap" style={{ gap: 6 }}>
            {perMuscle.map(([m, n]) => <span key={m} className="chip">{m} {n}</span>)}
          </div>
        )}
      </section>

      {(refLifts.length > 0 || proposals.length > 0) && (
        <section className="card">
          <h2>Prochaine fois</h2>
          <ul className="list">
            {refLifts.map((lift) => {
              const name = program.mainLifts[lift]?.name ?? lift
              const a = refsAfter[lift]
              const b = refsBefore?.[lift]
              return (
                <li key={lift}>
                  <strong>{name}</strong> — e1RM de référence{' '}
                  {b !== undefined && b !== a
                    ? <>{fmtKg(b)} → <span className={a > b ? 'ok' : 'danger'}>{fmtKg(a)}</span></>
                    : <>{fmtKg(a)}{refsBefore ? <span className="muted"> (inchangée)</span> : null}</>}
                </li>
              )
            })}
            {proposals.map((p) => (
              <li key={p.id}><strong>{p.name}</strong> : <span className={p.progressed ? 'ok' : ''}>{p.text}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Records</h2>
        {records.length
          ? <ul className="list">{records.map((r) => <li key={r} className="accent">{r}</li>)}</ul>
          : <p className="muted small">Pas de record battu aujourd'hui.</p>}
      </section>

      {session.note && (
        <section className="card"><h3>Note</h3><p>{session.note}</p></section>
      )}

      <p className="tiny">e1RM = charge × (1 + (reps + RIR) / 30){Object.keys(sessionE1rmByLift).length > 0 && ' · '}
        {Object.entries(sessionE1rmByLift).map(([l, v]) => `${program.mainLifts[l]?.name ?? l} ${fmtNum(v)}`).join(' · ')}
      </p>

      <button type="button" className="btn-primary btn-xl btn-block" onClick={() => navigate('/')}>Retour à l'accueil</button>
    </div>
  )
}
