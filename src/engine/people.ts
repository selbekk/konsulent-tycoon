import { JUNIOR_YEARS, SENIOR_YEARS } from './constants'
import { activeContracts, isActive, staffFirm } from './economy'
import { ageAt, experienceAt, profileOf } from './profile'
import { DISCIPLINES } from './types'
import type { Discipline, Employee, Firm, GameState, Gender, Seats, Star } from './types'
import { seatTotal } from './util'

/*
 * The bench list and the people statistics. Pure – safe to call from the UI.
 *
 * Staffing works on counts per discipline, not on named people, so who is free is a display
 * choice: people a crisis took off work first, then the newest arrivals. People visibly placed
 * (a star assigned to a running contract, someone on a stretch assignment) are free last.
 */

export interface BenchPerson {
  id: string
  name: string
  discipline: Discipline
  level: number
  /** Years in the industry. */
  experience: number
  star: boolean
}

type Candidate = { p: Employee | Star; star: boolean; offWork: boolean; placed: boolean; joined: number }

function candidates(state: GameState, firm: Firm, d: Discipline, quarter: number): Candidate[] {
  const benched = firm.benched?.quarter === quarter ? firm.benched : undefined
  const running = (id: string | undefined) => {
    const c = id === undefined ? undefined : state.contracts.find((x) => x.id === id)
    return !!c && isActive(c, quarter)
  }
  return [
    ...firm.stars
      .filter((s) => s.discipline === d)
      .map((s) => ({ p: s, star: true, offWork: !!benched?.starIds.includes(s.id), placed: running(s.assignedContractId), joined: s.joinedQuarter ?? -1 })),
    ...(firm.roster ?? [])
      .filter((e) => e.discipline === d)
      .map((e) => ({ p: e, star: false, offWork: false, placed: running(e.stretchContractId), joined: e.joinedQuarter })),
  ]
}

/** Who is free in `quarter`, as far as contracts go (open bids not counted). Players only: AI firms have no roster. */
export function benchPeople(state: GameState, firmId: string, quarter = state.quarter): BenchPerson[] {
  const firm = state.firms[firmId]
  if (!firm.roster) return []
  const { idle } = staffFirm(state, firm, quarter)
  const out: BenchPerson[] = []
  for (const d of DISCIPLINES) {
    const n = idle[d] ?? 0
    if (!n) continue
    const chosen = candidates(state, firm, d, quarter)
      .sort((a, b) => Number(b.offWork) - Number(a.offWork) || Number(a.placed) - Number(b.placed) || b.joined - a.joined || a.p.id.localeCompare(b.p.id))
      .slice(0, n)
    for (const c of chosen) {
      out.push({
        id: c.p.id,
        name: c.p.name,
        discipline: d,
        level: c.p.level,
        experience: experienceAt(profileOf(state, c.p), quarter),
        star: c.star,
      })
    }
  }
  return out
}

export interface BenchRow {
  discipline: Discipline
  now: number
  next: number
  /** Seats of this discipline in the player's open bids that start next quarter. */
  inBids: number
}

/** Free people per discipline now and next quarter, with the seats already offered in bids. */
export function benchSummary(state: GameState, firmId: string): BenchRow[] {
  const firm = state.firms[firmId]
  const now = staffFirm(state, firm).idle
  const next = staffFirm(state, firm, state.quarter + 1).idle
  const bids: Seats = {}
  for (const t of state.tenders) {
    if (t.resolved || t.dueQuarter !== state.quarter || !t.bids.some((b) => b.firmId === firmId)) continue
    for (const d of DISCIPLINES) if (t.seats[d]) bids[d] = (bids[d] ?? 0) + t.seats[d]!
  }
  return DISCIPLINES.map((d) => ({ discipline: d, now: now[d] ?? 0, next: next[d] ?? 0, inBids: bids[d] ?? 0 })).filter(
    (r) => r.now || r.next || r.inBids || firm.pools[r.discipline].count || firm.stars.some((s) => s.discipline === r.discipline),
  )
}

/** Disciplines grouped for the gender balance: tech skews male, design female. */
export const GENDER_GROUPS = { tech: ['frontend', 'backend', 'cloud', 'data', 'architecture'], design: ['design'], pm: ['pm'] } as const satisfies Record<
  string,
  readonly Discipline[]
>
export type GenderGroup = keyof typeof GENDER_GROUPS

export interface PeopleStats {
  headcount: number
  gender: Record<Gender, number>
  /** Women and everyone, per discipline group. */
  genderByGroup: Record<GenderGroup, { female: number; total: number }>
  age?: { avg: number; min: number; max: number }
  experience?: { avg: number; juniors: number; seniors: number }
  /** Years at this firm. */
  tenure?: number
  /** Own people on contracts, weighted by seats: years on the current contract so far, and its full length. */
  project?: { soFar: number; length: number }
}

export function peopleStats(state: GameState, firmId: string): PeopleStats {
  const firm = state.firms[firmId]
  const q = state.quarter
  const people: (Employee | Star)[] = [...firm.stars, ...(firm.roster ?? [])]
  const gender: Record<Gender, number> = { female: 0, male: 0, nonbinary: 0 }
  const genderByGroup = { tech: { female: 0, total: 0 }, design: { female: 0, total: 0 }, pm: { female: 0, total: 0 } }
  const ages: number[] = []
  const years: number[] = []
  let tenure = 0
  for (const p of people) {
    const prof = profileOf(state, p)
    gender[prof.gender]++
    const group = (Object.keys(GENDER_GROUPS) as GenderGroup[]).find((g) => (GENDER_GROUPS[g] as readonly Discipline[]).includes(p.discipline))!
    genderByGroup[group].total++
    if (prof.gender === 'female') genderByGroup[group].female++
    ages.push(ageAt(prof, q))
    years.push(experienceAt(prof, q))
    tenure += (q - (p.joinedQuarter ?? 0)) / 4
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const n = people.length

  const staffing = staffFirm(state, firm)
  let seats = 0
  let soFar = 0
  let length = 0
  for (const c of activeContracts(state, firmId)) {
    const cs = staffing.contracts.find((x) => x.contractId === c.id)
    const own = cs ? seatTotal(cs.staffed) + seatTotal(cs.flex) : 0
    seats += own
    // The current quarter counts: a contract that started this quarter has run for one.
    soFar += (own * (q - c.startQuarter + 1)) / 4
    length += (own * (c.endQuarter - c.startQuarter)) / 4
  }

  return {
    headcount: n,
    gender,
    genderByGroup,
    age: n ? { avg: avg(ages), min: Math.min(...ages), max: Math.max(...ages) } : undefined,
    experience: n ? { avg: avg(years), juniors: years.filter((y) => y < JUNIOR_YEARS).length, seniors: years.filter((y) => y >= SENIOR_YEARS).length } : undefined,
    tenure: n ? tenure / n : undefined,
    project: seats ? { soFar: soFar / seats, length: length / seats } : undefined,
  }
}
