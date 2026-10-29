/** Liste des séances d'une semaine avec leur jour (résultat des déplacements). */
import { scheduleWeek, toISODate, WEEKDAY_FR, type ProgramWeek, type SessionMove } from '../../engine'
import type { Program, SessionType, Weekday } from '../../types/program'
import { fmtDate } from '../ui'

export function WeekSchedule({ program, week, days, moves, singleSession, highlight }: {
  program: Program
  week: ProgramWeek
  days: Record<SessionType, Weekday>
  moves: SessionMove[]
  singleSession: boolean
  highlight?: SessionType
}) {
  const sched = scheduleWeek(program, week, days, moves)
  const todayISO = toISODate(new Date())
  return (
    <ul className="list">
      {sched.map((s) => {
        const def = program.sessions[s.type]
        const dropped = singleSession && s.type === 'B'
        const isToday = toISODate(s.date) === todayISO
        return (
          <li key={s.type} style={{ padding: '8px 0', opacity: dropped ? 0.5 : 1 }}>
            <div className="row between">
              <span className={highlight === s.type ? 'accent' : ''}>
                <strong>{WEEKDAY_FR[s.weekday]}</strong> {fmtDate(s.date, { day: 'numeric', month: 'short' })}
                {isToday && <span className="tiny"> · aujourd'hui</span>}
              </span>
              <span className="small">{def.name}</span>
            </div>
            <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
              {s.moved && <span className="chip">déplacée</span>}
              {s.forcedMinimal && def.minimal !== null && <span className="chip warn">passe en minimale</span>}
              {dropped && <span className="chip">non prévue (semaine à une séance)</span>}
              {s.skippable && <span className="chip">bonus</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
