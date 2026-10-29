/** Mini-routeur par hash : #/, #/seance/12, #/journal, #/journal/12, #/progression, #/programme, #/mesures, #/reglages */
import { useEffect, useState, type ReactNode } from 'react'

export interface Route { path: string; parts: string[]; params: URLSearchParams }

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [p, q = ''] = raw.split('?')
  const parts = p.split('/').filter(Boolean)
  return { path: '/' + parts.join('/'), parts, params: new URLSearchParams(q) }
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : '#' + path
}

export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode } & Record<string, unknown>) {
  return <a href={'#' + to} className={className} {...rest}>{children}</a>
}
