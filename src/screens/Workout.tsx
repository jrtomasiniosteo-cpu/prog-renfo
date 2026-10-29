import type { AppState } from '../hooks/useAppState'
export default function Workout({ state, sessionId }: { state: AppState; sessionId: number }) { void state; void sessionId; return <div className="screen"><h1>Séance</h1><p className="muted">À venir.</p></div> }
