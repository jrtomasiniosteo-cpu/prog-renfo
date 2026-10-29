/** Feuille « Déplacer cette séance » : 7 jours, retour au jour par défaut, aperçu de la semaine. */
import { moveSession } from '../../db/logic'
import { scheduleWeek, WEEKDAY_FR, WEEKDAYS, type ProgramWeek, type SessionMove } from '../../engine'
import type { Program, SessionType, Weekday } from '../../types/program'
import { Sheet } from '../ui'
import { WeekSchedule } from './WeekSchedule'

export function MoveSheet({ open, onClose, program, week, type, days, moves, singleSession }: {
  open: boolean
  onClose: () => void
  program: Program
  week: ProgramWeek
  type: SessionType
  days: Record<SessionType, Weekday>
  moves: SessionMove[]
  singleSession: boolean
}) {
  const cur = scheduleWeek(program, week, days, moves).find((s) => s.type === type)
  const pick = (wd: Weekday) => {
    // revenir au jour par défaut = supprimer le déplacement (sinon il compterait comme « déplacée »)
    void moveSession(week.key, type, wd === days[type] ? null : wd)
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Déplacer ${program.sessions[type].name}`}>
      <p className="small muted">{week.label} · jour par défaut : {WEEKDAY_FR[days[type]]}</p>
      <div className="grid2" style={{ marginBottom: 10 }}>
        {WEEKDAYS.map((wd) => (
          <button key={wd} type="button" className={cur?.weekday === wd ? 'btn-primary' : ''} onClick={() => pick(wd)}>
            {WEEKDAY_FR[wd]}
          </button>
        ))}
      </div>
      {cur?.moved && (
        <button type="button" className="btn-ghost btn-block" onClick={() => { void moveSession(week.key, type, null) }}>
          Remettre au jour par défaut ({WEEKDAY_FR[days[type]]})
        </button>
      )}
      <h3 style={{ marginTop: 12 }}>Semaine</h3>
      <WeekSchedule program={program} week={week} days={days} moves={moves} singleSession={singleSession} highlight={type} />
    </Sheet>
  )
}
