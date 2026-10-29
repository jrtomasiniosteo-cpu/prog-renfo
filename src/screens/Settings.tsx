import { useState, type ChangeEvent } from 'react'
import type { AppState } from '../hooks/useAppState'
import { exportAll, importAll, downloadText } from '../db/export'
import { recomputeReferences, setManualRef, updateSettings } from '../db/logic'
import { WEEKDAYS, WEEKDAY_FR, toISODate } from '../engine'
import type { Program, SessionType, Weekday } from '../types/program'
import { Banner, NumField, fmtDate } from '../components/ui'
import ExportReminder from '../components/settings/ExportReminder'

type Msg = { kind: 'ok' | 'danger'; text: string } | null

const SESSION_TYPES: SessionType[] = ['A', 'B', 'C']

/** Validation minimale d'un program.json importé. */
function validateProgram(x: unknown): string | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return 'Le fichier doit contenir un objet JSON.'
  const p = x as Record<string, unknown>
  for (const k of ['startDate', 'exercises', 'sessions', 'macrocycles', 'mainLifts']) {
    if (p[k] === undefined || p[k] === null) return `Champ obligatoire manquant : « ${k} ».`
  }
  if (typeof p.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) return '« startDate » doit être au format AAAA-MM-JJ.'
  if (!Array.isArray(p.macrocycles) || p.macrocycles.length === 0) return '« macrocycles » doit être un tableau non vide.'
  for (const k of ['exercises', 'sessions', 'mainLifts']) {
    if (typeof p[k] !== 'object' || Array.isArray(p[k])) return `« ${k} » doit être un objet.`
  }
  return null
}

function readFile(file: File): Promise<string> {
  return file.text()
}

export default function Settings({ state }: { state: AppState }) {
  const { settings, program, refs, currentWeek } = state
  const [exportMsg, setExportMsg] = useState<Msg>(null)
  const [importMsg, setImportMsg] = useState<Msg>(null)
  const [progMsg, setProgMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, number | null>>({})
  const [savedLift, setSavedLift] = useState<string | null>(null)

  if (!settings) return <div className="screen"><p className="muted">Chargement…</p></div>

  const onExport = async () => {
    setBusy(true)
    try {
      const json = await exportAll()
      downloadText(`prog-renfo-${toISODate(new Date())}.json`, json)
      await updateSettings({ lastExportAt: new Date().toISOString() })
      setExportMsg({ kind: 'ok', text: 'Export téléchargé.' })
    } catch (e) {
      setExportMsg({ kind: 'danger', text: `Échec de l'export : ${(e as Error).message}` })
    } finally { setBusy(false) }
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await readFile(file)
      if (!window.confirm('Remplacer toutes les données locales par ce fichier ?')) return
      setBusy(true)
      const { counts } = await importAll(text)
      const summary = Object.entries(counts).map(([k, n]) => `${k} : ${n}`).join(' · ')
      setImportMsg({ kind: 'ok', text: `Import réussi. ${summary}` })
    } catch (err) {
      setImportMsg({ kind: 'danger', text: `Import impossible : ${(err as Error).message}` })
    } finally { setBusy(false) }
  }

  const onProgramFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await readFile(file))
      const problem = validateProgram(parsed)
      if (problem) { setProgMsg({ kind: 'danger', text: problem }); return }
      await updateSettings({ programOverride: parsed as Program })
      await recomputeReferences()
      setProgMsg({ kind: 'ok', text: 'Nouveau programme actif. Le journal est conservé.' })
    } catch (err) {
      setProgMsg({ kind: 'danger', text: `Fichier invalide : ${(err as Error).message}` })
    }
  }

  const onRevert = async () => {
    if (!window.confirm('Revenir au programme embarqué ? Le journal est conservé.')) return
    await updateSettings({ programOverride: null })
    await recomputeReferences()
    setProgMsg({ kind: 'ok', text: 'Programme embarqué rétabli.' })
  }

  const saveRef = async (lift: string) => {
    const v = drafts[lift]
    if (v === null || v === undefined || !(v > 0)) return
    await setManualRef(lift, v, currentWeek?.index ?? -1)
    setDrafts((d) => { const n = { ...d }; delete n[lift]; return n })
    setSavedLift(lift)
  }

  const lastExport = settings.lastExportAt
  const overridden = !!settings.programOverride

  return (
    <div className="screen">
      <h1>Réglages</h1>

      <ExportReminder settings={settings} />

      <div className="card">
        <button type="button" className="btn-primary btn-xl btn-block" disabled={busy} onClick={onExport}>
          Exporter mes données
        </button>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          {lastExport ? `Dernier export : ${fmtDate(new Date(lastExport), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Jamais exporté'}
        </p>
        {exportMsg && <Banner kind={exportMsg.kind}>{exportMsg.text}</Banner>}
      </div>

      <div className="card">
        <h2>Importer une sauvegarde</h2>
        <p className="small muted">Remplace toutes les données locales par le contenu d'un export JSON.</p>
        <input type="file" accept="application/json" onChange={onImport} disabled={busy} />
        {importMsg && <div style={{ marginTop: 10 }}><Banner kind={importMsg.kind}>{importMsg.text}</Banner></div>}
      </div>

      <div className="card">
        <h2>Date de début du programme</h2>
        <input
          type="date"
          value={settings.startDate}
          onChange={(e) => { if (e.target.value) void updateSettings({ startDate: e.target.value }) }}
        />
        <p className="tiny" style={{ marginTop: 6 }}>Les semaines sont calculées depuis le lundi de cette date.</p>
      </div>

      <div className="card">
        <h2>e1RM de référence</h2>
        <div className="stack">
          {Object.entries(program.mainLifts).map(([lift, def]) => (
            <div key={lift}>
              <div className="row between">
                <strong>{def.name}</strong>
                <span className="accent">
                  {refs[lift] !== undefined ? `${refs[lift].toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg` : '—'}
                </span>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <div className="grow">
                  <NumField
                    value={drafts[lift] ?? refs[lift] ?? null}
                    step={2.5}
                    inputMode="decimal"
                    onChange={(v) => { setSavedLift(null); setDrafts((d) => ({ ...d, [lift]: v })) }}
                  />
                </div>
                <button type="button" className="btn-primary" disabled={drafts[lift] === undefined || drafts[lift] === null} onClick={() => saveRef(lift)}>
                  Enregistrer
                </button>
              </div>
              {savedLift === lift && <p className="small ok" style={{ marginTop: 4 }}>Référence enregistrée.</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Jours de séance par défaut</h2>
        <div className="stack">
          {SESSION_TYPES.map((t) => (
            <div key={t}>
              <label htmlFor={`day-${t}`}>Séance {t}{program.sessions[t] ? ` — ${program.sessions[t].name}` : ''}</label>
              <select
                id={`day-${t}`}
                value={settings.days[t]}
                onChange={(e) => void updateSettings({ days: { ...settings.days, [t]: e.target.value as Weekday } })}
              >
                {WEEKDAYS.map((d) => <option key={d} value={d}>{WEEKDAY_FR[d]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Programme</h2>
        <p>
          Programme actif : <strong>{overridden ? 'importé' : 'embarqué'}</strong>
          {overridden && <span className="muted"> (début {fmtDate(program.startDate, { day: 'numeric', month: 'long', year: 'numeric' })})</span>}
        </p>
        <p className="small muted">
          Sert à construire le macrocycle 4 : importe un program.json complété, le journal et les références sont conservés.
        </p>
        <label htmlFor="prog-file" className="btn btn-block" style={{ color: 'var(--fg)' }}>Importer un nouveau program.json</label>
        <input id="prog-file" type="file" accept="application/json" onChange={onProgramFile} style={{ display: 'none' }} />
        {overridden && (
          <button type="button" className="btn-danger btn-block" style={{ marginTop: 10 }} onClick={onRevert}>
            Revenir au programme embarqué
          </button>
        )}
        {progMsg && <div style={{ marginTop: 10 }}><Banner kind={progMsg.kind}>{progMsg.text}</Banner></div>}
      </div>

      <p className="tiny" style={{ textAlign: 'center' }}>Prog renfo · données 100 % locales (IndexedDB)</p>
    </div>
  )
}
