import { describe, expect, it } from 'vitest'
import { planHumanProxy } from './ai/humanProxy'
import {
  CAREER_PROMISE_QUARTERS,
  COURSE_COST,
  COURSE_MAX_LEVEL,
  COURSE_QUARTERS,
  HOMEGROWN_LOYALTY,
  MENTOR_BID_PENALTY,
  PROMOTE_COST,
  PROMOTE_MIN_LEVEL,
  quarterlySalaryCost,
} from './constants'
import { developRoster } from './development'
import { headcount } from './economy'
import { applyAction, applyActionInPlace } from './reducer'
import { buildRoster, mentorPenalty, rosterIn, syncPool } from './roster'
import { deserialize, serialize } from './save'
import { deepFreeze, newTestGame, syncRosterToPools, veteranTestGame } from './testUtils'
import { endTurn } from './turn'
import { DISCIPLINES } from './types'
import type { Employee, Firm, GameState } from './types'

const me = (s: GameState) => s.firms.player

function expectInSync(firm: Firm) {
  for (const d of DISCIPLINES) {
    const people = rosterIn(firm, d)
    expect(firm.pools[d].count).toBe(people.length)
    if (people.length) expect(firm.pools[d].level).toBeCloseTo(people.reduce((s, e) => s + e.level, 0) / people.length, 9)
  }
}

/** A veteran firm with ten backend people and plenty of cash. */
function staffed(seed = 42): GameState {
  const s = veteranTestGame(seed)
  me(s).pools.backend.count = 10
  me(s).pools.backend.level = 3
  me(s).cash = 50_000_000
  return syncRosterToPools(s)
}

/** After a test has changed people's levels by hand. */
const resync = (s: GameState) => DISCIPLINES.forEach((d) => syncPool(me(s), d))

const first = (s: GameState, d = 'backend'): Employee => rosterIn(me(s), d as 'backend')[0]

describe('roster', () => {
  it('avoids giving two people on the roster the same name', () => {
    const s = veteranTestGame()
    me(s).pools.backend.count = 150
    syncRosterToPools(s)
    const names = me(s).roster!.map((e) => e.name)
    // 1440+ combinations: a handful of repeats may survive the retries, but not dozens.
    expect(names.length - new Set(names).size).toBeLessThan(3)
  })

  it('gives the player named people that match the pools, and the AI none', () => {
    const s = newTestGame()
    expect(me(s).roster!.length).toBe(4)
    expectInSync(me(s))
    for (const e of me(s).roster!) {
      expect(e.name).toMatch(/\S+ \S+/)
      expect(e.quirks.length).toBeGreaterThan(0)
      expect(e.potential).toBeGreaterThanOrEqual(0)
      expect(e.potential).toBeLessThanOrEqual(1)
    }
    expect(Object.values(s.firms).filter((f) => f.roster)).toEqual([me(s)])
  })

  it('never draws from state.rng', () => {
    const s = staffed()
    const rng = { ...s.rng }
    buildRoster(s, me(s))
    developRoster(s, me(s))
    expect(s.rng).toEqual(rng)
  })

  it('keeps the pools in sync through 20 quarters of play', () => {
    let s = newTestGame(7)
    for (let q = 0; q < 20 && s.status === 'playing'; q++) {
      const draft = structuredClone(s)
      for (const a of planHumanProxy(draft)) applyActionInPlace(draft, a)
      s = endTurn(draft)
      expectInSync(me(s))
    }
    expect(me(s).roster!.length).toBeGreaterThan(4)
  })

  it('names the people in saves from before rosters, without changing the pools', () => {
    const s = staffed()
    const pools = structuredClone(me(s).pools)
    delete me(s).roster
    const loaded = deserialize(serialize(s))
    expect(me(loaded).roster!.length).toBe(DISCIPLINES.reduce((n, d) => n + pools[d].count, 0))
    for (const d of DISCIPLINES) {
      expect(me(loaded).pools[d].count).toBe(pools[d].count)
      expect(me(loaded).pools[d].level).toBeCloseTo(pools[d].level, 9)
    }
  })

  it('lets go of a chosen person, or the weakest, and pays their severance', () => {
    const s = deepFreeze(staffed())
    const chosen = first(s)
    const r = applyAction(s, { type: 'fire', firmId: 'player', discipline: 'backend', count: 1, employeeId: chosen.id })
    expect(r.error).toBeUndefined()
    expect(me(r.state).roster!.some((e) => e.id === chosen.id)).toBe(false)
    expect(me(r.state).cash).toBeCloseTo(me(s).cash - quarterlySalaryCost(chosen.level, me(s).budgets.salaryPremium), 6)
    expectInSync(me(r.state))

    const weakest = [...rosterIn(me(s), 'backend')].sort((a, b) => a.level - b.level)[0]
    const r2 = applyAction(s, { type: 'fire', firmId: 'player', discipline: 'backend', count: 1 })
    expect(me(r2.state).roster!.some((e) => e.id === weakest.id)).toBe(false)
  })
})

describe('development', () => {
  it('is locked at level 1', () => {
    const s = newTestGame()
    const e = me(s).roster![0]
    expect(applyAction(s, { type: 'trainEmployee', firmId: 'player', discipline: e.discipline, employeeId: e.id }).error).toBe('errors.levelTooLow')
  })

  it('sends someone on a course that lifts them over two quarters and shows their potential', () => {
    const s = staffed()
    const e = first(s)
    e.level = 2.5
    const r = applyAction(s, { type: 'trainEmployee', firmId: 'player', discipline: 'backend', employeeId: e.id })
    expect(r.error).toBeUndefined()
    expect(me(r.state).cash).toBe(me(s).cash - COURSE_COST)
    expect(applyAction(r.state, { type: 'trainEmployee', firmId: 'player', discipline: 'backend', employeeId: e.id }).error).toBe('errors.alreadyOnCourse')
    let x = r.state
    for (let i = 0; i < COURSE_QUARTERS; i++) {
      developRoster(x, me(x))
      x.quarter += 1
    }
    const after = me(x).roster!.find((y) => y.id === e.id)!
    expect(after.level).toBeGreaterThan(2.8)
    expect(after.course).toBeUndefined()
    expect(after.potentialRevealed).toBe(true)
    expectInSync(me(x))
  })

  it('does not train past the course ceiling', () => {
    const s = staffed()
    const e = first(s)
    e.level = COURSE_MAX_LEVEL
    resync(s)
    expect(applyAction(s, { type: 'trainEmployee', firmId: 'player', discipline: 'backend', employeeId: e.id }).error).toBe('errors.courseMaxLevel')
  })

  it('trains the AI pool average instead of a person', () => {
    const s = veteranTestGame()
    const ai = Object.values(s.firms).find((f) => !f.isPlayer && f.pools.backend.count > 0 && f.pools.backend.level < COURSE_MAX_LEVEL)!
    ai.level = 5
    const before = ai.pools.backend.level
    const r = applyAction(s, { type: 'trainEmployee', firmId: ai.id, discipline: 'backend' })
    expect(r.error).toBeUndefined()
    expect(r.state.firms[ai.id].pools.backend.level).toBeGreaterThan(before)
    expect(r.state.firms[ai.id].cash).toBe(ai.cash - COURSE_COST)
  })

  it('promotes a talent to a loyal homegrown star, once a year', () => {
    const s = staffed()
    const [a, b, c] = rosterIn(me(s), 'backend')
    for (const e of [a, b]) Object.assign(e, { level: 4.1, potential: 0.9, potentialRevealed: true })
    Object.assign(c, { level: 4.1, potential: 0.2, potentialRevealed: true })
    resync(s)
    const [a2, b2, c2] = [a, b, c]
    expect(applyAction(s, { type: 'promoteEmployee', firmId: 'player', employeeId: c2.id }).error).toBe('errors.noPotential')
    const hc = headcount(me(s))
    const r = applyAction(deepFreeze(s), { type: 'promoteEmployee', firmId: 'player', employeeId: a2.id })
    expect(r.error).toBeUndefined()
    const star = me(r.state).stars.find((x) => x.name === a2.name)!
    expect(star).toMatchObject({ homegrown: true, discipline: 'backend', level: 4, loyalty: HOMEGROWN_LOYALTY })
    expect(me(r.state).cash).toBe(me(s).cash - PROMOTE_COST)
    expect(headcount(me(r.state))).toBe(hc)
    expectInSync(me(r.state))
    expect(applyAction(r.state, { type: 'promoteEmployee', firmId: 'player', employeeId: b2.id }).error).toBe('errors.promotedRecently')
  })

  it('pairs someone with a star mentor, who bids a little weaker meanwhile', () => {
    const s = staffed()
    const star = me(s).stars.find((x) => x.discipline === 'backend')!
    const e = first(s)
    e.level = 2.5
    const r = applyAction(s, { type: 'setMentor', firmId: 'player', employeeId: e.id, starId: star.id })
    expect(r.error).toBeUndefined()
    expect(mentorPenalty(me(r.state), star.id)).toBe(MENTOR_BID_PENALTY)
    const other = rosterIn(me(r.state), 'backend')[1]
    expect(applyAction(r.state, { type: 'setMentor', firmId: 'player', employeeId: other.id, starId: star.id }).error).toBe('errors.mentorBusy')
    developRoster(r.state, me(r.state))
    expect(me(r.state).roster!.find((y) => y.id === e.id)!.level).toBeGreaterThan(2.5)
  })

  it('ends the mentorship at the cap, so a founder can mentor someone into promotion range', () => {
    const s = staffed()
    const founder = me(s).stars.find((x) => x.discipline === 'backend' && x.founder)!
    expect(founder.level).toBe(4)
    const e = first(s)
    Object.assign(e, { level: 3.95, potential: 0.9 })
    const r = applyAction(s, { type: 'setMentor', firmId: 'player', employeeId: e.id, starId: founder.id })
    expect(r.error).toBeUndefined()
    developRoster(r.state, me(r.state))
    const after = me(r.state).roster!.find((y) => y.id === e.id)!
    expect(after.level).toBe(PROMOTE_MIN_LEVEL)
    expect(after.mentorStarId).toBeUndefined()
    expect(mentorPenalty(me(r.state), founder.id)).toBe(0)
  })

  it('stretches someone on a running contract in their discipline', () => {
    const s = staffed()
    const e = first(s)
    const c = s.contracts.find((x) => x.firmId === 'player' && (x.activeSeats.backend ?? 0) > 0)!
    expect(applyAction(s, { type: 'setStretch', firmId: 'player', employeeId: e.id, contractId: 'nope' }).error).toBe('errors.stretchContract')
    const r = applyAction(s, { type: 'setStretch', firmId: 'player', employeeId: e.id, contractId: c.id })
    expect(r.error).toBeUndefined()
    const before = e.level
    developRoster(r.state, me(r.state))
    expect(me(r.state).roster!.find((y) => y.id === e.id)!.level).toBeGreaterThan(before)
  })

  it('keeps a career promise with growth, and loses the person without it', () => {
    const s = staffed()
    const [grower, idler] = rosterIn(me(s), 'backend')
    for (const e of [grower, idler]) e.level = 2
    resync(s)
    let x = s
    for (const id of [grower.id, idler.id]) x = applyAction(x, { type: 'careerTalk', firmId: 'player', employeeId: id }).state
    x = applyAction(x, { type: 'trainEmployee', firmId: 'player', discipline: 'backend', employeeId: grower.id }).state
    x = applyAction(x, { type: 'setMentor', firmId: 'player', employeeId: grower.id, starId: me(x).stars.find((y) => y.discipline === 'backend')!.id }).state
    expect(applyAction(x, { type: 'careerTalk', firmId: 'player', employeeId: grower.id }).error).toBe('errors.promiseActive')
    for (let i = 0; i < CAREER_PROMISE_QUARTERS; i++) {
      developRoster(x, me(x))
      x.quarter += 1
    }
    expect(me(x).roster!.find((e) => e.id === grower.id)?.promise).toBeUndefined()
    expect(me(x).roster!.some((e) => e.id === idler.id)).toBe(false)
    expect(x.news.some((n) => n.key === 'news.staff.promiseKept')).toBe(true)
    expect(x.news.some((n) => n.key === 'news.staff.promiseBroken')).toBe(true)
    expectInSync(me(x))
  })
})
