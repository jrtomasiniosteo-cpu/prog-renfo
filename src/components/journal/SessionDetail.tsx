/** Détail d'une séance du journal, éditable. Toute modification de série relance afterJournalEdit. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { addSet, afterJournalEdit, deleteSession } from '../../db/logic'
import type { AppState } from '../../hooks/useAppState'
import { Link, navigate } from '../../router'
import { Banner, fmtDate } from '../ui'
import ExerciseBlock, { type SetPatch } from './ExerciseBlock'
import { groupByExercise, sessionTitle } from './helpers'

const DEBOUNCE_MS = 400

export default function SessionDetail({ state, sessionId }: { state: AppState; sessionId: number }) {
  const session = useLiveQuery(async () => (await db.sessions.get(sessionId)) ?? null, [sessionId])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(sessionId).toArray(), [sessionId])
  const notes = useLiveQuery(() => db.exerciseNotes.where('sessionId').equals(sessionId).toArray(), [sessionId])
  const [noteDraft, setNoteDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setNoteDraft(session?.note ?? '') }, [session?.note])

  // recalcul débouncé, sérialisé, et garanti au départ de l'écran
  const timer = useRef<number | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const runRecompute = useCallback(() => {
    queue.current = queue.current
      .then(() => afterJournalEdit(sessionId))
      .then(() => setError(null))
      .catch((e: unknown) => {
        console.error(e)
        setError(`Recalcul des références impossible : ${e instanceof Error ? e.message : String(e)}`)
      })
    return queue.current
  }, [sessionId])
  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { timer.current = null; void runRecompute() }, DEBOUNCE_MS)
  }, [runRecompute])
  const flush = useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
    void runRecompute()
  }, [runRecompute])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  if (session === undefined || sets === undefined || notes === undefined) return <p className="muted">Chargement…</p>
  if (session === null) {
    return (
      <div className="card">
        <p>Séance introuvable (supprimée ?).</p>
        <Link to="/journal" className="btn btn-block">Retour au journal</Link>
      </div>
    )
  }

  const week = state.weeks.find((w) => w.key === session.weekKey)
  const header = (
    <div className="card">
      <div className="row between">
        <strong style={{ fontSize: 19 }}>{fmtDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        {session.isTest && <span className="chip accent">test</span>}
      </div>
      <div style={{ marginTop: 4 }}>{sessionTitle(state.program, session.type)}</div>
      <div className="small muted">{week ? week.label : session.weekKey}</div>
      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
        {session.minimal && <span className="chip">minimale</span>}
        {session.isDeload && <span className="chip">allégée</span>}
        <span className="chip">fatigue {session.fatigue ?? '—'}/5</span>
        <span className="chip">sommeil {session.sleep ?? '—'}/5</span>
      </div>
    </div>
  )

  if (session.status === 'in_progress') {
    return (
      <>
        {header}
        <Banner kind="info">Cette séance n'est pas terminée.</Banner>
        <Link to={`/seance/${session.id}`} className="btn btn-primary btn-block btn-xl">Reprendre la séance</Link>
      </>
    )
  }

  const noteByKey = new Map(notes.map((n) => [n.exerciseKey, n]))
  const groups = groupByExercise(sets)

  const onSetChange = async (id: number, patch: SetPatch) => {
    await db.sets.update(id, patch)
    schedule()
  }
  const onExerciseNote = async (exerciseKey: string, note: string) => {
    const existing = noteByKey.get(exerciseKey)
    if (existing?.id !== undefined) {
      if (note.trim() === '') await db.exerciseNotes.delete(existing.id)
      else await db.exerciseNotes.update(existing.id, { note })
    } else if (note.trim() !== '') {
      await db.exerciseNotes.add({ sessionId, exerciseKey, note })
    }
  }
  const onAddSet = async (exerciseKey: string) => {
    await addSet(sessionId, exerciseKey)
    schedule()
  }
  const onDelete = async () => {
    if (!window.confirm('Supprimer définitivement cette séance ? Les références seront recalculées.')) return
    setBusy(true)
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null }
    await queue.current
    try {
      await deleteSession(sessionId)
      navigate('/journal')
    } catch (e) {
      console.error(e)
      setError(`Suppression impossible : ${e instanceof Error ? e.message : String(e)}`)
      setBusy(false)
    }
  }

  return (
    <>
      {header}
      <p className="tiny" style={{ margin: '0 2px 12px' }}>Toute modification recalcule les charges des séances suivantes.</p>
      {error && <Banner kind="danger">{error}</Banner>}
      <div className="card">
        <label htmlFor="session-note">Note de séance</label>
        <textarea
          id="session-note"
          value={noteDraft}
          placeholder="Ressenti général, douleurs, contexte…"
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => { if (noteDraft !== (session.note ?? '')) void db.sessions.update(sessionId, { note: noteDraft || undefined }) }}
        />
      </div>
      {groups.length === 0 && <p className="muted">Aucune série enregistrée.</p>}
      {groups.map((g) => (
        <ExerciseBlock
          key={g.key}
          name={g.name}
          sets={g.sets}
          note={noteByKey.get(g.key)?.note ?? ''}
          program={state.program}
          onSetChange={(id, p) => void onSetChange(id, p)}
          onNoteChange={(n) => void onExerciseNote(g.key, n)}
          onAddSet={() => void onAddSet(g.key)}
        />
      ))}
      <button type="button" className="btn-danger btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={() => void onDelete()}>
        Supprimer la séance
      </button>
    </>
  )
}
