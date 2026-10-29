/** Base IndexedDB (Dexie). Aucune donnée d'entraînement en localStorage. */
import Dexie, { type EntityTable } from 'dexie'
import type { Muscle, Program, SessionType, TestKind, Weekday } from '../types/program'
import type { PlannedKind } from '../engine/session'

export interface SettingsRow {
  id: 'main'
  startDate: string
  days: Record<SessionType, Weekday>
  lastExportAt?: string
  /** program.json importé depuis les réglages (null = fichier embarqué) */
  programOverride?: Program | null
  /** réglé par l'utilisateur en semaine « à une séance » (macro 3) : clés de semaine */
  singleSessionWeeks?: string[]
}

export type RefSource = 'init' | 'session' | 'test' | 'manual'

export interface RefRow {
  id?: number
  lift: string
  e1rm: number
  date: string
  weekIndex: number
  source: RefSource
  sessionId?: number
}

export type SessionStatus = 'in_progress' | 'done'

export interface SessionRow {
  id?: number
  date: string
  type: SessionType
  weekKey: string
  weekIndex: number
  minimal: boolean
  isTest: boolean
  isDeload: boolean
  fatigue?: number
  sleep?: number
  note?: string
  status: SessionStatus
  startedAt: string
  finishedAt?: string
}

export interface SetRow {
  id?: number
  sessionId: number
  exerciseKey: string
  exerciseId?: string
  exerciseName: string
  kind: PlannedKind
  lift?: string
  muscles: Muscle[]
  setIndex: number
  targetLoad: number | null
  targetReps: number | null
  targetRir: number | null
  load: number | null
  reps: number | null
  rir: number | null
  /** hauteur box / CMJ en cm (plio, tests) */
  measureCm: number | null
  done: boolean
  isTop?: boolean
  /** variante bodyweight utilisée */
  progressionIndex?: number
  testKind?: TestKind
}

export interface ExerciseNoteRow {
  id?: number
  sessionId: number
  exerciseKey: string
  note: string
}

export interface TestRow {
  id?: number
  date: string
  kind: TestKind
  lift?: string
  value: number
  sessionId?: number
}

export interface MeasureRow {
  id?: number
  date: string
  weight?: number
  armCm?: number
  note?: string
}

export interface PhotoRow {
  id?: number
  date: string
  angle: 'face' | 'profil' | 'dos'
  blob: Blob
}

export interface MoveRow {
  id?: number
  weekKey: string
  type: SessionType
  weekday: Weekday
}

export class RenfoDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'id'>
  refs!: EntityTable<RefRow, 'id'>
  sessions!: EntityTable<SessionRow, 'id'>
  sets!: EntityTable<SetRow, 'id'>
  exerciseNotes!: EntityTable<ExerciseNoteRow, 'id'>
  tests!: EntityTable<TestRow, 'id'>
  measures!: EntityTable<MeasureRow, 'id'>
  photos!: EntityTable<PhotoRow, 'id'>
  moves!: EntityTable<MoveRow, 'id'>

  constructor() {
    super('prog-renfo')
    this.version(2).stores({
      settings: 'id',
      refs: '++id, lift, date, weekIndex, source, sessionId',
      sessions: '++id, date, type, weekKey, weekIndex, status',
      sets: '++id, sessionId, exerciseKey, exerciseId, [sessionId+exerciseKey]',
      exerciseNotes: '++id, sessionId, [sessionId+exerciseKey]',
      tests: '++id, date, kind, sessionId',
      measures: '++id, date',
      photos: '++id, date',
      moves: '++id, weekKey, [weekKey+type]',
    })
  }
}

export const db = new RenfoDB()

export const TABLE_NAMES = [
  'settings', 'refs', 'sessions', 'sets', 'exerciseNotes', 'tests', 'measures', 'photos', 'moves',
] as const
