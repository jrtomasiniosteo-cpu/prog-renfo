import type { AppState } from '../hooks/useAppState'
export default function Journal({ state, sessionId }: { state: AppState; sessionId: number | null }) { void state; void sessionId; return <div className="screen"><h1>Journal</h1><p className="muted">À venir.</p></div> }
