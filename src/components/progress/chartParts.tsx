/** Réglages recharts communs (thème sombre). */
import type { ReactNode } from 'react'
import { COLORS, fmtDM } from './helpers'

export const CHART_HEIGHT = 220

export const axisProps = {
  stroke: COLORS.grid,
  tick: { fill: COLORS.text, fontSize: 12 },
  tickLine: false,
} as const

export const tooltipProps = {
  contentStyle: { background: COLORS.bg2, border: `1px solid ${COLORS.grid}`, borderRadius: 10, color: '#f2f3f5' },
  labelStyle: { color: COLORS.text },
  labelFormatter: (t: unknown) => (typeof t === 'number' ? fmtDM(t) : String(t)),
} as const

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Empty() {
  return <p className="muted small" style={{ margin: 0 }}>Pas encore de données.</p>
}

/** Point de courbe : gros point cerclé pour un test, petit point sinon. */
export function markDot(color: string, isTest: (payload: Record<string, unknown>) => boolean) {
  return function Dot(props: { cx?: number; cy?: number; payload?: Record<string, unknown>; index?: number; value?: unknown }) {
    const { cx, cy, payload, index } = props
    if (cx === undefined || cy === undefined || cx === null || cy === null || props.value === undefined || props.value === null) {
      return <g key={`d${index}`} />
    }
    return payload && isTest(payload)
      ? <circle key={`d${index}`} cx={cx} cy={cy} r={6} fill={color} stroke="#f2f3f5" strokeWidth={2} />
      : <circle key={`d${index}`} cx={cx} cy={cy} r={2.5} fill={color} stroke="none" />
  }
}
