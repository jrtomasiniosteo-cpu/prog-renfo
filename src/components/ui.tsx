/** Composants partagés : champ numérique à gros boutons, échelle 1-5, feuille modale, formats. */
import { useEffect, useState, type ReactNode } from 'react'

export function fmtKg(x: number | null | undefined, unit = ' kg'): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return x.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + unit
}
export function fmtNum(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return x.toLocaleString('fr-FR', { maximumFractionDigits: digits })
}
export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const d = typeof iso === 'string' ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')) : iso
  return d.toLocaleDateString('fr-FR', opts)
}

interface NumFieldProps {
  label?: string
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  max?: number
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
}

/** Saisie numérique tenue d'une main : − / champ / + */
export function NumField({ label, value, onChange, step = 1, min = 0, max, placeholder, inputMode }: NumFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => { setText(value === null ? '' : String(value)) }, [value])
  const commit = (t: string) => {
    const n = t.trim() === '' ? null : Number(t.replace(',', '.'))
    onChange(n === null || Number.isNaN(n) ? null : n)
  }
  const bump = (d: number) => {
    const base = value ?? 0
    let n = Math.round((base + d) * 100) / 100
    if (max !== undefined) n = Math.min(max, n)
    n = Math.max(min, n)
    onChange(n)
  }
  return (
    <div className="numfield">
      {label && <span className="lbl">{label}</span>}
      <div className="ctl">
        <button type="button" onClick={() => bump(-step)} aria-label="moins">−</button>
        <input
          type="text"
          inputMode={inputMode ?? (Number.isInteger(step) ? 'numeric' : 'decimal')}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onFocus={(e) => e.target.select()}
          style={{ textAlign: 'center', fontSize: 22, fontWeight: 700 }}
        />
        <button type="button" onClick={() => bump(step)} aria-label="plus">+</button>
      </div>
    </div>
  )
}

/** Échelle 1-5 (fatigue, sommeil). */
export function Scale({ value, onChange, labels }: { value: number | null; onChange: (v: number) => void; labels?: [string, string] }) {
  return (
    <div>
      <div className="scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={value === n ? 'on' : ''} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      {labels && <div className="row between tiny" style={{ marginTop: 4 }}><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  )
}

/** Feuille modale bas d'écran. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
        <button type="button" className="btn-ghost btn-block" style={{ marginTop: 12 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

export function Banner({ kind, children }: { kind: 'warn' | 'ok' | 'danger' | 'info'; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern) } catch { /* iOS Safari : pas de vibration, on ignore */ }
}
