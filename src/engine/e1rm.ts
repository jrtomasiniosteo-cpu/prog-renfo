/** e1RM et mise à jour de la référence d'un mouvement principal. Module pur. */

export interface LoggedSet { load: number; reps: number; rir: number }

/** e1RM = charge × (1 + (reps + RIR) / 30) */
export function e1rm(load: number, reps: number, rir: number): number {
  return load * (1 + (reps + rir) / 30)
}

/** e1RM de la séance = max des séries valides. */
export function sessionE1rm(sets: LoggedSet[]): number | null {
  const vals = sets
    .filter((s) => s.load > 0 && s.reps > 0 && s.rir >= 0)
    .map((s) => e1rm(s.load, s.reps, s.rir))
  return vals.length ? Math.max(...vals) : null
}

export interface ReferenceUpdate {
  /** référence actuelle */
  ref: number
  /** e1RM max de la séance (null si rien de valide) */
  sessionE1rm: number | null
  /** plafond de hausse hebdo (bench 2,5, squat 5) */
  cap: number
  /** RIR cible de la série principale (fourchette déjà réduite au milieu, ex. 2.5) */
  targetRir: number
  /** RIR saisi sur la série principale (la plus lourde) */
  mainSetRir: number | null
  /** semaine de test : remplace la référence sans plafond */
  isTest?: boolean
}

/**
 * Nouvelle référence.
 * - test : e1RM de la séance, sans plafond
 * - RIR saisi ≤ RIR cible − 2 : référence × 0,95
 * - sinon, hausse plafonnée à +cap ; une séance en dessous ne baisse pas la référence
 */
export function updateReference(u: ReferenceUpdate): number {
  const { ref, cap, targetRir, mainSetRir, isTest } = u
  const s = u.sessionE1rm
  if (isTest) return s ?? ref
  if (mainSetRir !== null && mainSetRir <= targetRir - 2) return round2(ref * 0.95)
  if (s === null || s <= ref) return ref
  return round2(Math.min(s, ref + cap))
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/** Série principale = la plus lourde (puis la plus de reps). */
export function mainSet(sets: LoggedSet[]): LoggedSet | null {
  const valid = sets.filter((s) => s.load > 0 && s.reps > 0)
  if (!valid.length) return null
  return valid.reduce((a, b) => (b.load > a.load || (b.load === a.load && b.reps > a.reps) ? b : a))
}
