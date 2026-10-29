/** Bandeau de rappel d'export (tous les 14 jours). Réutilisable sur l'écran d'accueil. */
import type { SettingsRow } from '../../db/schema'
import { exportDue, EXPORT_REMINDER_DAYS } from '../../db/export'
import { Banner } from '../ui'
import { Link } from '../../router'

export default function ExportReminder({ settings }: { settings: SettingsRow | undefined }) {
  if (!settings || !exportDue(settings.lastExportAt)) return null
  return (
    <Banner kind="warn">
      Pense à exporter (tous les {EXPORT_REMINDER_DAYS} jours).{' '}
      <Link to="/reglages" className="accent">Exporter maintenant</Link>
    </Banner>
  )
}
