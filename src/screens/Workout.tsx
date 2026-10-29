/** Séance en cours (#/seance/:id). La vérité des séries est la table `sets` ; le plan ne sert qu'à l'affichage. */
import { useCallback, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppState } from '../hooks/useAppState'
import { db } from '../db/schema'
import { currentRefs, finishSession } from '../db/logic'
import { planSession, type PlannedExercise, type SessionPlan } from '../engine'
import { fmtDate } from '../components/ui'
import { Link } from '../router'
import { buildMeta, groupSets, plural, type ExerciseMeta } from '../components/workout/helpers'
import { ExerciseCard } from '../components/workout/ExerciseCard'
import { RestTimer } from '../components/workout/RestTimer'
import { WorkoutSummary } from '../components/workout/WorkoutSummary'

type Phase =
  | { kind: 'live' }
  | { kind: 'finishing' }
  | { kind: 'finished'; before: Record<string, number>; after: Record<string, number> }

export default function Workout({ state, sessionId }: { state: AppState; sessionId: number }) {
  const valid = Number.isFinite(sessionId)
  const session = useLiveQuery(async () => (valid ? (await db.sessions.get(sessionId)) ?? null : null), [sessionId])
  const rows = useLiveQuery(() => (valid ? db.sets.where('sessionId').equals(sessionId).toArray() : []), [sessionId])
  const notes = useLiveQuery(() => (valid ? db.exerciseNotes.where('sessionId').equals(sessionId).toArray() : []), [sessionId])

  const [timerEnd, setTimerEnd] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'live' })
  const [sessionNote, setSessionNote] = useState<string | null>(null)

  const { program, weeks, settings, refs } = state
  const week = session ? weeks.find((w) => w.key === session.weekKey) : undefined

  // plan recalculé : métadonnées d'affichage uniquement
  const plan: SessionPlan | null = useMemo(() => {
    if (!session || !week) return null
    try {
      return planSession({
        program, week, type: session.type, refs, accessoryHistory: {},
        minimal: session.minimal, singleSession: !!settings?.singleSessionWeeks?.includes(week.key),
      })
    } catch { return null }
  }, [program, week, session, refs, settings])

  const plannedByKey = useMemo(() => {
    const m = new Map<string, PlannedExercise>()
    for (const ex of plan?.exercises ?? []) m.set(ex.key, ex)
    return m
  }, [plan])

  const groups = useMemo(() => groupSets(rows ?? []), [rows])

  const onSetDone = useCallback((meta: ExerciseMeta) => {
    // superset avec repos 0 : on enchaîne, pas de minuteur
    if (meta.rest > 0) setTimerEnd(Date.now() + meta.rest * 1000)
  }, [])

  if (!valid) return <div className="screen"><p>Séance introuvable.</p><Link to="/" className="btn">Accueil</Link></div>
  if (session === undefined || rows === undefined || notes === undefined) {
    return <div className="screen"><p className="muted">Chargement…</p></div>
  }
  if (session === null) {
    return <div className="screen"><h1>Séance introuvable</h1><Link to="/" className="btn">Accueil</Link></div>
  }

  const title = plan?.name ?? program.sessions[session.type]?.name ?? `Séance ${session.type}`

  if (phase.kind === 'finished' || (session.status === 'done' && phase.kind === 'live')) {
    return (
      <div className="screen">
        <h1>{title}</h1>
        <WorkoutSummary
          program={program}
          session={session}
          rows={rows}
          week={week}
          refsBefore={phase.kind === 'finished' ? phase.before : null}
          refsAfter={phase.kind === 'finished' ? phase.after : refs}
        />
      </div>
    )
  }
  if (phase.kind === 'finishing') return <div className="screen"><p className="muted">Enregistrement…</p></div>

  const noteFor = (key: string) => notes.find((n) => n.exerciseKey === key)?.note ?? ''
  // exercices du plan sans aucune série (test « mesures ») : simple rappel
  const keysWithRows = new Set(groups.map((g) => g.key))
  const infoOnly = (plan?.exercises ?? []).filter((ex) => ex.sets.length === 0 && !keysWithRows.has(ex.key))

  const notDone = rows.filter((r) => !r.done).length
  const note = sessionNote ?? session.note ?? ''

  const finish = async () => {
    if (notDone > 0 && !window.confirm(`${plural(notDone, 'série')} non faite${notDone > 1 ? 's' : ''}, terminer quand même ?`)) return
    const before = { ...refs }
    setPhase({ kind: 'finishing' })
    setTimerEnd(null)
    try {
      await finishSession(sessionId, note.trim() || undefined)
      const after = await currentRefs()
      setPhase({ kind: 'finished', before, after })
    } catch (e) {
      setPhase({ kind: 'live' })
      window.alert('Impossible de terminer la séance : ' + String(e))
    }
  }

  return (
    <div className="screen">
      <div style={{ marginBottom: 12 }}>
        <h1>{title}</h1>
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="chip">{fmtDate(session.date)}</span>
          {week && <span className="chip">{week.label}</span>}
          {session.minimal && <span className="chip warn">Version minimale</span>}
          {session.isDeload && <span className="chip">Semaine allégée</span>}
          {session.isTest && <span className="chip accent">Tests</span>}
        </div>
        {plan?.warmup && <p className="small muted" style={{ marginTop: 8 }}>Échauffement : {plan.warmup}</p>}
      </div>

      {groups.map((g) => (
        <ExerciseCard
          key={g.key}
          sessionId={sessionId}
          meta={buildMeta(program, week, g.rows, plannedByKey.get(g.key))}
          rows={g.rows}
          note={noteFor(g.key)}
          onSetDone={onSetDone}
        />
      ))}
      {infoOnly.map((ex) => (
        <ExerciseCard
          key={ex.key}
          sessionId={sessionId}
          meta={buildMeta(program, week, [], ex)}
          rows={[]}
          note={noteFor(ex.key)}
          onSetDone={onSetDone}
        />
      ))}

      <section className="card">
        <label htmlFor="session-note">Note de séance</label>
        <textarea id="session-note" value={note} onChange={(e) => setSessionNote(e.target.value)}
          onBlur={() => { if (sessionNote !== null) void db.sessions.update(sessionId, { note: sessionNote }) }}
          placeholder="Sensations, douleurs, contexte…" />
        <p className="tiny" style={{ margin: '6px 0 10px' }}>
          {notDone ? `${plural(notDone, 'série')} restante${notDone > 1 ? 's' : ''}` : 'Toutes les séries sont faites'}
        </p>
        <button type="button" className="btn-primary btn-xl btn-block" onClick={() => { void finish() }}>
          Terminer la séance
        </button>
      </section>

      {timerEnd !== null && <div style={{ height: 80 }} />}
      <RestTimer end={timerEnd} onChange={setTimerEnd} />
    </div>
  )
}
