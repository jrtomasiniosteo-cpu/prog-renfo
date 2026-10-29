import type { AppState } from '../hooks/useAppState'
export default function Progress({ state }: { state: AppState }) { void state; return <div className="screen"><h1>Progress</h1><p className="muted">À venir.</p></div> }
