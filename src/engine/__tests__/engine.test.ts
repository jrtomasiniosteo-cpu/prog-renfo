import { describe, expect, it } from 'vitest'
import program from '../../data/program.json'
import type { AccessoryExercise, Program } from '../../types/program'
import {
  e1rm, sessionE1rm, updateReference, mainSet,
  mainLoad, roundDownTo, deloadPrescription, rpeLoad, rirLabel,
  nextAccessoryTarget,
  platesPerSide, formatPlates,
  buildWeeks, locate, parseISODate, scheduleWeek, todayAndNext, toISODate,
  planSession, plyoShouldStop,
  isPlateau,
  directSetsByMuscle, tonnage, rollingAverage,
} from '..'

const P = program as unknown as Program

describe('e1RM', () => {
  it('e1RM(100, 5, 1) === 120', () => {
    expect(e1rm(100, 5, 1)).toBe(120)
  })
  it('e1RM de la séance = max des séries', () => {
    expect(sessionE1rm([{ load: 100, reps: 5, rir: 1 }, { load: 90, reps: 8, rir: 2 }])).toBe(120)
    expect(sessionE1rm([])).toBeNull()
  })
  it('série principale = la plus lourde', () => {
    expect(mainSet([{ load: 80, reps: 5, rir: 2 }, { load: 100, reps: 3, rir: 1 }])?.load).toBe(100)
  })
  it('plafond : référence 105, séance à 112 → 107,5 (bench)', () => {
    expect(updateReference({ ref: 105, sessionE1rm: 112, cap: 2.5, targetRir: 2.5, mainSetRir: 2 })).toBe(107.5)
  })
  it('plafond squat +5', () => {
    expect(updateReference({ ref: 112, sessionE1rm: 130, cap: 5, targetRir: 3, mainSetRir: 3 })).toBe(117)
  })
  it('RIR trop bas : référence 105, cible 2, saisi 0 → 99,75', () => {
    expect(updateReference({ ref: 105, sessionE1rm: 110, cap: 2.5, targetRir: 2, mainSetRir: 0 })).toBe(99.75)
    // charges dérivées arrondies au 2,5
    expect(mainLoad(99.75, 0.75)).toBe(72.5)
  })
  it('RIR 1 sous la cible : pas de baisse', () => {
    expect(updateReference({ ref: 105, sessionE1rm: 100, cap: 2.5, targetRir: 2, mainSetRir: 1 })).toBe(105)
  })
  it('une séance sous la référence ne la baisse pas', () => {
    expect(updateReference({ ref: 105, sessionE1rm: 98, cap: 2.5, targetRir: 2.5, mainSetRir: 3 })).toBe(105)
  })
  it('semaine de test : remplace sans plafond', () => {
    expect(updateReference({ ref: 105, sessionE1rm: 118, cap: 2.5, targetRir: 1, mainSetRir: 1, isTest: true })).toBe(118)
  })
})

describe('charges', () => {
  it('arrondi : charge(105, 0.75) === 77.5', () => {
    expect(mainLoad(105, 0.75)).toBe(77.5)
  })
  it('arrondi exact sur multiples', () => {
    expect(roundDownTo(80)).toBe(80)
    expect(roundDownTo(82.4)).toBe(80)
    expect(roundDownTo(112 * 0.72)).toBe(80) // 80.64
  })
  it('semaine allégée : 4 × 5 @ 75 % → 2 × 5 @ 67,5 %', () => {
    const d = deloadPrescription({ sets: 4, reps: 5, pct: 0.75, rir: 2 })
    expect(d.sets).toBe(2)
    expect(d.reps).toBe(5)
    expect(d.pct).toBeCloseTo(0.675, 6)
    expect(d.top).toBeUndefined()
  })
  it('single @ RPE 8 → 90 %, 8,5 → 93 %', () => {
    expect(rpeLoad(100, 8)).toBe(90)
    expect(rpeLoad(100, 8.5)).toBe(92.5) // 93 arrondi au 2,5 inférieur
  })
  it('libellé RIR fourchette', () => {
    expect(rirLabel(2.5)).toBe('2-3')
    expect(rirLabel(1.5)).toBe('1-2')
    expect(rirLabel(2)).toBe('2')
  })
})

describe('accessoires (double progression)', () => {
  const row = P.exercises['barbell_row'] as AccessoryExercise // 3 × [8,12] RIR 1 inc 2,5
  it('3 × 12 à RIR 1 sur 8-12 RIR 1 → +2,5 kg, cible 8', () => {
    const t = nextAccessoryTarget(row, {
      load: 60, progressionIndex: 0,
      sets: [{ load: 60, reps: 12, rir: 1 }, { load: 60, reps: 12, rir: 1 }, { load: 60, reps: 12, rir: 2 }],
    })
    expect(t.load).toBe(62.5)
    expect(t.targetReps).toEqual([8, 8, 8])
    expect(t.progressed).toBe(true)
  })
  it('fourchette non atteinte → même charge, reps + 1 plafonnées', () => {
    const t = nextAccessoryTarget(row, {
      load: 60, progressionIndex: 0,
      sets: [{ load: 60, reps: 12, rir: 1 }, { load: 60, reps: 10, rir: 1 }, { load: 60, reps: 9, rir: 0 }],
    })
    expect(t.load).toBe(60)
    expect(t.targetReps).toEqual([12, 11, 10])
  })
  it('12 reps à RIR 0 (cible 1) ne valide pas la progression', () => {
    const t = nextAccessoryTarget(row, {
      load: 60, progressionIndex: 0,
      sets: [{ load: 60, reps: 12, rir: 0 }, { load: 60, reps: 12, rir: 1 }, { load: 60, reps: 12, rir: 1 }],
    })
    expect(t.load).toBe(60)
    expect(t.targetReps).toEqual([12, 12, 12])
  })
  it('jamais fait → charge vide, cible min', () => {
    const t = nextAccessoryTarget(row, null)
    expect(t.load).toBeNull()
    expect(t.targetReps).toEqual([8, 8, 8])
  })
  it('bodyweight : max partout → variante suivante', () => {
    const ring = P.exercises['ring_pushup'] as AccessoryExercise // start 1, [8,15]
    const first = nextAccessoryTarget(ring, null)
    expect(first.progressionIndex).toBe(1)
    expect(first.load).toBe(0)
    const t = nextAccessoryTarget(ring, {
      load: 0, progressionIndex: 1,
      sets: Array(4).fill({ load: 0, reps: 15, rir: 1 }),
    })
    expect(t.progressionIndex).toBe(2)
    expect(t.targetReps).toEqual([8, 8, 8, 8])
    expect(ring.progressions![2]).toBe('Dips aux anneaux')
  })
  it('bodyweight : dernière variante → reste au max', () => {
    const ring = P.exercises['ring_pushup'] as AccessoryExercise
    const t = nextAccessoryTarget(ring, { load: 0, progressionIndex: 3, sets: Array(4).fill({ load: 0, reps: 15, rir: 1 }) })
    expect(t.progressionIndex).toBe(3)
    expect(t.targetReps).toEqual([15, 15, 15, 15])
  })
  it('lesté : la charge est le lest', () => {
    const pu = P.exercises['weighted_pullup'] as AccessoryExercise
    const t = nextAccessoryTarget(pu, { load: 10, progressionIndex: 0, sets: Array(3).fill({ load: 10, reps: 8, rir: 1 }) })
    expect(t.load).toBe(12.5)
    expect(t.targetReps).toEqual([5, 5, 5])
  })
  it('nombre de séries forcé (macro 3)', () => {
    const t = nextAccessoryTarget(row, null, 2)
    expect(t.targetReps).toHaveLength(2)
  })
  it('charge fixe (KB 4 kg) : pas d’incrément', () => {
    const kb = P.exercises['kb_lateral_raise'] as AccessoryExercise
    expect(nextAccessoryTarget(kb, null).load).toBe(4)
    const t = nextAccessoryTarget(kb, { load: 4, progressionIndex: 0, sets: Array(3).fill({ load: 4, reps: 25, rir: 0 }) })
    expect(t.load).toBe(4)
    expect(t.targetReps).toEqual([25, 25, 25])
  })
})

describe('disques', () => {
  it('102,5 kg → 25 + 15 + 1,25 par côté', () => {
    const r = platesPerSide(102.5)
    expect(r.perSide).toEqual([25, 15, 1.25])
    expect(r.achieved).toBe(102.5)
    expect(r.remainder).toBe(0)
  })
  it('barre à vide et reste non chargeable', () => {
    expect(platesPerSide(20).perSide).toEqual([])
    expect(formatPlates(platesPerSide(20))).toBe('Barre à vide')
    const r = platesPerSide(21)
    expect(r.perSide).toEqual([])
    expect(r.remainder).toBe(1)
  })
  it('77,5 kg → 25 + 2,5 + 1,25', () => {
    expect(platesPerSide(77.5).perSide).toEqual([25, 2.5, 1.25])
  })
})

describe('calendrier', () => {
  const weeks = buildWeeks(P)
  it('45 semaines, enchaînement des macros', () => {
    expect(weeks).toHaveLength(45)
    expect(toISODate(weeks[0].start)).toBe('2026-11-02')
    const m2 = weeks.find((w) => w.macro.id === 'macro2' && w.weekInMacro === 1)!
    expect(toISODate(m2.start)).toBe('2027-02-22')
    const m3 = weeks.find((w) => w.macro.id === 'macro3' && w.weekInMacro === 1)!
    expect(toISODate(m3.start)).toBe('2027-06-14')
  })
  it('libellé, deload, tests', () => {
    const w6 = weeks[5]
    expect(w6.label).toBe('Macro 1 · M2 · S6')
    expect(weeks[3].isDeload).toBe(true)
    expect(weeks[0].tests).toContain('e1rm')
    expect(weeks[7].isDeload).toBe(true)
    expect(weeks[7].tests).toContain('e1rm')
    expect(weeks[15].tests).toContain('bench_1rm')
  })
  it('localisation avant / pendant / après', () => {
    expect(locate(weeks, parseISODate('2026-10-29')).status).toBe('before')
    const pos = locate(weeks, parseISODate('2026-12-10'))
    expect(pos.status).toBe('running')
    if (pos.status === 'running') expect(pos.week.label).toBe('Macro 1 · M2 · S6')
    expect(locate(weeks, parseISODate('2027-09-13')).status).toBe('finished')
  })
  it('planning hebdo par défaut et macro 3 sans C', () => {
    const s = scheduleWeek(P, weeks[1], P.defaultDays)
    expect(s.map((x) => x.type)).toEqual(['A', 'C', 'B'])
    expect(toISODate(s[0].date)).toBe('2026-11-11')
    const m3 = weeks.find((w) => w.macro.id === 'macro3')!
    expect(scheduleWeek(P, m3, P.defaultDays).map((x) => x.type)).toEqual(['A', 'B'])
  })
  it('A déplacée sur le jour de B → B minimale', () => {
    const s = scheduleWeek(P, weeks[1], P.defaultDays, [{ weekKey: weeks[1].key, type: 'A', weekday: 'saturday' }])
    const a = s.find((x) => x.type === 'A')!
    const b = s.find((x) => x.type === 'B')!
    expect(a.moved).toBe(true)
    expect(a.forcedMinimal).toBe(false)
    expect(b.forcedMinimal).toBe(true)
  })
  it('déplacement vers le jour par défaut = pas de déplacement ; A et B toutes deux déplacées le même jour → B minimale', () => {
    const s = scheduleWeek(P, weeks[1], P.defaultDays, [{ weekKey: weeks[1].key, type: 'A', weekday: 'wednesday' }])
    expect(s.find((x) => x.type === 'A')!.moved).toBe(false)
    const both = scheduleWeek(P, weeks[1], P.defaultDays, [
      { weekKey: weeks[1].key, type: 'A', weekday: 'friday' }, { weekKey: weeks[1].key, type: 'B', weekday: 'friday' },
    ])
    expect(both.find((x) => x.type === 'A')!.forcedMinimal).toBe(false)
    expect(both.find((x) => x.type === 'B')!.forcedMinimal).toBe(true)
  })
  it("aujourd'hui / prochaine séance", () => {
    const t = todayAndNext(P, weeks, parseISODate('2026-11-11'), P.defaultDays)
    expect(t.today.map((x) => x.type)).toEqual(['A'])
    const n = todayAndNext(P, weeks, parseISODate('2026-11-10'), P.defaultDays)
    expect(n.today).toEqual([])
    expect(n.next?.type).toBe('A')
    expect(toISODate(n.next!.date)).toBe('2026-11-11')
    // dimanche → prochaine = A de la semaine suivante
    const s = todayAndNext(P, weeks, parseISODate('2026-11-15'), P.defaultDays)
    expect(s.next?.type).toBe('A')
    expect(toISODate(s.next!.date)).toBe('2026-11-18')
  })
})

describe('séance planifiée', () => {
  const weeks = buildWeeks(P)
  const refs = { squat: 112, bench: 105 }
  const base = { program: P, refs, accessoryHistory: {} }

  it('A semaine 2 : plio du bloc, squat 4 × 6 @ 80, bench 4 × 5 @ 77,5, slot RDL', () => {
    const s = planSession({ ...base, week: weeks[1], type: 'A' })
    expect(s.isTest).toBe(false)
    const keys = s.exercises.map((e) => e.key)
    expect(keys).toEqual(['plyo:Box jump', 'plyo:Saut en longueur', 'squat', 'bench_heavy', 'weighted_pullup', 'rdl'])
    const sq = s.exercises.find((e) => e.key === 'squat')!
    expect(sq.sets).toHaveLength(4)
    expect(sq.sets[0]).toMatchObject({ load: 80, reps: 6, rir: 3 })
    const b = s.exercises.find((e) => e.key === 'bench_heavy')!
    expect(b.sets[0].load).toBe(77.5)
    expect(b.rirLabel).toBe('2-3')
  })
  it('A semaine 1 = protocole de test', () => {
    const s = planSession({ ...base, week: weeks[0], type: 'A' })
    expect(s.isTest).toBe(true)
    expect(s.exercises.map((e) => e.key)).toEqual(['test:e1rm:squat', 'test:e1rm:bench', 'test:cmj', 'test:pullups', 'test:body'])
  })
  it('semaine 4 allégée : squat 2 × 6 @ 64,8 % → 72,5 ; plio divisée par deux', () => {
    const s = planSession({ ...base, week: weeks[3], type: 'A' })
    expect(s.isDeload).toBe(true)
    const sq = s.exercises.find((e) => e.key === 'squat')!
    expect(sq.sets).toHaveLength(2)
    expect(sq.sets[0].load).toBe(72.5) // 112 × 0,648 = 72,58
    expect(s.exercises[0].sets).toHaveLength(2) // box jump 4 → 2
  })
  it('semaine 8 : A = test, B allégée', () => {
    const a = planSession({ ...base, week: weeks[7], type: 'A' })
    expect(a.isTest).toBe(true)
    const b = planSession({ ...base, week: weeks[7], type: 'B' })
    expect(b.isDeload).toBe(true)
    expect(b.exercises.find((e) => e.key === 'bench_volume')!.sets).toHaveLength(2)
  })
  it('M4 : top single @ RPE 8 et LOWER_ACC retiré', () => {
    const s = planSession({ ...base, week: weeks[12], type: 'A' })
    expect(s.exercises.some((e) => e.key === 'rdl')).toBe(false)
    const b = s.exercises.find((e) => e.key === 'bench_heavy')!
    expect(b.sets[0]).toMatchObject({ isTop: true, reps: 1, load: 92.5 }) // 105 × 0,9 = 94,5 → 92,5
    expect(b.sets).toHaveLength(4)
  })
  it('macro 2 : slots macro2 et C présente', () => {
    const w = weeks.find((x) => x.macro.id === 'macro2' && x.weekInMacro === 2)!
    const b = planSession({ ...base, week: w, type: 'B' })
    expect(b.exercises.map((e) => e.key)).toContain('one_arm_db_row')
    expect(b.exercises.map((e) => e.key)).toContain('close_grip_bench')
  })
  it('macro 3 : 2 séries max, accessoires à 2, plio ≤ 20 contacts, semaine à une séance', () => {
    const w = weeks.find((x) => x.macro.id === 'macro3' && x.weekInMacro === 2)!
    const a = planSession({ ...base, week: w, type: 'A', singleSession: true })
    const sq = a.exercises.find((e) => e.key === 'squat')!
    expect(sq.sets).toHaveLength(2)
    expect(a.exercises.find((e) => e.key === 'weighted_pullup')!.sets).toHaveLength(2)
    const contacts = a.exercises.filter((e) => e.kind === 'plyo').reduce((n, e) => n + e.sets.length * (e.sets[0].reps ?? 0), 0)
    expect(contacts).toBeLessThanOrEqual(20)
    expect(a.exercises[a.exercises.length - 1].key).toBe('bench_volume')
    const noSingle = planSession({ ...base, week: w, type: 'A' })
    expect(noSingle.exercises.some((e) => e.key === 'bench_volume')).toBe(false)
  })
  it('version minimale', () => {
    const s = planSession({ ...base, week: weeks[1], type: 'B', minimal: true })
    expect(s.minimal).toBe(true)
    expect(s.exercises.map((e) => e.key)).toEqual(['bench_volume', 'barbell_row', 'dips', 'lateral_raise'])
    const c = planSession({ ...base, week: weeks[1], type: 'C', minimal: true })
    expect(c.minimal).toBe(false) // pas de version minimale pour C
    expect(c.exercises).toHaveLength(7)
  })
  it('accessoires : historique pris en compte, variante bodyweight nommée', () => {
    const s = planSession({
      ...base, week: weeks[1], type: 'C',
      accessoryHistory: { ring_row: { load: 0, progressionIndex: 1, sets: Array(3).fill({ load: 0, reps: 15, rir: 1 }) } },
    })
    const rr = s.exercises.find((e) => e.key === 'ring_row')!
    expect(rr.progressionName).toBe('Pieds surélevés')
  })
  it('plio : arrêt si baisse > 5 %', () => {
    expect(plyoShouldStop(40, 37)).toBe(true)
    expect(plyoShouldStop(40, 38.5)).toBe(false)
    expect(plyoShouldStop(null, 30)).toBe(false)
  })
})

describe('plateau', () => {
  it('3 semaines non allégées sans hausse → plateau', () => {
    expect(isPlateau([
      { weekIndex: 0, e1rm: 105, isDeload: false },
      { weekIndex: 1, e1rm: 105, isDeload: false },
      { weekIndex: 2, e1rm: 105, isDeload: false },
      { weekIndex: 3, e1rm: 100, isDeload: true },
      { weekIndex: 4, e1rm: 105, isDeload: false },
    ])).toBe(true)
  })
  it('une hausse dans la fenêtre → pas de plateau', () => {
    expect(isPlateau([
      { weekIndex: 0, e1rm: 105, isDeload: false },
      { weekIndex: 1, e1rm: 105, isDeload: false },
      { weekIndex: 2, e1rm: 107.5, isDeload: false },
      { weekIndex: 3, e1rm: 107.5, isDeload: false },
    ])).toBe(false)
  })
  it('pas assez de données', () => {
    expect(isPlateau([{ weekIndex: 0, e1rm: 105, isDeload: false }, { weekIndex: 1, e1rm: 105, isDeload: false }])).toBe(false)
  })
})

describe('volume', () => {
  it('séries directes par muscle, plio exclue', () => {
    const v = directSetsByMuscle([
      { muscles: ['pecs', 'triceps'], reps: 5, load: 80, kind: 'main' },
      { muscles: ['pecs', 'triceps'], reps: 5, load: 80, kind: 'main' },
      { muscles: ['dos', 'biceps'], reps: 8, load: 10, kind: 'accessory' },
      { muscles: [], reps: 4, load: null, kind: 'plyo' },
      { muscles: ['jambes'], reps: 0, load: 80, kind: 'main' },
    ])
    expect(v.pecs).toBe(2)
    expect(v.triceps).toBe(2)
    expect(v.dos).toBe(1)
    expect(v.jambes).toBe(0)
  })
  it('tonnage et moyenne glissante', () => {
    expect(tonnage([{ muscles: [], reps: 5, load: 80, kind: 'main' }, { muscles: [], reps: 10, load: 0, kind: 'accessory' }])).toBe(400)
    const r = rollingAverage([
      { date: '2026-11-01', value: 80 }, { date: '2026-11-02', value: 82 }, { date: '2026-11-10', value: 84 },
    ], 7)
    expect(r[1].value).toBe(81)
    expect(r[2].value).toBe(84)
  })
})
