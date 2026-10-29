/** Poids de corps : mesures brutes + moyenne glissante 7 jours. */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { rollingAverage } from '../../engine'
import type { MeasureRow } from '../../db/schema'
import { fmtKg, fmtNum } from '../ui'
import { CHART_HEIGHT, Empty, Section, axisProps, tooltipProps } from './chartParts'
import { COLORS, TIME_DOMAIN, fmtDM, toTime } from './helpers'

export default function BodyweightSection({ measures }: { measures: MeasureRow[] }) {
  const pts = measures
    .filter((m) => typeof m.weight === 'number' && m.weight > 0)
    .map((m) => ({ date: m.date.slice(0, 10), value: m.weight as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const avg = rollingAverage(pts, 7)
  const data = pts.map((p, i) => ({ t: toTime(p.date), raw: p.value, avg: avg[i]?.value }))
  const lastAvg = avg[avg.length - 1]?.value
  return (
    <Section title="Poids de corps" right={lastAvg !== undefined && <span className="small muted">moy. 7 j {fmtKg(lastAvg)}</span>}>
      {!data.length ? <Empty /> : (
        <>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="time" domain={TIME_DOMAIN} tickFormatter={fmtDM} {...axisProps} />
              <YAxis domain={['auto', 'auto']} {...axisProps} width={40} tickFormatter={(v: number) => fmtNum(v, 1)} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [fmtKg(typeof v === 'number' ? v : null), n === 'avg' ? 'moyenne 7 j' : 'mesure']} />
              <Line dataKey="raw" stroke="none" dot={{ r: 3, fill: COLORS.muted, stroke: 'none' }} isAnimationActive={false} />
              <Line type="linear" dataKey="avg" stroke={COLORS.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="row wrap small muted" style={{ gap: 14, marginTop: 4 }}>
            <span><span style={{ color: COLORS.muted }}>●</span> mesure</span>
            <span><span style={{ color: COLORS.accent }}>━</span> moyenne 7 jours</span>
          </div>
        </>
      )}
    </Section>
  )
}
