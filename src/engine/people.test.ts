import { describe, expect, it } from 'vitest'
import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES } from '../content/starNames'
import { planHumanProxy } from './ai/humanProxy'
import { staffFirm } from './economy'
import { capacity } from './metrics'
import { benchPeople, benchSummary, peopleStats } from './people'
import { profileOf } from './profile'
import { applyActionInPlace } from './reducer'
import { addPeople } from './roster'
import { deepFreeze, newTestGame, syncRosterToPools } from './testUtils'
import { endTurn } from './turn'
import type { Contract, GameState } from './types'
import { emptyPools, seatTotal } from './util'

function isolated(): GameState {
  const s = newTestGame()
  const p = s.firms.player
  p.stars = []
  p.pools = emptyPools()
  p.pools.backend = { count: 5, level: 3, morale: 60 }
  s.contracts = []
  return syncRosterToPools(s)
}

const contract = (seats: number, over: Partial<Contract> = {}): Contract => ({
  id: 'c1',
  tenderId: 't',
  firmId: 'player',
  customerId: 'navet',
  kind: 'project',
  baseSeats: { backend: seats },
  activeSeats: { backend: seats },
  rateMultiplier: 1.2,
  share: 1,
  rank: 1,
  startQuarter: 0,
  endQuarter: 4,
  starIds: [],
  satisfaction: 70,
  outsourcedShare: 0,
  fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
  terminated: false,
  ...over,
})

/** A few quarters of a sensible player, so there are contracts, bids and hires. */
function played(seed: number, quarters: number): GameState {
  let s = newTestGame(seed)
  for (let q = 0; q < quarters; q++) {
    for (const a of planHumanProxy(s)) applyActionInPlace(s, a)
    s = endTurn(s)
  }
  return s
}

describe('bench list', () => {
  it('idle people add up to what the capacity chart shows, now and next quarter', () => {
    for (const seed of [1, 7, 42]) {
      const s = played(seed, 6)
      const me = s.firms.player
      const cap = capacity(s, 'player')
      expect(seatTotal(staffFirm(s, me).idle)).toBe(cap.bench)
      expect(seatTotal(staffFirm(s, me, s.quarter + 1).idle)).toBe(cap.next.offered + cap.next.idle)
      expect(benchPeople(s, 'player')).toHaveLength(cap.bench)
      expect(benchPeople(s, 'player', s.quarter + 1)).toHaveLength(cap.next.offered + cap.next.idle)
    }
  })

  it('counts people a crisis took off work as idle', () => {
    const s = isolated()
    s.contracts.push(contract(5))
    s.firms.player.benched = { quarter: s.quarter, seats: { backend: 2 }, starIds: [] }
    expect(staffFirm(s, s.firms.player).idle).toEqual({ backend: 2 })
    expect(capacity(s, 'player').bench).toBe(2)
  })

  it('puts the newest arrivals on the bench first and leaves visibly placed people for last', () => {
    const s = isolated()
    s.contracts.push(contract(3))
    const me = s.firms.player
    s.quarter = 3
    addPeople(s, me, 'backend', 1, 3)
    const newest = me.roster!.at(-1)!
    // 6 people, 3 seats: the newest and two others sit.
    const bench = benchPeople(s, 'player')
    expect(bench).toHaveLength(3)
    expect(bench[0].id).toBe(newest.id)
    newest.stretchContractId = 'c1'
    expect(benchPeople(s, 'player').map((p) => p.id)).not.toContain(newest.id)
  })

  it('summarises free people per discipline with seats already offered', () => {
    const s = isolated()
    s.contracts.push(contract(2, { endQuarter: 1 }))
    const t = s.tenders.find((x) => !x.resolved)!
    t.dueQuarter = s.quarter
    t.seats = { backend: 2 }
    t.bids.push({ firmId: 'player', rateMultiplier: 1, effort: 0, starIds: [] } as never)
    const row = benchSummary(s, 'player').find((r) => r.discipline === 'backend')!
    expect(row).toEqual({ discipline: 'backend', now: 3, next: 5, inBids: 2 })
  })

  it('never touches state.rng or its input', () => {
    const s = deepFreeze(played(3, 4))
    expect(() => {
      benchPeople(s, 'player')
      benchPeople(s, 'player', s.quarter + 1)
      benchSummary(s, 'player')
      peopleStats(s, 'player')
    }).not.toThrow()
  })
})

describe('profiles', () => {
  it('gives new people a profile, and a first name that fits it', () => {
    const s = played(5, 6)
    const me = s.firms.player
    for (const p of [...me.roster!, ...me.stars, ...s.starMarket]) {
      expect(p.gender).toBeDefined()
      const first = p.name.split(' ')[0]
      if (p.gender === 'female') expect(FEMALE_FIRST_NAMES).toContain(first)
      if (p.gender === 'male') expect(MALE_FIRST_NAMES).toContain(first)
    }
  })

  it('skews tech male and design female', () => {
    const s = newTestGame()
    const me = s.firms.player
    addPeople(s, me, 'backend', 300, 2)
    addPeople(s, me, 'design', 300, 2)
    const share = (d: string) => {
      const people = me.roster!.filter((e) => e.discipline === d)
      return people.filter((e) => e.gender === 'female').length / people.length
    }
    expect(share('backend')).toBeLessThan(0.35)
    expect(share('design')).toBeGreaterThan(0.5)
  })

  it('makes experience follow level, and nobody start their career as a child', () => {
    const s = newTestGame()
    const me = s.firms.player
    addPeople(s, me, 'backend', 50, 1)
    addPeople(s, me, 'data', 50, 5)
    const years = (d: string) => {
      const people = me.roster!.filter((e) => e.discipline === d)
      return people.reduce((sum, e) => sum + (s.quarter - e.careerStartQuarter!) / 4, 0) / people.length
    }
    expect(years('backend')).toBeLessThan(2)
    expect(years('data')).toBeGreaterThan(10)
    for (const e of me.roster!) expect((e.careerStartQuarter! - e.bornQuarter!) / 4).toBeGreaterThanOrEqual(22)
  })

  it('derives the same profile every time for people from saves without one', () => {
    const s = newTestGame()
    const e = structuredClone(s.firms.player.roster![0])
    delete e.gender
    delete e.bornQuarter
    delete e.careerStartQuarter
    expect(profileOf(s, e)).toEqual(profileOf(s, e))
    expect(profileOf(s, e).gender).toBeDefined()
  })
})

describe('people statistics', () => {
  it('counts gender, age and experience over employees and stars', () => {
    const s = newTestGame()
    const st = peopleStats(s, 'player')
    const me = s.firms.player
    expect(st.headcount).toBe(me.roster!.length + me.stars.length)
    expect(st.gender.female + st.gender.male + st.gender.nonbinary).toBe(st.headcount)
    expect(st.genderByGroup.tech.total + st.genderByGroup.design.total + st.genderByGroup.pm.total).toBe(st.headcount)
    expect(st.age!.min).toBeLessThanOrEqual(st.age!.avg)
    expect(st.age!.avg).toBeLessThanOrEqual(st.age!.max)
    expect(st.tenure).toBe(0)
  })

  it('weights time on project by own seats', () => {
    const s = isolated()
    s.quarter = 4
    s.contracts.push(contract(4, { id: 'a', startQuarter: 1, endQuarter: 9 }))
    s.contracts.push(contract(1, { id: 'b', startQuarter: 4, endQuarter: 8 }))
    const { project } = peopleStats(s, 'player')
    // 4 seats 1 year in of 2, 1 seat one quarter in of 1 year.
    expect(project!.soFar).toBeCloseTo((4 * 1 + 1 * 0.25) / 5)
    expect(project!.length).toBeCloseTo((4 * 2 + 1 * 1) / 5)
  })

  it('has no project numbers without contracts', () => {
    expect(peopleStats(isolated(), 'player').project).toBeUndefined()
  })
})
