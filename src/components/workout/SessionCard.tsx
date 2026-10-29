/** Carte d'une séance prévue (aujourd'hui ou aperçu) : exercices, forme du jour, démarrage, déplacement. */
import { useMemo, useState } from 'react'
import { openSession } from '../../db/logic'
import type { SessionRow } from '../../db/schema'
import {
  planSession, WEEKDAY_FR,
  type AccessoryHistory, type PlannedExercise, type ProgramWeek, type ScheduledSession, type SessionMove,
} from '../../engine'
import type { Program, SessionType, Weekday } from '../../types/program'
import { Banner, Scale, fmtDate, fmtKg } from '../ui'
import { Link, navigate } from '../../router'
import { KIND_LABEL, fmtRest } from './helpers'
import { MoveSheet } from './MoveSheet'

function exerciseLine(ex: PlannedExercise): string {
  const work = ex.sets.filter((s) => !s.isTop)
  const parts: string[] = []
  if (ex.kind === 'test') {
    if (ex.testKind === 'body') return 'à saisir dans Mesures'
    return 'protocole de test'
  }
  const reps = ex.repsRange ? `${ex.repsRange[0]}-${ex.repsRange[1]}` : work[0]?.reps
  if (work.length) parts.push(`${work.length} × ${reps ?? '?'}`)
  const load = work[0]?.load
  if (load && load > 0) parts.push(fmtKg(load))
  if (ex.sets.some((s) => s.isTop)) parts.push('+ top single')
  if (ex.rirLabel !== undefined) parts.push(`RIR ${ex.rirLabel}`)
  if (ex.rest > 0) parts.push(fmtRest(ex.rest))
  return parts.join(' · ')
}

export function SessionCard({
  program, week, scheduled, refs, histories, days, moves, singleSession, preview, done, onSkip,
}: {
  program: Program
  week: ProgramWeek
  scheduled: ScheduledSession
  refs: Record<string, number>
  histories: Record<string, AccessoryHistory | null>
  days: Record<SessionType, Weekday>
  moves: SessionMove[]
  singleSession: boolean
  /** séance d'un autre jour affichée en aperçu */
  preview: boolean
  /** séance déjà terminée */
  done?: SessionRow
  onSkip?: () => void
}) {
  const def = program.sessions[scheduled.type]
  const hasMinimal = def.minimal !== null
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [sleep, setSleep] = useState<number | null>(null)
  const [choice, setChoice] = useState<'minimal' | 'full' | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  const forced = hasMinimal && scheduled.forcedMinimal
  const heavy = (fatigue ?? 0) >= 4 || (sleep ?? 0) >= 4
  const minimal = hasMinimal && (forced || (heavy && choice !== 'full'))

  const plan = useMemo(() => planSession({
    program, week, type: scheduled.type, refs, accessoryHistory: histories, minimal, singleSession,
  }), [program, week, scheduled.type, refs, histories, minimal, singleSession])

  const start = async () => {
    setStarting(true)
    try {
      const id = await openSession(plan, week, new Date(), { fatigue: fatigue ?? undefined, sleep: sleep ?? undefined })
      navigate('/seance/' + id)
    } catch (e) {
      setStarting(false)
      window.alert('Impossible de démarrer la séance : ' + String(e))
    }
  }

  const dateTxt = fmtDate(scheduled.date, { weekday: 'long', day: 'numeric', month: 'long' })

  if (done) {
    return (
      <section className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{def.name}</h2>
          <span className="chip ok">Séance faite ✓</span>
        </div>
        <Link to={`/journal/${done.id}`} className="btn btn-block" style={{ marginTop: 10 }}>Voir dans le journal</Link>
      </section>
    )
  }

  return (
    <section className={`card${preview ? '' : ' accent'}`}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h2 className="grow">{def.name}</h2>
        <span className="chip">{def.place}</span>
      </div>
      <p className="small muted">
        {preview ? `Prévue ${dateTxt}` : `Aujourd'hui · ${WEEKDAY_FR[scheduled.weekday]}`}
        {scheduled.moved && ' · déplacée'}
      </p>
      <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
        {plan.isTest && <span className="chip accent">Tests</span>}
        {plan.isDeload && <span className="chip">Semaine allégée</span>}
        {plan.minimal && <span className="chip warn">Version minimale</span>}
        {scheduled.skippable && <span className="chip">Bonus</span>}
      </div>
      {forced && <Banner kind="warn">Version minimale (A déplacée sur ce jour)</Banner>}
      {singleSession && scheduled.type === 'A' && (
        <Banner kind="info">Semaine à une seule séance : développé couché (volume) ajouté en fin de séance, la séance B n'est pas prévue.</Banner>
      )}

      <p className="small"><span className="muted">Échauffement :</span> {def.warmup}</p>

      <ul className="list" style={{ marginBottom: 12 }}>
        {plan.exercises.map((ex) => (
          <li key={ex.key} style={{ padding: '8px 0' }}>
            <div className="row between">
              <strong className="grow">{ex.name}</strong>
              <span className="tiny">{KIND_LABEL[ex.kind]}</span>
            </div>
            <div className="small muted">{exerciseLine(ex)}</div>
            {ex.progressionName && <div className="tiny">Variante : {ex.progressionName}</div>}
          </li>
        ))}
      </ul>

      <div className="stack">
        <div>
          <label>Fatigue</label>
          <Scale value={fatigue} onChange={setFatigue} labels={['1 = en forme', '5 = épuisé']} />
        </div>
        <div>
          <label>Sommeil</label>
          <Scale value={sleep} onChange={setSleep} labels={['1 = bien dormi', '5 = très mal dormi']} />
        </div>
        {heavy && hasMinimal && !forced && (
          <Banner kind="warn">
            <p><strong>Journée chargée : version minimale proposée</strong></p>
            <div className="grid2">
              <button type="button" className={choice !== 'full' ? 'btn-primary' : ''} onClick={() => setChoice('minimal')}>Minimale</button>
              <button type="button" className={choice === 'full' ? 'btn-primary' : ''} onClick={() => setChoice('full')}>Complète</button>
            </div>
          </Banner>
        )}
        <button type="button" className="btn-primary btn-xl btn-block" disabled={starting} onClick={() => { void start() }}>
          {preview ? 'Commencer quand même' : 'Commencer'}
        </button>
        <div className="grid2">
          <button type="button" onClick={() => setMoveOpen(true)}>Déplacer cette séance</button>
          {scheduled.skippable && onSkip
            ? <button type="button" className="btn-ghost" onClick={onSkip}>Sauter cette séance</button>
            : <span />}
        </div>
      </div>

      <MoveSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        program={program}
        week={week}
        type={scheduled.type}
        days={days}
        moves={moves}
        singleSession={singleSession}
      />
    </section>
  )
}
