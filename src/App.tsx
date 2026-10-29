import { Link, useRoute } from './router'
import { useAppState } from './hooks/useAppState'
import Today from './screens/Today'
import Workout from './screens/Workout'
import Journal from './screens/Journal'
import Progress from './screens/Progress'
import ProgramScreen from './screens/Program'
import Measures from './screens/Measures'
import Settings from './screens/Settings'

const TABS = [
  { to: '/', label: "Aujourd'hui", ico: '▶︎' },
  { to: '/journal', label: 'Journal', ico: '☰' },
  { to: '/progression', label: 'Progression', ico: '↗︎' },
  { to: '/programme', label: 'Programme', ico: '▦' },
  { to: '/mesures', label: 'Mesures', ico: '◎' },
  { to: '/reglages', label: 'Réglages', ico: '⚙︎' },
]

export default function App() {
  const route = useRoute()
  const state = useAppState()
  const head = '/' + (route.parts[0] ?? '')

  if (!state.ready) return <div className="screen"><p className="muted">Chargement…</p></div>

  let screen
  switch (route.parts[0]) {
    case undefined: screen = <Today state={state} />; break
    case 'seance': screen = <Workout state={state} sessionId={Number(route.parts[1])} />; break
    case 'journal': screen = <Journal state={state} sessionId={route.parts[1] ? Number(route.parts[1]) : null} />; break
    case 'progression': screen = <Progress state={state} />; break
    case 'programme': screen = <ProgramScreen state={state} />; break
    case 'mesures': screen = <Measures state={state} />; break
    case 'reglages': screen = <Settings state={state} />; break
    default: screen = <div className="screen"><p>Page inconnue.</p><Link to="/" className="btn">Accueil</Link></div>
  }

  return (
    <div className="app">
      {screen}
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={(t.to === '/' ? head === '/' || head === '/seance' : head === t.to) ? 'active' : ''}>
            <span className="ico">{t.ico}</span>{t.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
