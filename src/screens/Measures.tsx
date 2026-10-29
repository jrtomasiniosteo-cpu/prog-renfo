import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppState } from '../hooks/useAppState'
import { db, type PhotoRow } from '../db/schema'
import { toISODate } from '../engine'
import { NumField, Sheet, fmtDate, fmtNum } from '../components/ui'

type Angle = PhotoRow['angle']
const ANGLES: { id: Angle; label: string }[] = [
  { id: 'face', label: 'Face' }, { id: 'profil', label: 'Profil' }, { id: 'dos', label: 'Dos' },
]
const MAX_SIDE = 1280

async function resizeImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encodage impossible'))), 'image/jpeg', 0.85))
  } finally { URL.revokeObjectURL(url) }
}

interface PhotoView { row: PhotoRow; url: string }

function usePhotoUrls(photos: PhotoRow[] | undefined): PhotoView[] {
  const [views, setViews] = useState<PhotoView[]>([])
  useEffect(() => {
    const v = (photos ?? []).map((row) => ({ row, url: URL.createObjectURL(row.blob) }))
    setViews(v)
    return () => v.forEach((x) => URL.revokeObjectURL(x.url))
  }, [photos])
  return views
}

export default function Measures({ state }: { state: AppState }) {
  const today = toISODate(new Date())
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState<number | null>(null)
  const [arm, setArm] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [full, setFull] = useState<PhotoView | null>(null)
  const [angle, setAngle] = useState<Angle>('face')
  const fileRef = useRef<HTMLInputElement>(null)

  const measures = useLiveQuery(() => db.measures.orderBy('date').reverse().toArray(), [])
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [])
  const views = usePhotoUrls(photos)

  const save = async () => {
    if (weight === null && arm === null && !note.trim()) { setErr('Renseigne au moins une valeur.'); return }
    setErr(null)
    await db.measures.add({
      date,
      ...(weight !== null ? { weight } : {}),
      ...(arm !== null ? { armCm: arm } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    setWeight(null); setArm(null); setNote('')
  }

  const pick = (a: Angle) => { setAngle(a); fileRef.current?.click() }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const blob = await resizeImage(file)
      await db.photos.add({ date, angle, blob })
      setErr(null)
    } catch (e) {
      setErr(`Photo impossible à enregistrer : ${(e as Error).message}`)
    }
  }

  const delPhoto = async (p: PhotoView) => {
    if (!window.confirm('Supprimer cette photo ?')) return
    await db.photos.delete(p.row.id!)
    setFull(null)
  }
  const delMeasure = async (id: number) => {
    if (window.confirm('Supprimer cette mesure ?')) await db.measures.delete(id)
  }

  const { lastWeight, avg7 } = useMemo(() => {
    const withW = (measures ?? []).filter((m) => m.weight !== undefined)
    if (!withW.length) return { lastWeight: null as number | null, avg7: null as number | null, lastDate: null }
    const sorted = [...withW].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
    const latest = sorted[0]
    const [y, m, d] = latest.date.split('-').map(Number)
    const lim = toISODate(new Date(y, m - 1, d - 6))
    const win = sorted.filter((x) => x.date >= lim && x.date <= latest.date)
    return { lastWeight: latest.weight!, avg7: win.reduce((s, x) => s + x.weight!, 0) / win.length }
  }, [measures])

  const bodyProtocol = state.program.tests?.body

  return (
    <div className="screen">
      <h1>Mesures</h1>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="tiny">Dernier poids</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{lastWeight !== null ? `${fmtNum(lastWeight)} kg` : '—'}</div>
        </div>
        <div className="card" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="tiny">Moyenne 7 jours</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{avg7 !== null ? `${fmtNum(avg7)} kg` : '—'}</div>
        </div>
      </div>

      <div className="card">
        <h2>Nouvelle mesure</h2>
        <div className="stack">
          <div>
            <label htmlFor="m-date">Date</label>
            <input id="m-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div className="grid2">
            <NumField label="Poids à jeun (kg)" value={weight} onChange={setWeight} step={0.1} inputMode="decimal" />
            <NumField label="Tour de bras (cm)" value={arm} onChange={setArm} step={0.5} inputMode="decimal" />
          </div>
          <div>
            <label htmlFor="m-note">Note</label>
            <textarea id="m-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <div className="banner danger">{err}</div>}
          <button type="button" className="btn-primary btn-block" onClick={save}>Enregistrer</button>
          {bodyProtocol && <p className="tiny" style={{ margin: 0 }}>{bodyProtocol}</p>}
        </div>
      </div>

      <div className="card">
        <h2>Photos</h2>
        <p className="tiny">Prises à la date choisie ci-dessus ({fmtDate(date)}).</p>
        <div className="grid3">
          {ANGLES.map((a) => (
            <button key={a.id} type="button" className="btn-sm" style={{ minHeight: 56 }} onClick={() => pick(a.id)}>{a.label}</button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f) }}
        />
        {views.length === 0 ? <p className="muted small" style={{ marginTop: 10 }}>Aucune photo.</p> : (
          <div className="photo-grid" style={{ marginTop: 12 }}>
            {views.map((v) => (
              <div key={v.row.id} style={{ position: 'relative' }} onClick={() => setFull(v)}>
                <img src={v.url} alt={`${v.row.angle} ${v.row.date}`} />
                <span className="chip" style={{ position: 'absolute', left: 4, bottom: 4, fontSize: 11 }}>
                  {fmtDate(v.row.date, { day: 'numeric', month: 'short' })} · {v.row.angle}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Historique</h2>
        {!measures || measures.length === 0 ? <p className="muted small">Aucune mesure.</p> : (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Poids</th><th>Bras</th><th /></tr></thead>
            <tbody>
              {measures.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.date, { day: 'numeric', month: 'short', year: '2-digit' })}{m.note && <div className="tiny">{m.note}</div>}</td>
                  <td>{m.weight !== undefined ? `${fmtNum(m.weight)} kg` : '—'}</td>
                  <td>{m.armCm !== undefined ? `${fmtNum(m.armCm)} cm` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn-danger btn-sm" aria-label="Supprimer" onClick={() => delMeasure(m.id!)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!full} onClose={() => setFull(null)} title={full ? `${full.row.angle} · ${fmtDate(full.row.date, { day: 'numeric', month: 'long', year: 'numeric' })}` : undefined}>
        {full && (
          <>
            <img src={full.url} alt={full.row.angle} style={{ width: '100%', borderRadius: 12 }} />
            <button type="button" className="btn-danger btn-block" style={{ marginTop: 12 }} onClick={() => delPhoto(full)}>Supprimer la photo</button>
          </>
        )}
      </Sheet>
    </div>
  )
}
