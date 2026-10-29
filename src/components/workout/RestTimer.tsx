/** Minuteur de repos fixé en bas d'écran. Cible absolue (Date.now()) → fiable après verrouillage. */
import { useEffect, useRef, useState } from 'react'
import { vibrate } from '../ui'

const OVERTIME_MS = 20_000

function fmt(ms: number): string {
  const neg = ms < 0
  const total = Math.ceil(Math.abs(ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${neg ? '−' : ''}${m}:${String(s).padStart(2, '0')}`
}

export function RestTimer({ end, onChange }: { end: number | null; onChange: (end: number | null) => void }) {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef<number | null>(null)

  useEffect(() => {
    if (end === null) return
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 250)
    // au réveil de l'écran, recalcule tout de suite
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick) }
  }, [end])

  const left = end === null ? 0 : end - now

  useEffect(() => {
    if (end === null) return
    if (left <= 0 && fired.current !== end) {
      fired.current = end
      if (left > -OVERTIME_MS) vibrate([200, 100, 200])
    }
    if (left <= -OVERTIME_MS) onChange(null)
  }, [left, end, onChange])

  if (end === null || left <= -OVERTIME_MS) return null
  const over = left <= 0
  return (
    <div className={`timer${over ? ' over' : ''}`} role="timer" aria-live="polite">
      <span className="t">{fmt(left)}</span>
      <button type="button" className="btn-sm" onClick={() => onChange(Math.max(end, Date.now()) + 30_000)}>+30 s</button>
      <button type="button" className="btn-sm btn-danger" onClick={() => onChange(null)}>Stop</button>
    </div>
  )
}
