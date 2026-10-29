/**
 * Logique de persistance : lit/écrit IndexedDB, délègue tout calcul au moteur pur.
 * Les références « session » et « test » sont REJOUÉES depuis le journal : modifier
 * une séance passée = la modifier puis appeler recomputeReferences().
 */
import defaultProgram from '../data/program.json'
import type { AccessoryExercise, Program, SessionType, Weekday } from '../types/program'
import {
  buildWeeks, mainSet, sessionE1rm, updateReference, toISODate, e1rm,
  type AccessoryHistory, type PlannedExercise, type ProgramWeek, type SessionPlan, type LoggedSet,
} from '../engine'
import { db, type RefRow, type SessionRow, type SetRow, type SettingsRow } from './schema'

export const DEFAULT_PROGRAM = defaultProgram as unknown as Program

/* ---------- réglages & programme ---------- */

export async function getSettings(): Promise<SettingsRow> {
  const s = await db.settings.get('main')
  if (s) return s
  const fresh: SettingsRow = {
    id: 'main',
    startDate: DEFAULT_PROGRAM.startDate,
    days: { ...DEFAULT_PROGRAM.defaultDays },
    programOverride: null,
    singleSessionWeeks: [],
  }
  await db.settings.put(fresh)
  return fresh
}

export async function updateSettings(patch: Partial<Omit<SettingsRow, 'id'>>): Promise<void> {
  const s = await getSettings()
  await db.settings.put({ ...s, ...patch })
}

export function activeProgram(settings: SettingsRow | undefined): Program {
  return settings?.programOverride ?? DEFAULT_PROGRAM
}

export function weeksFor(settings: SettingsRow | undefined): ProgramWeek[] {
  const p = activeProgram(settings)
  return buildWeeks(p, settings?.startDate ?? p.startDate)
}

/* ---------- références ---------- */

/** Pose les références initiales si la table est vide. */
export async function ensureInitialRefs(program: Program): Promise<void> {
  const n = await db.refs.count()
  if (n > 0) return
  const date = program.startDate
  await db.refs.bulkAdd(
    Object.entries(program.mainLifts).map(([lift, def]) => ({
      lift, e1rm: def.default_e1rm, date, weekIndex: -1, source: 'init' as const,
    })),
  )
}

/** Référence manuelle (écran Réglages). Datée du jour → les séances suivantes repartent de là. */
export async function setManualRef(lift: string, e1rmValue: number, weekIndex: number): Promise<void> {
  await db.refs.add({ lift, e1rm: e1rmValue, date: toISODate(new Date()), weekIndex, source: 'manual' })
  await recomputeReferences()
}

/** Référence courante par lift (dernière ligne par date puis id). */
export async function currentRefs(): Promise<Record<string, number>> {
  const rows = await db.refs.orderBy('id').toArray()
  const out: Record<string, number> = {}
  for (const r of rows.sort((a, b) => a.date.localeCompare(b.date) || (a.id! - b.id!))) out[r.lift] = r.e1rm
  return out
}

/** Référence en vigueur juste avant une date donnée. */
function refsBefore(rows: RefRow[], date: string, excludeSessionIds: Set<number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (r.sessionId !== undefined && excludeSessionIds.has(r.sessionId)) continue
    if (r.date <= date) out[r.lift] = r.e1rm
  }
  return out
}

interface LiftOutcome { lift: string; e1rm: number | null; mainRir: number | null; targetRir: number; isTest: boolean }

/** Ce qu'une séance terminée dit de chaque lift de référence. */
function liftOutcomes(sets: SetRow[]): LiftOutcome[] {
  const byLift = new Map<string, { sets: LoggedSet[]; targetRir: number; isTest: boolean }>()
  for (const s of sets) {
    const isRefMain = s.kind === 'main' && (s.exerciseId === 'squat' || s.exerciseId === 'bench_heavy')
    const isRefTest = s.kind === 'test' && (s.testKind === 'e1rm' || s.testKind === 'bench_1rm')
    if (!isRefMain && !isRefTest) continue
    if (!s.lift || !s.done || !s.load || !s.reps) continue
    const cur = byLift.get(s.lift) ?? { sets: [], targetRir: s.targetRir ?? 2, isTest: isRefTest }
    cur.sets.push({ load: s.load, reps: s.reps, rir: s.rir ?? (isRefTest ? 1 : s.targetRir ?? 2) })
    if (s.targetRir !== null && !s.isTop) cur.targetRir = s.targetRir
    byLift.set(s.lift, cur)
  }
  return [...byLift.entries()].map(([lift, v]) => {
    const ms = mainSet(v.sets)
    return { lift, e1rm: sessionE1rm(v.sets), mainRir: ms?.rir ?? null, targetRir: v.targetRir, isTest: v.isTest }
  })
}

/**
 * Rejoue toutes les séances terminées, dans l'ordre, et réécrit les références
 * `session` / `test`. Les lignes `init` et `manual` sont conservées telles quelles.
 */
export async function recomputeReferences(): Promise<void> {
  const settings = await getSettings()
  const program = activeProgram(settings)
  await db.transaction('rw', db.refs, db.sessions, db.sets, async () => {
    await db.refs.where('source').anyOf(['session', 'test']).delete()
    const fixed = (await db.refs.toArray()).sort((a, b) => a.date.localeCompare(b.date) || (a.id! - b.id!))
    const sessions = (await db.sessions.where('status').equals('done').toArray())
      .sort((a, b) => a.date.localeCompare(b.date) || (a.id! - b.id!))
    const derived: RefRow[] = []
    for (const s of sessions) {
      const sets = await db.sets.where('sessionId').equals(s.id!).toArray()
      const current = { ...refsBefore(fixed, s.date, new Set()), ...refsBefore(derived, s.date, new Set()) }
      // une référence manuelle datée après une séance prime : on applique date ≤ s.date seulement
      for (const o of liftOutcomes(sets)) {
        const ref = current[o.lift]
        const cap = program.mainLifts[o.lift]?.weeklyCap ?? 2.5
        if (ref === undefined) continue
        const next = updateReference({
          ref, sessionE1rm: o.e1rm, cap, targetRir: o.targetRir, mainSetRir: o.mainRir, isTest: o.isTest,
        })
        if (next !== ref || o.isTest) {
          const row: RefRow = {
            lift: o.lift, e1rm: next, date: s.date, weekIndex: s.weekIndex,
            source: o.isTest ? "test" : "session", sessionId: s.id!,
          }
          derived.push(row)
          current[o.lift] = next
        }
      }
    }
    // ids croissants dans l'ordre chronologique pour que currentRefs() tranche bien les égalités de date
    if (derived.length) await db.refs.bulkAdd(derived)
  })
}

/* ---------- accessoires ---------- */

/** Dernière séance terminée de chaque accessoire → historique pour la double progression. */
export async function accessoryHistories(program: Program): Promise<Record<string, AccessoryHistory | null>> {
  const out: Record<string, AccessoryHistory | null> = {}
  const doneIds = new Set((await db.sessions.where('status').equals('done').toArray()).map((s) => s.id!))
  const ids = Object.entries(program.exercises).filter(([, e]) => e.type === 'accessory').map(([id]) => id)
  for (const id of ids) {
    const rows = (await db.sets.where('exerciseId').equals(id).toArray())
      .filter((r) => doneIds.has(r.sessionId) && r.done && r.reps !== null)
    if (!rows.length) { out[id] = null; continue }
    const lastSession = Math.max(...rows.map((r) => r.sessionId))
    const last = rows.filter((r) => r.sessionId === lastSession).sort((a, b) => a.setIndex - b.setIndex)
    const def = program.exercises[id] as AccessoryExercise
    out[id] = {
      load: last[0].load,
      progressionIndex: last[0].progressionIndex ?? def.startProgression ?? 0,
      sets: last.map((r) => ({ load: r.load, reps: r.reps ?? 0, rir: r.rir ?? def.rir })),
    }
  }
  return out
}

/* ---------- séances ---------- */

export async function openSession(plan: SessionPlan, week: ProgramWeek, date: Date, extra: {
  fatigue?: number; sleep?: number
}): Promise<number> {
  const row: SessionRow = {
    date: toISODate(date), type: plan.type, weekKey: week.key, weekIndex: week.index,
    minimal: plan.minimal, isTest: plan.isTest, isDeload: plan.isDeload,
    fatigue: extra.fatigue, sleep: extra.sleep, status: 'in_progress', startedAt: new Date().toISOString(),
  }
  return db.transaction('rw', db.sessions, db.sets, async () => {
    const id = (await db.sessions.add(row)) as number
    await db.sets.bulkAdd(plan.exercises.flatMap((ex) => ex.sets.map((s, i) => setRowFrom(id, ex, i, s))))
    return id
  })
}

function setRowFrom(sessionId: number, ex: PlannedExercise, i: number, s: PlannedExercise['sets'][number]): SetRow {
  return {
    sessionId, exerciseKey: ex.key, exerciseId: ex.exerciseId, exerciseName: ex.name, kind: ex.kind,
    lift: ex.lift, muscles: ex.muscles, setIndex: i,
    targetLoad: s.load, targetReps: s.reps, targetRir: s.rir,
    load: s.load, reps: s.reps, rir: s.rir, measureCm: null, done: false,
    isTop: s.isTop, progressionIndex: ex.progressionIndex, testKind: ex.testKind,
  }
}

/** Ajoute une série à un exercice d'une séance ouverte (montées de test, série bonus). */
export async function addSet(sessionId: number, exerciseKey: string): Promise<number> {
  const rows = await db.sets.where('[sessionId+exerciseKey]').equals([sessionId, exerciseKey]).toArray()
  const last = rows.sort((a, b) => a.setIndex - b.setIndex)[rows.length - 1]
  if (!last) throw new Error('exercice inconnu')
  const { id: _id, ...copy } = last
  void _id
  return (await db.sets.add({ ...copy, setIndex: last.setIndex + 1, done: false, measureCm: null })) as number
}

export async function finishSession(sessionId: number, note?: string): Promise<void> {
  await db.sessions.update(sessionId, { status: 'done', finishedAt: new Date().toISOString(), note })
  await recordTestsFromSession(sessionId)
  await recomputeReferences()
}

/** Après modification dans le journal. */
export async function afterJournalEdit(sessionId: number): Promise<void> {
  await db.tests.where('sessionId').equals(sessionId).delete()
  await recordTestsFromSession(sessionId)
  await recomputeReferences()
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.exerciseNotes, db.tests, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.exerciseNotes.where('sessionId').equals(sessionId).delete()
    await db.tests.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
  await recomputeReferences()
}

/** CMJ / tractions / e1RM mesurés en séance de test → table tests (pour les graphiques). */
async function recordTestsFromSession(sessionId: number): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((r) => r.done)
  await db.tests.where('sessionId').equals(sessionId).delete()
  const rows: { date: string; kind: 'e1rm' | 'bench_1rm' | 'cmj' | 'pullups'; lift?: string; value: number; sessionId: number }[] = []
  const cmj = sets.filter((r) => r.testKind === 'cmj' && r.measureCm).map((r) => r.measureCm as number)
  if (cmj.length) rows.push({ date: s.date, kind: "cmj", value: Math.max(...cmj), sessionId: sessionId })
  const pu = sets.filter((r) => r.testKind === 'pullups' && r.reps).map((r) => r.reps as number)
  if (pu.length) rows.push({ date: s.date, kind: 'pullups', value: Math.max(...pu), sessionId })
  for (const kind of ['e1rm', 'bench_1rm'] as const) {
    const byLift = new Map<string, number>()
    for (const r of sets) {
      if (r.testKind !== kind || !r.lift || !r.load || !r.reps) continue
      const v = kind === 'bench_1rm' ? r.load : e1rm(r.load, r.reps, r.rir ?? 1)
      byLift.set(r.lift, Math.max(byLift.get(r.lift) ?? 0, v))
    }
    for (const [lift, value] of byLift) rows.push({ date: s.date, kind, lift, value, sessionId })
  }
  if (rows.length) await db.tests.bulkAdd(rows)
}

/* ---------- déplacements ---------- */

export async function moveSession(weekKey: string, type: SessionType, weekday: Weekday | null): Promise<void> {
  await db.moves.where('[weekKey+type]').equals([weekKey, type]).delete()
  if (weekday) await db.moves.add({ weekKey, type, weekday })
}
