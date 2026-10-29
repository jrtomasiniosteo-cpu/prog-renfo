/** Calendrier du programme : date → macro / bloc / semaine. Module pur. */
import type { Block, Macrocycle, Program, SessionType, TestKind, Weekday } from '../types/program'

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
export const WEEKDAY_FR: Record<Weekday, string> = {
  monday: 'lundi', tuesday: 'mardi', wednesday: 'mercredi', thursday: 'jeudi',
  friday: 'vendredi', saturday: 'samedi', sunday: 'dimanche',
}

/** 'YYYY-MM-DD' → Date locale à minuit. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
/** lundi = 0 … dimanche = 6 */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}
export function weekdayOf(d: Date): Weekday {
  return WEEKDAYS[weekdayIndex(d)]
}
/** Lundi de la semaine de `d`. */
export function mondayOf(d: Date): Date {
  return addDays(startOfDay(d), -weekdayIndex(d))
}

export interface ProgramWeek {
  /** index global 0-based sur tout le programme */
  index: number
  macro: Macrocycle
  macroIndex: number
  block: Block
  /** 1-based dans le macrocycle */
  weekInMacro: number
  /** 1-based dans le bloc */
  weekInBlock: number
  start: Date
  end: Date
  isDeload: boolean
  tests: TestKind[]
  key: string
  /** « Macro 1 · M2 · S6 » */
  label: string
}

export function buildWeeks(program: Program, startDate: string = program.startDate): ProgramWeek[] {
  const start = mondayOf(parseISODate(startDate))
  const weeks: ProgramWeek[] = []
  let index = 0
  program.macrocycles.forEach((macro, macroIndex) => {
    for (let w = 1; w <= macro.weeks; w++) {
      const block = macro.blocks.find((b) => w >= b.weeks[0] && w <= b.weeks[1])
      if (!block) throw new Error(`Semaine ${w} du ${macro.id} sans bloc`)
      const ws = addDays(start, index * 7)
      weeks.push({
        index,
        macro,
        macroIndex,
        block,
        weekInMacro: w,
        weekInBlock: w - block.weeks[0] + 1,
        start: ws,
        end: addDays(ws, 6),
        isDeload: block.deloadWeek === w,
        tests: block.testWeeks?.[String(w)] ?? [],
        key: `${macro.id}-W${w}`,
        label: `Macro ${macroIndex + 1} · ${block.id} · S${w}`,
      })
      index++
    }
  })
  return weeks
}

export type Position =
  | { status: 'before'; start: Date }
  | { status: 'running'; week: ProgramWeek }
  | { status: 'finished'; lastWeek: ProgramWeek }

export function locate(weeks: ProgramWeek[], date: Date): Position {
  const d = startOfDay(date).getTime()
  if (!weeks.length) throw new Error('Programme vide')
  if (d < weeks[0].start.getTime()) return { status: 'before', start: weeks[0].start }
  const w = weeks.find((x) => d >= x.start.getTime() && d <= x.end.getTime())
  if (w) return { status: 'running', week: w }
  return { status: 'finished', lastWeek: weeks[weeks.length - 1] }
}

export function weekByKey(weeks: ProgramWeek[], key: string): ProgramWeek | undefined {
  return weeks.find((w) => w.key === key)
}

/** Déplacement d'une séance pour une semaine donnée. */
export interface SessionMove { weekKey: string; type: SessionType; weekday: Weekday }

export interface ScheduledSession {
  type: SessionType
  weekday: Weekday
  date: Date
  /** A déplacée sur le jour de B → B en version minimale */
  forcedMinimal: boolean
  moved: boolean
  skippable: boolean
}

/** Séances de la semaine, dans l'ordre des jours. */
export function scheduleWeek(
  program: Program,
  week: ProgramWeek,
  days: Record<SessionType, Weekday>,
  moves: SessionMove[] = [],
): ScheduledSession[] {
  const allowed = week.macro.rules?.sessions ?? (Object.keys(program.sessions) as SessionType[])
  const drop = week.macro.rules?.dropSession
  const types = allowed.filter((t) => t !== drop)

  const byType = new Map<SessionType, { weekday: Weekday; moved: boolean }>()
  for (const t of types) {
    const mv = moves.find((m) => m.weekKey === week.key && m.type === t)
    byType.set(t, { weekday: mv?.weekday ?? days[t], moved: !!mv })
  }

  const out: ScheduledSession[] = []
  for (const [type, { weekday, moved }] of byType) {
    // un autre type non déplacé occupe déjà ce jour et celui-ci y a été déplacé → l'autre passe en minimal
    const forcedMinimal = [...byType.entries()].some(
      ([t2, v2]) => t2 !== type && v2.weekday === weekday && v2.moved && !moved,
    )
    out.push({
      type,
      weekday,
      date: addDays(week.start, WEEKDAYS.indexOf(weekday)),
      forcedMinimal,
      moved,
      skippable: !!program.sessions[type].skippable,
    })
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.type.localeCompare(b.type))
  return out
}

/** Séances du jour, et sinon la prochaine (dans la semaine en cours ou les suivantes). */
export function todayAndNext(
  program: Program,
  weeks: ProgramWeek[],
  date: Date,
  days: Record<SessionType, Weekday>,
  moves: SessionMove[] = [],
): { week: ProgramWeek | null; today: ScheduledSession[]; next: (ScheduledSession & { week: ProgramWeek }) | null } {
  const pos = locate(weeks, date)
  if (pos.status !== 'running') return { week: null, today: [], next: null }
  const d = startOfDay(date).getTime()
  const sched = scheduleWeek(program, pos.week, days, moves)
  const today = sched.filter((s) => s.date.getTime() === d)
  if (today.length) return { week: pos.week, today, next: null }
  for (let i = pos.week.index; i < weeks.length; i++) {
    const w = weeks[i]
    const s = scheduleWeek(program, w, days, moves).find((x) => x.date.getTime() > d)
    if (s) return { week: pos.week, today: [], next: { ...s, week: w } }
  }
  return { week: pos.week, today: [], next: null }
}

/** Nombre de semaines non allégées écoulées entre deux index de semaines (inclus). */
export function nonDeloadWeeks(weeks: ProgramWeek[], fromIndex: number, toIndex: number): ProgramWeek[] {
  return weeks.slice(fromIndex, toIndex + 1).filter((w) => !w.isDeload)
}
