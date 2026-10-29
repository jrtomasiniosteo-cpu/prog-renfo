/** Volume hebdo en séries directes par groupe musculaire. */
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { MUSCLES, UPPER_BODY } from '../../engine'
import type { AppState } from '../../hooks/useAppState'
import type { Muscle } from '../../types/program'
import { CHART_HEIGHT, Empty, Section, axisProps } from './chartParts'
import { COLORS } from './helpers'

const BAND: [number, number] = [10, 15]

function cellColor(m: Muscle, v: number): string | undefined {
  if (!UPPER_BODY.includes(m)) return undefined
  if (v >= BAND[0] && v <= BAND[1]) return COLORS.ok
  if (v > BAND[1]) return COLORS.warn
  return undefined
}

export default function VolumeSection({ state, volume }: { state: AppState; volume: Map<number, Record<Muscle, number>> }) {
  const weekIdx = [...volume.keys()].sort((a, b) => a - b)
  const cur = state.currentWeek?.index
  const initial = cur !== undefined && volume.has(cur) ? cur : weekIdx[weekIdx.length - 1]
  const [picked, setPicked] = useState<number | undefined>(undefined)
  const sel = picked !== undefined && volume.has(picked) ? picked : initial

  if (sel === undefined) return <Section title="Volume hebdo"><Empty /></Section>

  const pos = weekIdx.indexOf(sel)
  const week = state.weeks.find((w) => w.index === sel)
  const v = volume.get(sel)!
  const data = MUSCLES.map((m) => ({ muscle: m, sets: v[m] ?? 0 }))
  const yMax = Math.max(BAND[1] + 2, ...data.map((d) => d.sets + 1))
  const lastSix = weekIdx.slice(-6)
  const upperFirst = UPPER_BODY[0]
  const upperLast = UPPER_BODY[UPPER_BODY.length - 1]

  return (
    <Section title="Volume hebdo">
      <div className="row between" style={{ marginBottom: 6 }}>
        <button type="button" className="btn-sm" disabled={pos <= 0} onClick={() => setPicked(weekIdx[pos - 1])} aria-label="Semaine précédente">‹</button>
        <div style={{ textAlign: 'center' }}>
          <strong>S{sel + 1}{sel === cur ? ' (en cours)' : ''}</strong>
          {week && <div className="tiny">{week.label}{week.isDeload ? ' · allégée' : ''}</div>}
        </div>
        <button type="button" className="btn-sm" disabled={pos >= weekIdx.length - 1} onClick={() => setPicked(weekIdx[pos + 1])} aria-label="Semaine suivante">›</button>
      </div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 18, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <ReferenceArea x1={upperFirst} x2={upperLast} y1={BAND[0]} y2={BAND[1]} fill={COLORS.ok} fillOpacity={0.12} stroke="none" ifOverflow="extendDomain" />
          <XAxis dataKey="muscle" {...axisProps} interval={0} tick={{ fill: COLORS.text, fontSize: 11 }} />
          <YAxis domain={[0, yMax]} allowDecimals={false} {...axisProps} width={32} />
          <Bar dataKey="sets" isAnimationActive={false} radius={[4, 4, 0, 0]}>
            {data.map((d) => <Cell key={d.muscle} fill={UPPER_BODY.includes(d.muscle) ? COLORS.other : COLORS.muted} />)}
            <LabelList dataKey="sets" position="top" fill={COLORS.text} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="tiny" style={{ margin: '4px 0 10px' }}>
        Bande verte : 10-15 séries directes par semaine, cible pour le haut du corps ({UPPER_BODY.join(', ')}). Les jambes n'ont pas de cible ici.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Muscle</th>
              {lastSix.map((w) => <th key={w} style={{ textAlign: 'center', color: w === sel ? COLORS.accent : undefined }}>S{w + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {MUSCLES.map((m) => (
              <tr key={m}>
                <td>{m}</td>
                {lastSix.map((w) => {
                  const n = volume.get(w)?.[m] ?? 0
                  return <td key={w} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: cellColor(m, n), fontWeight: w === sel ? 700 : undefined }}>{n}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
