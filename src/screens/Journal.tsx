import type { AppState } from '../hooks/useAppState'
import { Link } from '../router'
import SessionList from '../components/journal/SessionList'
import SessionDetail from '../components/journal/SessionDetail'

export default function Journal({ state, sessionId }: { state: AppState; sessionId: number | null }) {
  if (sessionId === null || Number.isNaN(sessionId)) {
    return (
      <div className="screen">
        <h1>Journal</h1>
        <SessionList state={state} />
      </div>
    )
  }
  return (
    <div className="screen">
      <div className="row" style={{ marginBottom: 8 }}>
        <Link to="/journal" className="btn btn-ghost btn-sm">‹ Journal</Link>
      </div>
      <SessionDetail key={sessionId} state={state} sessionId={sessionId} />
    </div>
  )
}
