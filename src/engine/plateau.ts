/** Détection de plateau sur la référence e1RM. Module pur. */

export interface WeeklyRef { weekIndex: number; e1rm: number; isDeload: boolean }

/**
 * Plateau si, sur les 3 dernières semaines non allégées consécutives, la référence
 * n'a jamais progressé par rapport à la semaine non allégée précédente.
 * Il faut au moins 4 points (la semaine de départ + 3 semaines sans hausse).
 */
export function isPlateau(history: WeeklyRef[], window = 3): boolean {
  const byWeek = new Map<number, WeeklyRef>()
  for (const h of [...history].sort((a, b) => a.weekIndex - b.weekIndex)) byWeek.set(h.weekIndex, h)
  const pts = [...byWeek.values()].filter((h) => !h.isDeload)
  if (pts.length < window + 1) return false
  const last = pts.slice(-(window + 1))
  for (let i = 1; i < last.length; i++) {
    if (last[i].e1rm > last[i - 1].e1rm + 1e-9) return false
  }
  return true
}
