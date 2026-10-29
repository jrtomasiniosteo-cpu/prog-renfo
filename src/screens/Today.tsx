/** Écran Aujourd'hui (#/) : séance du jour ou prochaine, forme du jour, démarrage, déplacement. */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useOpenSession, type AppState } from '../hooks/useAppState'
import { db } from '../db/schema'
import { accessoryHistories, updateSettings } from '../db/logic'
import {
  scheduleWeek, startOfDay, toISODate, todayAndNext, addDays,
  type ProgramWeek, type ScheduledSession, type SessionMove,
} from '../engine'
import type { Program, SessionType, Weekday } from '../types/program'
import { fmtDate } from '../components/ui'
import { Link } from '../router'
import { SessionCard } from '../components/workout/SessionCard'
import { WeekSchedule } from '../components/workout/WeekSchedule'
import ExportReminder from '../components/settings/ExportReminder'

const isSingleWeek = (w: ProgramWeek, single: string[]) => !!w.macro.rules?.singleSessionWeek && single.includes(w.key)

/** Prochaine séance strictement après `after`, en ignorant B les semaines « à une séance ». */
function findNext(
  program: Program, weeks: ProgramWeek[], after: Date, fromIndex: number,
  days: Record<SessionType, Weekday>, moves: SessionMove[], single: string[],
): (ScheduledSession & { week: ProgramWeek }) | null {
  const d = startOfDay(after).getTime()
  for (let i = Math.max(0, fromIndex); i < weeks.length; i++) {
    const w = weeks[i]
    const s = scheduleWeek(program, w, days, moves)
      .filter((x) => !(isSingleWeek(w, single) && x.type === 'B'))
      .find((x) => x.date.getTime() > d)
    if (s) return { ...s, week: w }
  }
  return null
}

export default function Today({ state }: { state: AppState }) {
  const { program, weeks, settings, refs, position } = state
  const open = useOpenSession()
  const moves = useLiveQuery(() => db.moves.toArray(), [])
  const histories = useLiveQuery(() => accessoryHistories(program), [program])
  const doneSessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  // séances sautées aujourd'hui (état local, éphémère)
  const [skipped, setSkipped] = useState<string[]>([])

  const now = new Date()
  const todayISO = toISODate(now)
  const days = settings?.days ?? program.defaultDays
  const single = settings?.singleSessionWeeks ?? []

  if (!position || moves === undefined || histories === undefined || doneSessions === undefined) {
    return <div className="screen"><p className="muted">Chargement…</p></div>
  }

  // ---- en-tête ----
  const headerWeek = position.status === 'running' ? position.week : position.status === 'before' ? weeks[0] : position.lastWeek
  const header = (
    <>
    <header style={{ marginBottom: 12 }}>
      <p className="tiny" style={{ marginBottom: 2 }}>{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>{position.status === 'running' ? position.week.label : position.status === 'before' ? 'Avant le programme' : 'Programme terminé'}</h1>
      {position.status === 'running' && (
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="chip">{position.week.block.name}</span>
          {position.week.isDeload && <span className="chip warn">Semaine allégée</span>}
          {position.week.tests.length > 0 && <span className="chip accent">Tests</span>}
        </div>
      )}
    </header>
      <ExportReminder settings={state.settings} />
    </>
  )

  if (open) {
    return (
      <div className="screen">
        {header}
        <section className="card accent">
          <h2>{program.sessions[open.type]?.name ?? `Séance ${open.type}`}</h2>
          <p className="small muted">Commencée {fmtDate(open.date)}</p>
          <Link to={`/seance/${open.id}`} className="btn btn-primary btn-xl btn-block">Reprendre la séance</Link>
        </section>
      </div>
    )
  }

  if (position.status === 'finished') {
    return (
      <div className="screen">
        {header}
        <section className="card accent">
          <h2>Programme terminé — exporte tes données et construis le macrocycle 4</h2>
          <p className="small muted">Dernière semaine : {headerWeek.label}</p>
          <Link to="/reglages" className="btn btn-primary btn-block">Aller aux réglages</Link>
        </section>
      </div>
    )
  }

  // ---- séances à afficher ----
  let cards: { sc: ScheduledSession; week: ProgramWeek; preview: boolean }[] = []
  let nextInfo: (ScheduledSession & { week: ProgramWeek }) | null = null
  let scheduleWeekShown: ProgramWeek

  if (position.status === 'before') {
    nextInfo = findNext(program, weeks, addDays(weeks[0].start, -1), 0, days, moves, single)
    scheduleWeekShown = weeks[0]
  } else {
    const week = position.week
    scheduleWeekShown = week
    const { today } = todayAndNext(program, weeks, now, days, moves)
    const todays = today.filter((s) => !(isSingleWeek(week, single) && s.type === 'B'))
    if (todays.length) cards = todays.map((sc) => ({ sc, week, preview: false }))
    else nextInfo = findNext(program, weeks, now, week.index, days, moves, single)
  }
  if (nextInfo) cards = [{ sc: nextInfo, week: nextInfo.week, preview: true }]

  const doneFor = (type: SessionType, week: ProgramWeek) =>
    doneSessions.find((s) => s.type === type && (s.date === todayISO || s.weekKey === week.key))

  const cardKey = (c: { sc: ScheduledSession; week: ProgramWeek }) => `${c.week.key}:${c.sc.type}:${todayISO}`
  const visible = cards.filter((c) => !skipped.includes(cardKey(c)))
  const skippedCards = cards.filter((c) => skipped.includes(cardKey(c)))

  const singleWeek = cards[0]?.week ?? scheduleWeekShown
  const singleAllowed = !!singleWeek.macro.rules?.singleSessionWeek
  const singleOn = single.includes(singleWeek.key)
  const toggleSingle = () => {
    const next = singleOn ? single.filter((k) => k !== singleWeek.key) : [...single, singleWeek.key]
    void updateSettings({ singleSessionWeeks: next })
  }

  return (
    <div className="screen">
      {header}

      {position.status === 'before' && (
        <div className="banner info">
          Le programme commence le <strong>{fmtDate(position.start, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.
        </div>
      )}

      {position.status === 'running' && nextInfo && (
        <div className="banner info">
          Pas de séance aujourd'hui — prochaine : <strong>{nextInfo.type}</strong>{' '}
          {fmtDate(nextInfo.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      )}
      {position.status === 'running' && !nextInfo && cards.length === 0 && (
        <div className="banner info">Plus aucune séance prévue au programme.</div>
      )}

      {singleAllowed && (
        <section className="card">
          <label className="row between" style={{ margin: 0, color: 'var(--fg)', fontSize: 17 }}>
            <span>
              <strong>Semaine à une seule séance</strong>
              <span className="tiny" style={{ display: 'block' }}>{singleWeek.macro.rules?.singleSessionWeek}</span>
            </span>
            <input type="checkbox" checked={singleOn} onChange={toggleSingle}
              style={{ width: 28, minHeight: 28, height: 28, flex: 'none', accentColor: 'var(--accent)' }} />
          </label>
        </section>
      )}

      {visible.map((c) => (
        <SessionCard
          key={cardKey(c)}
          program={program}
          week={c.week}
          scheduled={c.sc}
          refs={refs}
          histories={histories}
          days={days}
          moves={moves}
          singleSession={isSingleWeek(c.week, single)}
          preview={c.preview}
          done={doneFor(c.sc.type, c.week)}
          onSkip={c.sc.skippable ? () => setSkipped((s) => [...s, cardKey(c)]) : undefined}
        />
      ))}

      {skippedCards.map((c) => (
        <div key={cardKey(c)} className="row between card">
          <span className="muted small">{program.sessions[c.sc.type].name} sautée aujourd'hui</span>
          <button type="button" className="btn-sm btn-ghost" onClick={() => setSkipped((s) => s.filter((k) => k !== cardKey(c)))}>Annuler</button>
        </div>
      ))}

      <section className="card">
        <h3>{position.status === 'before' ? 'Première semaine' : 'Cette semaine'}</h3>
        <WeekSchedule
          program={program}
          week={scheduleWeekShown}
          days={days}
          moves={moves}
          singleSession={isSingleWeek(scheduleWeekShown, single)}
        />
      </section>
    </div>
  )
}
