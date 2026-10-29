/** e1RM des mouvements de référence dans le temps (table refs, toutes sources). */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RefRow } from '../../db/schema'
import type { AppState } from '../../hooks/useAppState'
import { fmtKg, fmtNum } from '../ui'
import { toISODate } from '../../engine'
import { CHART_HEIGHT, Empty, Section, axisProps, markDot, tooltipProps } from './chartParts'
import { COLORS, TIME_DOMAIN, e1rmSeries, fmtDM, liftColor } from './helpers'

export default function E1rmSection({ state, refs }: { state: AppState; refs: RefRow[] }) {
  const lifts = Object.keys(state.program.mainLifts)
  // Les références initiales sont datées « depuis toujours » : on les affiche au début du programme.
  const startDate = state.weeks[0] ? toISODate(state.weeks[0].start) : state.program.startDate
  const data = e1rmSeries(refs.map((r) => (r.source === 'init' ? { ...r, date: startDate } : r)), lifts)
  const name = (l: string) => state.program.mainLifts[l]?.name ?? l

  return (
    <Section title="e1RM">
      <div className="grid2" style={{ marginBottom: 10 }}>
        {lifts.map((l) => (
          <div key={l}>
            <div className="tiny">{name(l)}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: liftColor(l), fontVariantNumeric: 'tabular-nums' }}>
              {fmtKg(state.refs[l] !== undefined ? Math.round(state.refs[l] * 10) / 10 : null)}
            </div>
          </div>
        ))}
      </div>
      {data.length < 1 ? <Empty /> : (
        <>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="time" domain={TIME_DOMAIN} tickFormatter={fmtDM} {...axisProps} />
              <YAxis domain={['auto', 'auto']} {...axisProps} width={40} tickFormatter={(v: number) => fmtNum(v, 1)} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [fmtKg(typeof v === 'number' ? Math.round(v * 10) / 10 : null), name(String(n))]} />
              {lifts.map((l) => (
                <Line
                  key={l}
                  type="monotone"
                  dataKey={l}
                  name={l}
                  stroke={liftColor(l)}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                  dot={markDot(liftColor(l), (p) => p[l + '_test'] === true)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="row wrap small muted" style={{ gap: 14, marginTop: 4 }}>
            {lifts.map((l) => <span key={l}><span style={{ color: liftColor(l) }}>━</span> {name(l)}</span>)}
            <span><span style={{ fontSize: 18, lineHeight: 1 }}>●</span> test</span>
          </div>
        </>
      )}
    </Section>
  )
}
