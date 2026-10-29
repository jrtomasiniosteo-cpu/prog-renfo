/** État partagé : réglages, programme actif, semaines, références courantes, position du jour. */
import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type SettingsRow } from '../db/schema'
import { activeProgram, ensureInitialRefs, getSettings, refsFromRows, weeksFor } from '../db/logic'
import { locate, type Position, type ProgramWeek } from '../engine'
import type { Program } from '../types/program'

export interface AppState {
  ready: boolean
  settings: SettingsRow | undefined
  program: Program
  weeks: ProgramWeek[]
  refs: Record<string, number>
  position: Position | null
  currentWeek: ProgramWeek | null
}

export function useAppState(now: Date = new Date()): AppState {
  // Les liveQuery sont en lecture seule : l'amorçage (réglages, références initiales) se fait dans un effet.
  const settings = useLiveQuery(() => db.settings.get('main'), [])
  const refRows = useLiveQuery(() => db.refs.toArray(), [])
  const program = useMemo(() => activeProgram(settings), [settings])
  const weeks = useMemo(() => weeksFor(settings), [settings])
  const refs = useMemo(() => (refRows ? refsFromRows(refRows) : {}), [refRows])

  useEffect(() => { void getSettings() }, [])
  useEffect(() => { void ensureInitialRefs(program) }, [program])

  const dayKey = now.toDateString()
  const position = useMemo(() => (weeks.length ? locate(weeks, now) : null), [weeks, dayKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const seeded = settings !== undefined && refRows !== undefined && refRows.length > 0
  return {
    ready: seeded,
    settings,
    program,
    weeks,
    refs,
    position,
    currentWeek: position?.status === 'running' ? position.week : null,
  }
}

/** Séance en cours (statut in_progress), s'il y en a une. */
export function useOpenSession() {
  return useLiveQuery(() => db.sessions.where('status').equals('in_progress').first(), [])
}
