/** Calculs de l'écran Progression (purs, à partir des lignes de la base). */
import { directSetsByMuscle, type ProgramWeek, type WeeklyRef } from '../../engine'
import type { RefRow, SessionRow, SetRow, TestRow } from '../../db/schema'
import type { Muscle } from '../../types/program'

export const COLORS = {
  squat: '#f59e0b',
  bench: '#60a5fa',
  other: '#a7adb8',
  grid: '#2b2f38',
  text: '#a7adb8',
  muted: '#6b7280',
  accent: '#f59e0b',
  ok: '#22c55e',
  warn: '#f97316',
  bg2: '#17191f',
}

export function liftColor(lift: string): string {
  return lift === 'squat' ? COLORS.squat : lift === 'bench' ? COLORS.bench : COLORS.other
}

const DAY = 86400000

/** Date ISO (aaaa-mm-jj) → timestamp local minuit. */
export function toTime(iso: string): number {
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).getTime()
}
export function fmtDM(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
/** Domaine X avec 3 jours de marge (évite un domaine nul quand il n'y a qu'un point). */
export const TIME_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => min - 3 * DAY, (max) => max + 3 * DAY,
]

export function byDateThenId<T extends { date: string; id?: number }>(a: T, b: T): number {
  return a.date.localeCompare(b.date) || ((a.id ?? 0) - (b.id ?? 0))
}

/**
 * Historique hebdo d'une référence pour isPlateau : dernière valeur par weekIndex ≥ 0,
 * semaines sans ligne = valeur précédente reportée (référence init/antérieure comme point de départ).
 */
export function weeklyHistory(rows: RefRow[], lift: string, weeks: ProgramWeek[], uptoIndex: number): WeeklyRef[] {
  const sorted = rows.filter((r) => r.lift === lift).sort(byDateThenId)
  const byWeek = new Map<number, number>()
  let carry: number | undefined
  for (const r of sorted) {
    if (r.weekIndex < 0) carry = r.e1rm
    else byWeek.set(r.weekIndex, r.e1rm)
  }
  const out: WeeklyRef[] = []
  for (let w = 0; w <= uptoIndex; w++) {
    if (byWeek.has(w)) carry = byWeek.get(w)
    if (carry === undefined) continue
    const week = weeks.find((x) => x.index === w)
    out.push({ weekIndex: w, e1rm: carry, isDeload: week?.isDeload ?? false })
  }
  return out
}

export interface E1rmRow { t: number; [k: string]: number | boolean | undefined }

/** Données fusionnées par date pour la courbe e1RM : row[lift] = valeur, row[lift + '_test'] = point de test. */
export function e1rmSeries(rows: RefRow[], lifts: string[]): E1rmRow[] {
  const map = new Map<number, E1rmRow>()
  for (const r of [...rows].sort(byDateThenId)) {
    if (!lifts.includes(r.lift)) continue
    const t = toTime(r.date)
    const row = map.get(t) ?? { t }
    row[r.lift] = r.e1rm
    if (r.source === 'test') row[r.lift + '_test'] = true
    map.set(t, row)
  }
  return [...map.values()].sort((a, b) => a.t - b.t)
}

export interface Point { t: number; value: number; test?: boolean }

/** CMJ : tests + meilleur CMJ max (plio) par séance, max par date. */
export function cmjSeries(tests: TestRow[], sessions: SessionRow[], sets: SetRow[]): Point[] {
  const map = new Map<number, Point>()
  const put = (t: number, value: number, test: boolean) => {
    const p = map.get(t)
    if (!p || value > p.value) map.set(t, { t, value, test: test || p?.test })
    else if (test) p.test = true
  }
  for (const r of tests) if (r.kind === 'cmj') put(toTime(r.date), r.value, true)
  const dateOf = new Map(sessions.map((s) => [s.id!, s.date]))
  const best = new Map<number, number>()
  for (const s of sets) {
    if (s.kind !== 'plyo' || s.exerciseKey !== 'plyo:CMJ max' || !s.done || !s.measureCm) continue
    best.set(s.sessionId, Math.max(best.get(s.sessionId) ?? 0, s.measureCm))
  }
  for (const [sid, v] of best) {
    const d = dateOf.get(sid)
    if (d) put(toTime(d), v, false)
  }
  return [...map.values()].sort((a, b) => a.t - b.t)
}

export function testSeries(tests: TestRow[], kind: TestRow['kind']): Point[] {
  const map = new Map<number, Point>()
  for (const r of tests) {
    if (r.kind !== kind) continue
    const t = toTime(r.date)
    const p = map.get(t)
    if (!p || r.value > p.value) map.set(t, { t, value: r.value, test: true })
  }
  return [...map.values()].sort((a, b) => a.t - b.t)
}

/** Séries directes par muscle pour chaque semaine du programme ayant au moins une séance terminée. */
export function weeklyVolume(sessions: SessionRow[], sets: SetRow[]): Map<number, Record<Muscle, number>> {
  const weekOf = new Map(sessions.filter((s) => s.status === 'done').map((s) => [s.id!, s.weekIndex]))
  const doneByWeek = new Map<number, SetRow[]>()
  for (const w of new Set(weekOf.values())) doneByWeek.set(w, [])
  for (const s of sets) {
    const w = weekOf.get(s.sessionId)
    if (w === undefined || !s.done) continue
    doneByWeek.get(w)!.push(s)
  }
  const out = new Map<number, Record<Muscle, number>>()
  for (const [w, ss] of [...doneByWeek.entries()].sort((a, b) => a[0] - b[0])) out.set(w, directSetsByMuscle(ss))
  return out
}
