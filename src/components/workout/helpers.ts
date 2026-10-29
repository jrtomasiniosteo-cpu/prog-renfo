/** Helpers d'affichage pour les écrans Aujourd'hui / Séance. Aucune écriture en base ici. */
import type { SetRow } from '../../db/schema'
import type { PlannedExercise, PlannedKind, ProgramWeek } from '../../engine'
import { rirLabel } from '../../engine'
import type { AccessoryExercise, LoadKind, Measure, Program, TestKind } from '../../types/program'

export const KIND_LABEL: Record<PlannedKind, string> = {
  main: 'Principal', accessory: 'Accessoire', plyo: 'Plio', test: 'Test',
}

/** « 90 s », « 2 min », « 2 min 30 » */
export function fmtRest(s: number): string {
  if (s < 120) return `${s} s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m} min ${r}` : `${m} min`
}

/** Métadonnées d'affichage d'un exercice, depuis le plan si possible, sinon depuis le programme. */
export interface ExerciseMeta {
  key: string
  name: string
  kind: PlannedKind
  rest: number
  note?: string
  rirLabel?: string
  repsRange?: [number, number]
  superset?: string
  supersetName?: string
  protocol?: string
  progressionName?: string
  measure?: Measure
  loadKind?: LoadKind
  testKind?: TestKind
  accessoryDef?: AccessoryExercise
  /** RPE du top single (bloc courant), s'il y en a un */
  topRpe?: number
}

export function buildMeta(
  program: Program, week: ProgramWeek | undefined, rows: SetRow[], planned: PlannedExercise | undefined,
): ExerciseMeta {
  const first = rows[0]
  const def = first?.exerciseId ? program.exercises[first.exerciseId] : undefined
  const accessoryDef = def?.type === 'accessory' ? def : undefined
  const kind: PlannedKind = planned?.kind ?? first?.kind ?? 'accessory'
  const testKind = planned?.testKind ?? first?.testKind

  let rest = planned?.rest
  if (rest === undefined) rest = def?.rest ?? (kind === 'test' ? 180 : kind === 'plyo' ? 60 : 90)

  let measure = planned?.measure
  if (!measure && def?.type === 'plyo') measure = def.measure
  if (!measure && testKind === 'cmj') measure = 'cm'

  let loadKind = planned?.loadKind
  if (!loadKind) {
    if (accessoryDef) loadKind = accessoryDef.load
    else if (def?.type === 'main' || testKind === 'e1rm' || testKind === 'bench_1rm') loadKind = 'barbell'
    else if (testKind === 'pullups') loadKind = 'bodyweight'
  }

  // variante : celle enregistrée dans la ligne prime sur le plan recalculé
  const progIdx = first?.progressionIndex
  const progressionName = (progIdx !== undefined ? accessoryDef?.progressions?.[progIdx] : undefined)
    ?? planned?.progressionName

  const superset = planned?.superset ?? accessoryDef?.superset
  const rirTxt = planned?.rirLabel
    ?? (accessoryDef ? rirLabel(accessoryDef.rir) : kind !== 'test' && first?.targetRir !== null && first?.targetRir !== undefined && !first.isTop
      ? rirLabel(first.targetRir) : undefined)

  const topRpe = first?.exerciseId && week ? week.block.main[first.exerciseId]?.top?.rpe : undefined

  return {
    key: planned?.key ?? first?.exerciseKey ?? '?',
    name: planned?.name ?? first?.exerciseName ?? '?',
    kind,
    rest,
    note: planned?.note ?? (def?.type === 'main' ? def.note : undefined),
    rirLabel: rirTxt,
    repsRange: planned?.repsRange ?? accessoryDef?.reps,
    superset,
    supersetName: superset ? program.exercises[superset]?.name ?? superset : undefined,
    protocol: planned?.protocol ?? (testKind ? program.tests[testKind] : undefined),
    progressionName,
    measure,
    loadKind,
    testKind,
    accessoryDef,
    topRpe,
  }
}

/** Tri setIndex croissant puis id, puis regroupement par exerciseKey dans l'ordre d'apparition. */
export function groupSets(rows: SetRow[]): { key: string; rows: SetRow[] }[] {
  const sorted = [...rows].sort((a, b) => a.setIndex - b.setIndex || (a.id ?? 0) - (b.id ?? 0))
  const map = new Map<string, SetRow[]>()
  for (const r of sorted) {
    const g = map.get(r.exerciseKey)
    if (g) g.push(r)
    else map.set(r.exerciseKey, [r])
  }
  return [...map.entries()].map(([key, rs]) => ({ key, rows: rs }))
}

/** Pas du champ charge. null = pas de champ charge. */
export function loadStep(meta: ExerciseMeta): number | null {
  if (meta.loadKind === 'bodyweight' || meta.loadKind === 'band') return null
  if (meta.kind !== 'accessory') return 2.5
  switch (meta.loadKind) {
    case 'dumbbell': return 1
    case 'fixed': return 1
    case 'added': return 1.25
    default: return meta.accessoryDef?.inc ?? 2.5
  }
}

/** Ligne « 3 × 8-12 · RIR 1 · repos 90 s » */
export function prescriptionLine(meta: ExerciseMeta, rows: { targetReps: number | null; isTop?: boolean }[]): string {
  const parts: string[] = []
  const work = rows.filter((r) => !r.isTop)
  const n = work.length
  const reps = meta.repsRange ? `${meta.repsRange[0]}-${meta.repsRange[1]}` : work.find((r) => r.targetReps !== null)?.targetReps
  if (n) parts.push(reps !== undefined && reps !== null ? `${n} × ${reps}` : `${n} série${n > 1 ? 's' : ''}`)
  if (rows.some((r) => r.isTop)) parts.push('+ top single')
  if (meta.rirLabel !== undefined) parts.push(`RIR ${meta.rirLabel}`)
  if (meta.rest > 0) parts.push(`repos ${fmtRest(meta.rest)}`)
  else if (meta.superset) parts.push('enchaîner')
  return parts.join(' · ')
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`
}
