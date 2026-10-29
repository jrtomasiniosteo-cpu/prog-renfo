/** Types du fichier program.json. Aucune logique ici. */

export type SessionType = 'A' | 'B' | 'C'
export type Weekday =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type LiftId = string // 'squat' | 'bench' (extensible via import)
export type Muscle = 'dos' | 'pecs' | 'épaules' | 'biceps' | 'triceps' | 'jambes'
export type Measure = 'box_cm' | 'cm' | 'none'
export type LoadKind = 'barbell' | 'dumbbell' | 'added' | 'bodyweight' | 'fixed' | 'band'
export type TestKind = 'e1rm' | 'bench_1rm' | 'cmj' | 'pullups' | 'body'

export interface MainLiftDef { name: string; default_e1rm: number; weeklyCap: number }

export interface MainExercise {
  name: string; type: 'main'; lift: LiftId; rest: number; note?: string; muscles: Muscle[]
}
export interface AccessoryExercise {
  name: string; type: 'accessory'; load: LoadKind
  sets: number; reps: [number, number]; rir: number; inc?: number; rest: number
  superset?: string; muscles: Muscle[]
  progressions?: string[]; startProgression?: number; fixedLoad?: number
}
export interface PlyoExercise {
  name: string; type: 'plyo'; sets: number; reps: number; rest: number; measure: Measure
}
export type Exercise = MainExercise | AccessoryExercise | PlyoExercise

export interface SessionDef {
  name: string; place: string; warmup: string
  order: string[]; minimal: string[] | null; skippable?: boolean
}

export interface MainPrescription {
  sets: number; reps: number; pct: number; rir: number
  top?: { reps: number; rpe: number }
}
export interface PlyoPrescription { name: string; sets: number; reps: number; measure: Measure }

export interface Block {
  id: string; name: string; weeks: [number, number]
  deloadWeek?: number
  testWeeks?: Record<string, TestKind[]>
  dropExercises?: string[]
  main: Record<string, MainPrescription>
  plyo: PlyoPrescription[]
}

export interface MacroRules {
  sessions?: SessionType[]; dropSession?: SessionType
  mainSetsMax?: number; accessorySets?: number; plyoContactsMax?: number
  singleSessionWeek?: string
}

export interface Macrocycle {
  id: string; name: string; weeks: number; slots: string; goal?: string
  rules?: MacroRules; blocks: Block[]
}

export interface Program {
  startDate: string
  defaultDays: Record<SessionType, Weekday>
  mainLifts: Record<LiftId, MainLiftDef>
  tests: Record<TestKind, string>
  exercises: Record<string, Exercise>
  sessions: Record<SessionType, SessionDef>
  slots: Record<string, Record<string, string>>
  macrocycles: Macrocycle[]
}
