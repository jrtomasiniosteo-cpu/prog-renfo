/** Liste des séances terminées, groupées par semaine. */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SessionRow, type SetRow } from '../../db/schema'
import type { AppState } from '../../hooks/useAppState'
import { Link } from '../../router'
import { fmtDate, fmtKg } from '../ui'
import { sessionE1rmByLift, sessionTitle, truncate } from './helpers'

interface Item { session: SessionRow; doneSets: number; e1rm: Record<string, number> }

export default function SessionList({ state }: { state: AppState }) {
  const items = useLiveQuery(async (): Promise<Item[]> => {
    const sessions = (await db.sessions.where('status').equals('done').toArray())
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id! - a.id!))
    const ids = sessions.map((s) => s.id!)
    const sets = ids.length ? await db.sets.where('sessionId').anyOf(ids).toArray() : []
    const by = new Map<number, SetRow[]>()
    for (const s of sets) { const a = by.get(s.sessionId) ?? []; a.push(s); by.set(s.sessionId, a) }
    return sessions.map((session) => {
      const ss = by.get(session.id!) ?? []
      return { session, doneSets: ss.filter((s) => s.done).length, e1rm: sessionE1rmByLift(ss) }
    })
  }, [])
  const open = useLiveQuery(() => db.sessions.where('status').equals('in_progress').first(), [])

  if (items === undefined) return <p className="muted">Chargement…</p>

  const groups: { key: string; label: string; items: Item[] }[] = []
  for (const it of items) {
    const last = groups[groups.length - 1]
    if (last && last.key === it.session.weekKey) last.items.push(it)
    else {
      const w = state.weeks.find((x) => x.key === it.session.weekKey)
      groups.push({ key: it.session.weekKey, label: w ? w.label : it.session.weekKey, items: [it] })
    }
  }
  const liftName = (lift: string) => state.program.mainLifts[lift]?.name ?? lift

  return (
    <>
      {open && (
        <Link to={`/seance/${open.id}`} className="card accent" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <div className="row between">
            <span><strong>Séance en cours</strong> <span className="muted small">{sessionTitle(state.program, open.type)}</span></span>
            <span className="accent">Reprendre ›</span>
          </div>
        </Link>
      )}
      {!items.length && (
        <div className="card">
          <h2>Ton journal est vide</h2>
          <p className="muted">Chaque séance terminée apparaîtra ici. Tu pourras la relire et corriger une charge ou des reps après coup.</p>
          <Link to="/" className="btn btn-primary btn-block">Voir la séance du jour</Link>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} style={{ marginBottom: 16 }}>
          <h3>{g.label}</h3>
          <ul className="list">
            {g.items.map(({ session: s, doneSets, e1rm }) => (
              <li key={s.id}>
                <Link to={`/journal/${s.id}`}>
                  <div className="row between">
                    <strong>{fmtDate(s.date)}</strong>
                    <span className="tiny">{doneSets} série{doneSets > 1 ? 's' : ''} ›</span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    <span>{sessionTitle(state.program, s.type)}</span>
                    {s.minimal && <span className="chip">minimale</span>}
                    {s.isDeload && <span className="chip">allégée</span>}
                    {s.isTest && <span className="chip accent">test</span>}
                  </div>
                  {Object.keys(e1rm).length > 0 && (
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {Object.entries(e1rm).map(([lift, v]) => `${liftName(lift)} e1RM ${fmtKg(Math.round(v * 10) / 10)}`).join(' · ')}
                    </div>
                  )}
                  {s.note && <div className="tiny" style={{ marginTop: 4 }}>« {truncate(s.note)} »</div>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
