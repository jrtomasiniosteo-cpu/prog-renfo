/** Double progression des accessoires. Module pur. */
import type { AccessoryExercise } from '../types/program'

export interface AccessorySetLog { load: number | null; reps: number; rir: number }

export interface AccessoryTarget {
  /** charge proposée (lest pour `added`, kg pour barre/haltère, null si jamais fait, fixedLoad si `fixed`, 0 pour bodyweight/band) */
  load: number | null
  /** reps cibles par série */
  targetReps: number[]
  /** index dans `progressions` (bodyweight) */
  progressionIndex: number
  /** vrai si la dernière séance a validé la fourchette haute partout */
  progressed: boolean
}

export interface AccessoryHistory {
  load: number | null
  sets: AccessorySetLog[]
  progressionIndex: number
}

function initialLoad(def: AccessoryExercise): number | null {
  switch (def.load) {
    case 'fixed': return def.fixedLoad ?? null
    case 'bodyweight':
    case 'band': return 0
    default: return null // barre, haltère, lest : à saisir la première fois
  }
}

/**
 * Cible de la prochaine séance d'après la dernière.
 * - toutes les séries ≥ max reps au RIR cible ou plus facile → +inc, cible = min
 *   (bodyweight : variante suivante de `progressions`)
 * - sinon → même charge, cible = reps de la dernière fois + 1, plafonné à max
 * - jamais fait → charge vide, cible = min
 */
export function nextAccessoryTarget(
  def: AccessoryExercise,
  last: AccessoryHistory | null,
  setCount: number = def.sets,
): AccessoryTarget {
  const [min, max] = def.reps
  const startIdx = def.startProgression ?? 0

  if (!last || last.sets.length === 0) {
    return {
      load: initialLoad(def),
      targetReps: Array(setCount).fill(min),
      progressionIndex: startIdx,
      progressed: false,
    }
  }

  const allMax = last.sets.every((s) => s.reps >= max && s.rir >= def.rir)
  const idx = last.progressionIndex ?? startIdx

  if (allMax) {
    if (def.load === 'bodyweight') {
      const n = def.progressions?.length ?? 0
      const nextIdx = idx + 1 < n ? idx + 1 : idx
      // dernière variante atteinte : on reste en haut de fourchette
      const reps = nextIdx === idx ? max : min
      return { load: 0, targetReps: Array(setCount).fill(reps), progressionIndex: nextIdx, progressed: nextIdx !== idx }
    }
    if (def.load === 'fixed' || def.load === 'band') {
      return { load: last.load, targetReps: Array(setCount).fill(max), progressionIndex: idx, progressed: false }
    }
    const inc = def.inc ?? 2.5
    return { load: (last.load ?? 0) + inc, targetReps: Array(setCount).fill(min), progressionIndex: idx, progressed: true }
  }

  const targets: number[] = []
  for (let i = 0; i < setCount; i++) {
    const prev = last.sets[i] ?? last.sets[last.sets.length - 1]
    targets.push(Math.min(max, Math.max(min, prev.reps + 1)))
  }
  return { load: last.load, targetReps: targets, progressionIndex: idx, progressed: false }
}
