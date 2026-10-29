import type { AppState } from '../hooks/useAppState'
export default function Today({ state }: { state: AppState }) { void state; return <div className="screen"><h1>Today</h1><p className="muted">À venir.</p></div> }
