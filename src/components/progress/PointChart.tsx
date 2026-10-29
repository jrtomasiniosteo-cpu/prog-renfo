/** Courbe simple d'une mesure datée (CMJ, tractions). */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum } from '../ui'
import { CHART_HEIGHT, Empty, Section, axisProps, markDot, tooltipProps } from './chartParts'
import { COLORS, TIME_DOMAIN, fmtDM, type Point } from './helpers'

export default function PointChart({ title, data, unit, color = COLORS.other, showTestLegend = false }: {
  title: string
  data: Point[]
  unit: string
  color?: string
  showTestLegend?: boolean
}) {
  const last = data[data.length - 1]
  const best = data.length ? Math.max(...data.map((p) => p.value)) : null
  return (
    <Section title={title} right={last && <span className="small muted">dernier {fmtNum(last.value)} {unit} · record {fmtNum(best)} {unit}</span>}>
      {!data.length ? <Empty /> : (
        <>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" scale="time" domain={TIME_DOMAIN} tickFormatter={fmtDM} {...axisProps} />
              <YAxis domain={['auto', 'auto']} allowDecimals={false} {...axisProps} width={40} tickFormatter={(v: number) => fmtNum(v, 1)} />
              <Tooltip {...tooltipProps} formatter={(v) => [`${fmtNum(typeof v === 'number' ? v : null)} ${unit}`, title]} />
              <Line
                type="monotone" dataKey="value" stroke={color} strokeWidth={2} isAnimationActive={false}
                dot={markDot(color, (p) => showTestLegend && p.test === true)}
              />
            </LineChart>
          </ResponsiveContainer>
          {showTestLegend && <div className="small muted" style={{ marginTop: 4 }}><span style={{ fontSize: 18, lineHeight: 1 }}>●</span> test · petit point = séance</div>}
        </>
      )}
    </Section>
  )
}
