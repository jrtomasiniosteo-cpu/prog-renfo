/** Helpers du journal (lecture seule sur les lignes de la base). */
import { isReferenceExercise, sessionE1rm, type LoggedSet } from '../../engine'
import type { SetRow } from '../../db/schema'
import type { Measure, Program, SessionType } from '../../types/program'

/** « A · Force + détente » à partir de « A — Force + détente ». */
export function sessionTitle(program: Program, type: SessionType): string {
  const name = program.sessions[type]?.name ?? ''
  const short = name.split(' — ').slice(1).join(' — ') || name
  return short ? `${type} · ${short}` : `Séance ${type}`
}

/** Séries qui alimentent la référence (même filtre que db/logic.ts liftOutcomes). */
function isRefSet(s: SetRow): boolean {
  if (s.kind === 'main') return !!s.exerciseId && isReferenceExercise(s.exerciseId)
  if (s.kind === 'test') return s.testKind === 'e1rm' || s.testKind === 'bench_1rm'
  return false
}

/** e1RM de séance par lift de référence (séries faites uniquement). */
export function sessionE1rmByLift(sets: SetRow[]): Record<string, number> {
  const by = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    if (!isRefSet(s) || !s.lift || !s.done || !s.load || !s.reps) continue
    const rir = s.rir ?? (s.kind === 'test' ? 1 : s.targetRir ?? 2)
    const arr = by.get(s.lift) ?? []
    arr.push({ load: s.load, reps: s.reps, rir })
    by.set(s.lift, arr)
  }
  const out: Record<string, number> = {}
  for (const [lift, ls] of by) {
    const v = sessionE1rm(ls)
    if (v !== null) out[lift] = v
  }
  return out
}

export type FieldSet = 'load-reps-rir' | 'cm' | 'reps' | 'none'

/** Mesure déclarée dans le programme pour un exercice de plio (par nom). */
export function plyoMeasure(program: Program, name: string): Measure | undefined {
  for (const m of program.macrocycles) for (const b of m.blocks) {
    const p = b.plyo.find((x) => x.name === name)
    if (p) return p.measure
  }
  return undefined
}

/** Champs saisissables selon le type de série. */
export function fieldsFor(s: SetRow, program: Program): FieldSet {
  if (s.testKind === 'cmj') return 'cm'
  if (s.testKind === 'pullups') return 'reps'
  if (s.testKind === 'body') return 'none'
  if (s.kind === 'plyo') return plyoMeasure(program, s.exerciseName) === 'none' ? 'reps' : 'cm'
  return 'load-reps-rir'
}

/** Regroupe les séries par exerciseKey, dans l'ordre d'apparition (id), séries triées par setIndex. */
export function groupByExercise(sets: SetRow[]): { key: string; name: string; sets: SetRow[] }[] {
  const groups = new Map<string, { key: string; name: string; sets: SetRow[] }>()
  for (const s of [...sets].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
    const g = groups.get(s.exerciseKey) ?? { key: s.exerciseKey, name: s.exerciseName, sets: [] }
    g.sets.push(s)
    groups.set(s.exerciseKey, g)
  }
  for (const g of groups.values()) g.sets.sort((a, b) => a.setIndex - b.setIndex)
  return [...groups.values()]
}

export function truncate(s: string, n = 80): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
