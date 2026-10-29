/** Calculateur de disques. Module pur. */

export const BAR_KG = 20
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export interface PlateResult {
  /** disques par côté, du plus lourd au plus léger */
  perSide: number[]
  /** charge réellement obtenue */
  achieved: number
  /** reste non chargeable (0 si exact) */
  remainder: number
}

export function platesPerSide(total: number, bar = BAR_KG, plates = PLATES_KG): PlateResult {
  if (total <= bar) return { perSide: [], achieved: bar, remainder: 0 }
  let side = (total - bar) / 2
  const perSide: number[] = []
  for (const p of plates) {
    while (side + 1e-9 >= p) {
      perSide.push(p)
      side -= p
    }
  }
  const loaded = perSide.reduce((a, b) => a + b, 0)
  return {
    perSide,
    achieved: bar + loaded * 2,
    remainder: Math.round(side * 2 * 1000) / 1000,
  }
}

export function formatPlates(r: PlateResult): string {
  if (!r.perSide.length) return 'Barre à vide'
  return r.perSide.map((p) => String(p).replace('.', ',')).join(' + ') + ' par côté'
}
