/** Résolution d'une séance planifiée à partir du programme et de l'état. Module pur. */
import type {
  AccessoryExercise, Exercise, LoadKind, MainPrescription, Measure, Muscle, PlyoPrescription,
  Program, SessionType, TestKind,
} from '../types/program'
import type { ProgramWeek } from './calendar'
import { nextAccessoryTarget, type AccessoryHistory } from './accessories'
import { deloadPrescription, mainLoad, rirLabel, rpeLoad } from './loads'

export interface PlannedSet {
  load: number | null
  reps: number | null
  rir: number | null
  /** série « top single » @ RPE */
  isTop?: boolean
}

export type PlannedKind = 'main' | 'accessory' | 'plyo' | 'test'

export interface PlannedExercise {
  /** identifiant stable pour le journal (exerciseId, ou `plyo:<nom>`, ou `test:<kind>:<lift>`) */
  key: string
  exerciseId?: string
  name: string
  kind: PlannedKind
  lift?: string
  loadKind?: LoadKind
  sets: PlannedSet[]
  rest: number
  note?: string
  rirLabel?: string
  targetRir?: number
  repsRange?: [number, number]
  superset?: string
  measure?: Measure
  muscles: Muscle[]
  /** variante bodyweight en cours */
  progressionName?: string
  progressionIndex?: number
  /** série principale pour la règle RIR / référence */
  isReferenceLift?: boolean
  /** protocole de test (texte) */
  protocol?: string
  testKind?: TestKind
  pct?: number
}

export interface SessionPlan {
  type: SessionType
  name: string
  place: string
  warmup: string
  weekKey: string
  isDeload: boolean
  isTest: boolean
  tests: TestKind[]
  minimal: boolean
  exercises: PlannedExercise[]
}

export interface PlanInput {
  program: Program
  week: ProgramWeek
  type: SessionType
  /** e1RM de référence par lift */
  refs: Record<string, number>
  /** dernière séance de chaque accessoire */
  accessoryHistory: Record<string, AccessoryHistory | null>
  minimal?: boolean
  /** macro 3 : semaine à une seule séance → A + bench_volume */
  singleSession?: boolean
}

const SLOT_TOKENS = ['LOWER_ACC', 'ROW', 'PRESS', 'DIP']

/** Le bench lourd (séance A) est le seul à mettre à jour la référence bench ; le squat aussi. */
export function isReferenceExercise(exerciseId: string): boolean {
  return exerciseId === 'squat' || exerciseId === 'bench_heavy'
}

function expandOrder(program: Program, week: ProgramWeek, order: string[]): string[] {
  const slots = program.slots[week.macro.slots] ?? {}
  const drop = new Set(week.block.dropExercises ?? [])
  const out: string[] = []
  for (const token of order) {
    if (drop.has(token)) continue
    if (token === 'PLYO_A') { out.push('PLYO_A'); continue }
    if (SLOT_TOKENS.includes(token)) {
      const id = slots[token]
      if (id && !drop.has(id)) out.push(id)
      continue
    }
    out.push(token)
  }
  return out
}

function plyoFromBlock(week: ProgramWeek): PlannedExercise[] {
  const rules = week.macro.rules
  let plyos: PlyoPrescription[] = week.block.plyo.map((p) => ({ ...p }))
  if (week.isDeload) plyos = plyos.map((p) => ({ ...p, sets: Math.ceil(p.sets / 2) }))
  if (rules?.plyoContactsMax) {
    // réduit les séries jusqu'à tenir sous le plafond de contacts
    let contacts = plyos.reduce((a, p) => a + p.sets * p.reps, 0)
    let i = plyos.length - 1
    while (contacts > rules.plyoContactsMax && plyos.some((p) => p.sets > 1)) {
      if (plyos[i].sets > 1) { plyos[i].sets--; contacts -= plyos[i].reps }
      i = (i - 1 + plyos.length) % plyos.length
    }
  }
  return plyos.map((p) => ({
    key: `plyo:${p.name}`,
    name: p.name,
    kind: 'plyo',
    sets: Array.from({ length: p.sets }, () => ({ load: null, reps: p.reps, rir: null })),
    rest: 60,
    measure: p.measure,
    muscles: [],
  }))
}

function mainExercise(
  input: PlanInput, id: string, ex: Extract<Exercise, { type: 'main' }>,
): PlannedExercise | null {
  const { week, refs } = input
  let p: MainPrescription | undefined = week.block.main[id]
  if (!p) return null
  if (week.isDeload) p = deloadPrescription(p)
  const maxSets = week.macro.rules?.mainSetsMax
  const sets = maxSets ? Math.min(p.sets, maxSets) : p.sets
  const ref = refs[ex.lift]
  const load = ref ? mainLoad(ref, p.pct) : null
  const planned: PlannedSet[] = []
  if (p.top && ref) planned.push({ load: rpeLoad(ref, p.top.rpe), reps: p.top.reps, rir: null, isTop: true })
  for (let i = 0; i < sets; i++) planned.push({ load, reps: p.reps, rir: p.rir })
  return {
    key: id,
    exerciseId: id,
    name: ex.name,
    kind: 'main',
    lift: ex.lift,
    loadKind: 'barbell',
    sets: planned,
    rest: ex.rest,
    note: [ex.note, p.top ? `Top single @ RPE ${p.top.rpe} (charge indicative, corrige-la)` : null]
      .filter(Boolean).join(' · ') || undefined,
    rirLabel: rirLabel(p.rir),
    targetRir: p.rir,
    muscles: ex.muscles,
    isReferenceLift: isReferenceExercise(id),
    pct: p.pct,
  }
}

function accessoryExercise(input: PlanInput, id: string, ex: AccessoryExercise): PlannedExercise {
  const { week, accessoryHistory } = input
  const setCount = week.macro.rules?.accessorySets ?? ex.sets
  const t = nextAccessoryTarget(ex, accessoryHistory[id] ?? null, setCount)
  const progressionName = ex.progressions?.[t.progressionIndex]
  return {
    key: id,
    exerciseId: id,
    name: ex.name,
    kind: 'accessory',
    loadKind: ex.load,
    sets: t.targetReps.map((r) => ({ load: t.load, reps: r, rir: ex.rir })),
    rest: ex.rest,
    rirLabel: rirLabel(ex.rir),
    targetRir: ex.rir,
    repsRange: ex.reps,
    superset: ex.superset,
    muscles: ex.muscles,
    progressionName,
    progressionIndex: t.progressionIndex,
    note: t.progressed ? 'Progression validée la dernière fois' : undefined,
  }
}

function plyoExercise(week: ProgramWeek, id: string, ex: Extract<Exercise, { type: 'plyo' }>): PlannedExercise {
  const sets = week.isDeload ? Math.ceil(ex.sets / 2) : ex.sets
  return {
    key: id,
    exerciseId: id,
    name: ex.name,
    kind: 'plyo',
    sets: Array.from({ length: sets }, () => ({ load: null, reps: ex.reps, rir: null })),
    rest: ex.rest,
    measure: ex.measure,
    muscles: [],
  }
}

/** Séance A en semaine de test : le protocole remplace la prescription. */
function testExercises(input: PlanInput): PlannedExercise[] {
  const { program, week } = input
  const out: PlannedExercise[] = []
  for (const kind of week.tests) {
    const protocol = program.tests[kind]
    switch (kind) {
      case 'e1rm':
        for (const [lift, def] of Object.entries(program.mainLifts)) {
          out.push({
            key: `test:e1rm:${lift}`, name: `Test e1RM — ${def.name}`, kind: 'test', testKind: 'e1rm',
            lift, loadKind: 'barbell', sets: [{ load: null, reps: null, rir: 1 }], rest: 180,
            protocol, muscles: [], isReferenceLift: true, targetRir: 1, rirLabel: '1',
          })
        }
        break
      case 'bench_1rm':
        out.push({
          key: 'test:bench_1rm:bench', name: 'Test 1RM — Développé couché', kind: 'test', testKind: 'bench_1rm',
          lift: 'bench', loadKind: 'barbell', sets: [{ load: null, reps: 1, rir: 0 }], rest: 240,
          protocol, muscles: [], isReferenceLift: true, targetRir: 0, rirLabel: '0',
        })
        break
      case 'cmj':
        out.push({
          key: 'test:cmj', name: 'Test CMJ', kind: 'test', testKind: 'cmj', measure: 'cm',
          sets: [1, 2, 3].map(() => ({ load: null, reps: 1, rir: null })), rest: 60, protocol, muscles: [],
        })
        break
      case 'pullups':
        out.push({
          key: 'test:pullups', name: 'Test tractions max', kind: 'test', testKind: 'pullups',
          sets: [{ load: 0, reps: null, rir: 0 }], rest: 180, protocol, muscles: ['dos', 'biceps'], loadKind: 'bodyweight',
        })
        break
      case 'body':
        // saisi dans l'écran Mesures : simple rappel
        out.push({
          key: 'test:body', name: 'Mesures (écran Mesures)', kind: 'test', testKind: 'body',
          sets: [], rest: 0, protocol, muscles: [],
        })
        break
    }
  }
  return out
}

/** Construit la séance planifiée. */
export function planSession(input: PlanInput): SessionPlan {
  const { program, week, type } = input
  const def = program.sessions[type]
  const isTestA = type === 'A' && week.tests.length > 0
  const minimal = !!input.minimal && def.minimal !== null
  const base: Omit<SessionPlan, 'exercises'> = {
    type, name: def.name, place: def.place, warmup: def.warmup, weekKey: week.key,
    isDeload: week.isDeload && !isTestA, isTest: isTestA, tests: isTestA ? week.tests : [], minimal,
  }

  if (isTestA) return { ...base, exercises: testExercises(input) }

  const order = expandOrder(program, week, minimal && def.minimal ? def.minimal : def.order)
  const exercises: PlannedExercise[] = []
  for (const id of order) {
    if (id === 'PLYO_A') { exercises.push(...plyoFromBlock(week)); continue }
    const ex = program.exercises[id]
    if (!ex) continue
    if (ex.type === 'main') { const m = mainExercise(input, id, ex); if (m) exercises.push(m) }
    else if (ex.type === 'accessory') exercises.push(accessoryExercise(input, id, ex))
    else exercises.push(plyoExercise(week, id, ex))
  }

  if (input.singleSession && type === 'A' && week.macro.rules?.singleSessionWeek) {
    const bv = program.exercises['bench_volume']
    if (bv && bv.type === 'main') { const m = mainExercise(input, 'bench_volume', bv); if (m) exercises.push(m) }
  }

  return { ...base, exercises }
}

/** Pliométrie : baisse > 5 % par rapport à la meilleure série du jour → arrêter. */
export function plyoShouldStop(bestCm: number | null, currentCm: number): boolean {
  if (bestCm === null || bestCm <= 0) return false
  return currentCm < bestCm * 0.95
}
