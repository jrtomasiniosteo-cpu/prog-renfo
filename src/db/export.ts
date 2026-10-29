/** Export / import JSON de toute la base (photos en base64). */
import { db, TABLE_NAMES, type PhotoRow } from './schema'
import { recomputeReferences } from './logic'

export const EXPORT_VERSION = 1
export const EXPORT_REMINDER_DAYS = 14

interface ExportFile {
  app: 'prog-renfo'
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = rej
    r.readAsDataURL(b)
  })
}

async function base64ToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export async function exportAll(): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) {
    const rows = await db.table(name).toArray()
    if (name === 'photos') {
      tables[name] = await Promise.all(
        (rows as PhotoRow[]).map(async (p) => ({ ...p, blob: await blobToBase64(p.blob) })),
      )
    } else tables[name] = rows
  }
  const file: ExportFile = { app: 'prog-renfo', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), tables }
  return JSON.stringify(file)
}

/** Remplace tout le contenu de la base par le fichier. */
export async function importAll(json: string): Promise<{ counts: Record<string, number> }> {
  const file = JSON.parse(json) as ExportFile
  if (file.app !== 'prog-renfo' || !file.tables) throw new Error('Fichier non reconnu')
  const counts: Record<string, number> = {}
  await db.transaction('rw', [...TABLE_NAMES].map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear()
      let rows = (file.tables[name] ?? []) as Record<string, unknown>[]
      if (name === 'photos') {
        rows = await Promise.all(rows.map(async (p) => ({ ...p, blob: await base64ToBlob(String(p.blob)) })))
      }
      if (rows.length) await db.table(name).bulkAdd(rows)
      counts[name] = rows.length
    }
  })
  await recomputeReferences()
  return { counts }
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportDue(lastExportAt: string | undefined, now = new Date()): boolean {
  if (!lastExportAt) return true
  return now.getTime() - new Date(lastExportAt).getTime() > EXPORT_REMINDER_DAYS * 86400000
}
