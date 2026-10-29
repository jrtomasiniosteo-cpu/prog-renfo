/** Volume et résumé de séance. Module pur. */
import type { Muscle } from '../types/program'

export const MUSCLES: Muscle[] = ['dos', 'pecs', 'épaules', 'biceps', 'triceps', 'jambes']
export const UPPER_BODY: Muscle[] = ['dos', 'pecs', 'épaules', 'biceps', 'triceps']

export interface DoneSet {
  muscles: Muscle[]
  reps: number | null
  load: number | null
  /** plio exclue du volume en séries directes */
  kind: 'main' | 'accessory' | 'plyo' | 'test'
}

/** Séries directes par groupe musculaire (une série compte pour chaque muscle listé). */
export function directSetsByMuscle(sets: DoneSet[]): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const s of sets) {
    if (s.kind === 'plyo' || !s.reps || s.reps <= 0) continue
    for (const m of s.muscles) out[m] = (out[m] ?? 0) + 1
  }
  return out
}

/** Tonnage = Σ charge × reps (séries avec charge > 0). */
export function tonnage(sets: DoneSet[]): number {
  return sets.reduce((a, s) => a + ((s.load ?? 0) > 0 && s.reps ? (s.load as number) * s.reps : 0), 0)
}

/** Moyenne glissante sur `days` jours (séries datées, triées). */
export function rollingAverage(points: { date: string; value: number }[], days = 7): { date: string; value: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((p, i) => {
    const from = new Date(p.date).getTime() - (days - 1) * 86400000
    const win = sorted.slice(0, i + 1).filter((q) => new Date(q.date).getTime() >= from)
    return { date: p.date, value: Math.round((win.reduce((a, q) => a + q.value, 0) / win.length) * 10) / 10 }
  })
}
