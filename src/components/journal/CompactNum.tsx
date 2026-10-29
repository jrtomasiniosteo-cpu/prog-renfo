/** Champ numérique compact pour l'édition du journal (4 colonnes tiennent sur un téléphone). */
import { useEffect, useState } from 'react'

export default function CompactNum({ label, value, onCommit, decimal = false }: {
  label: string
  value: number | null
  onCommit: (v: number | null) => void
  decimal?: boolean
}) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','))
  useEffect(() => { setText(value === null ? '' : String(value).replace('.', ',')) }, [value])
  const commit = () => {
    const t = text.trim()
    const n = t === '' ? null : Number(t.replace(',', '.'))
    if (n !== null && (Number.isNaN(n) || n < 0)) { setText(value === null ? '' : String(value).replace('.', ',')); return }
    if (n !== value) onCommit(n)
  }
  return (
    <label style={{ margin: 0, minWidth: 0 }}>
      <span className="tiny" style={{ display: 'block', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={text}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        onFocus={(e) => e.target.select()}
        style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, minHeight: 48, padding: '0 4px' }}
      />
    </label>
  )
}
