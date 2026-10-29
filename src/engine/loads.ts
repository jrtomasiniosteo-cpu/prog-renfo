/** Charges des mouvements principaux. Module pur. */
import type { MainPrescription } from '../types/program'

/** Arrondi inférieur au multiple de `step` (2,5 kg par défaut). */
export function roundDownTo(x: number, step = 2.5): number {
  // epsilon : 78.75/2.5 = 31.5 exact, mais 0.675*100 etc. peuvent dériver
  return Math.floor(x / step + 1e-9) * step
}

/** charge = arrondi_inférieur_au_2,5(e1RM_référence × pct) */
export function mainLoad(refE1rm: number, pct: number): number {
  return roundDownTo(refE1rm * pct)
}

/** Semaine allégée : séries = ceil(séries / 2), pct × 0,9. */
export function deloadPrescription(p: MainPrescription): MainPrescription {
  const { top: _top, ...rest } = p // pas de top single en semaine allégée
  void _top
  return { ...rest, sets: Math.ceil(p.sets / 2), pct: Math.round(p.pct * 0.9 * 10000) / 10000 }
}

/** Coefficient e1RM pour une prescription en RPE (single). */
export function rpeFactor(rpe: number): number {
  if (rpe >= 9) return 0.96
  if (rpe >= 8.5) return 0.93
  if (rpe >= 8) return 0.9
  return 0.87
}

/** Charge proposée pour un single @ RPE (à corriger par l'athlète). */
export function rpeLoad(refE1rm: number, rpe: number): number {
  return roundDownTo(refE1rm * rpeFactor(rpe))
}

/** `rir: 2.5` → « 2-3 », `1.5` → « 1-2 », `2` → « 2 ». */
export function rirLabel(rir: number): string {
  return Number.isInteger(rir) ? String(rir) : `${Math.floor(rir)}-${Math.ceil(rir)}`
}
