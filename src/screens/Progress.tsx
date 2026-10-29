import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { AppState } from '../hooks/useAppState'
import PlateauBanner from '../components/progress/PlateauBanner'
import E1rmSection from '../components/progress/E1rmSection'
import PointChart from '../components/progress/PointChart'
import BodyweightSection from '../components/progress/BodyweightSection'
import VolumeSection from '../components/progress/VolumeSection'
import { cmjSeries, testSeries, weeklyVolume } from '../components/progress/helpers'

export default function Progress({ state }: { state: AppState }) {
  const data = useLiveQuery(async () => {
    const [refs, tests, measures, sessions] = await Promise.all([
      db.refs.toArray(), db.tests.toArray(), db.measures.toArray(),
      db.sessions.where('status').equals('done').toArray(),
    ])
    const ids = sessions.map((s) => s.id!)
    const sets = ids.length ? await db.sets.where('sessionId').anyOf(ids).toArray() : []
    return { refs, tests, measures, sessions, sets }
  }, [])

  if (!data) return <div className="screen"><h1>Progression</h1><p className="muted">Chargement…</p></div>

  return (
    <div className="screen">
      <h1>Progression</h1>
      <PlateauBanner state={state} refs={data.refs} />
      <E1rmSection state={state} refs={data.refs} />
      <PointChart title="CMJ" unit="cm" data={cmjSeries(data.tests, data.sessions, data.sets)} showTestLegend />
      <PointChart title="Tractions max" unit="reps" data={testSeries(data.tests, 'pullups')} />
      <BodyweightSection measures={data.measures} />
      <VolumeSection state={state} volume={weeklyVolume(data.sessions, data.sets)} />
    </div>
  )
}
