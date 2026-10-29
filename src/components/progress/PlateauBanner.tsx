/** Bannière plateau : information seulement, aucune action automatique. */
import { isPlateau } from '../../engine'
import type { RefRow } from '../../db/schema'
import type { AppState } from '../../hooks/useAppState'
import { Banner } from '../ui'
import { weeklyHistory } from './helpers'

/** Semaine de référence : la semaine en cours, ou la dernière si le programme est terminé. */
function uptoIndex(state: AppState): number | null {
  if (state.currentWeek) return state.currentWeek.index
  if (state.position?.status === 'finished') return state.position.lastWeek.index
  return null
}

export default function PlateauBanner({ state, refs }: { state: AppState; refs: RefRow[] }) {
  const upto = uptoIndex(state)
  if (upto === null || upto < 0) return null
  const stalled = Object.entries(state.program.mainLifts)
    .filter(([lift]) => isPlateau(weeklyHistory(refs, lift, state.weeks, upto)))
  if (!stalled.length) return null
  return (
    <>
      {stalled.map(([lift, def]) => (
        <Banner key={lift} kind="warn">
          <strong>Plateau sur {def.name}</strong> — Sommeil, stress, nutrition ? Allège une semaine si besoin.
        </Banner>
      ))}
    </>
  )
}
