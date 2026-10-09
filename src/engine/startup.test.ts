import { describe, expect, it } from 'vitest'
import { COFOUNDERS } from '../content/cofounders'
import { EVENT_MAP } from '../content/events'
import {
  HIRE_COST,
  START_CASH,
  STARTUP_DECLINE_INTEREST,
  STARTUP_HOURS,
  STARTUP_LEADS,
  STARTUP_LIKED_INTEREST,
} from './constants'
import { headcount, isActive, staffFirm } from './economy'
import { createNewGame } from './newGame'
import { applyAction } from './reducer'
import { addPeople } from './roster'
import { leadSeats, offerChance, recruitBlock, startupHours } from './startup'
import { deepFreeze, newStartupGame, testOptions } from './testUtils'
import { endTurn } from './turn'
import { quarterTodos } from './todos'
import type { Approach, GameState } from './types'
import { seatTotal } from './util'

const me = (s: GameState) => s.firms[s.playerId]
const st = (s: GameState) => me(s).startup!
const take = (s: GameState, kind: string) => {
  const lead = st(s).leads.find((l) => l.kind === kind)!
  const r = applyAction(s, { type: 'takeLead', firmId: 'player', leadId: lead.id })
  expect(r.error).toBeUndefined()
  return r.state
}

describe('a new game in the co-working space', () => {
  it('starts with the two founders, no employees, no clients, and this quarter’s leads and network', () => {
    const s = newStartupGame()
    expect(me(s).stars.map((x) => [x.discipline, x.founder])).toEqual([
      ['frontend', true],
      ['backend', true],
    ])
    expect(me(s).roster).toEqual([])
    expect(headcount(me(s))).toBe(2)
    expect(s.contracts.filter((c) => c.firmId === 'player')).toEqual([])
    expect(st(s).leads.map((l) => l.kind)).toEqual(['steady', 'growth', 'prestige'])
    expect(st(s).candidates.length).toBeGreaterThan(0)
    expect(st(s).hours).toBe(startupHours('magnus'))
    expect(me(s).level).toBe(1)
  })

  it('starts with only the player, called what they typed, until a co-founder is picked', () => {
    const s = createNewGame(testOptions())
    expect(me(s).stars).toHaveLength(1)
    expect(me(s).stars[0]).toMatchObject({ name: 'Test Testesen', ceo: true, founder: true })
    expect(me(s).startup).toEqual({ hours: 0, leads: [], candidates: [] })
    expect(s.news.find((n) => n.key === 'news.game.welcome')?.params).toMatchObject({ ceo: 'Test Testesen' })
    // Without a name, the drawn one stays.
    expect(me(createNewGame({ ...testOptions(), ceoName: '  ' })).stars[0].name).not.toBe('')
  })

  it('takes the co-founder from the gallery, perks included, once', () => {
    const aisha = newStartupGame(42, 'aisha')
    expect(me(aisha).cash).toBe(START_CASH.normal + 1_000_000)
    expect(me(aisha).stars[1]).toMatchObject({ name: 'Aisha Rahimi', discipline: 'data', level: 3, traits: ['mentor'] })
    expect(me(newStartupGame(42, 'kari')).reputation).toBe(48)
    expect(st(newStartupGame(42, 'jonas')).leads.map((l) => l.kind)).toContain('insider')
    expect(st(newStartupGame(42, 'ingrid')).hours).toBe(STARTUP_HOURS + 1)
    expect(st(newStartupGame(42, 'magnus')).hours).toBe(STARTUP_HOURS - 1)
    expect(aisha.news.some((n) => n.key === 'news.startup.cofounder')).toBe(true)
    expect(applyAction(aisha, { type: 'chooseCofounder', firmId: 'player', cofounder: 'kari' }).error).toBe(
      'errors.alreadyDone',
    )
    const fresh = createNewGame(testOptions())
    for (const cofounder of ['nobody', '__proto__', 'constructor', 7])
      expect(
        applyAction(fresh, { type: 'chooseCofounder', firmId: 'player', cofounder: cofounder as string }).error,
      ).toBe('errors.invalid')
  })

  it('picks the first co-founder if the quarter ends without one', () => {
    const next = endTurn(createNewGame(testOptions()))
    expect(st(next).cofounder).toBe(COFOUNDERS[0].id)
    expect(me(next).stars).toHaveLength(2)
  })

  it('is deterministic and never touches the AI market', () => {
    const a = endTurn(newStartupGame(9))
    const b = endTurn(newStartupGame(9))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    // The co-founder changes the player's draws (roster RNG), not the rivals'.
    const other = newStartupGame(9, 'ingrid')
    const rivals = (s: GameState) => JSON.stringify(s.firmOrder.slice(1).map((id) => s.firms[id]))
    expect(rivals(other)).toBe(rivals(newStartupGame(9)))
  })
})

describe('leads', () => {
  it('turns into a contract for the free people (up to its size) that bills this quarter, with the founders on it', () => {
    const s = newStartupGame()
    st(s).leads.find((l) => l.kind === 'steady')!.size = 3
    deepFreeze(s)
    const after = take(s, 'steady')
    const c = after.contracts.find((x) => x.tenderId === 'lead')!
    expect(c.activeSeats).toEqual({ frontend: 1, backend: 1 })
    expect(isActive(c, after.quarter)).toBe(true)
    expect(c.rateMultiplier).toBe(STARTUP_LEADS.steady.rate)
    expect(c.starIds).toHaveLength(2)
    expect(staffFirm(after, me(after)).billed).toBe(2)
    expect(me(after).stats?.leads).toBe(1)
  })

  it('gives prestige an extra seat and some reputation, and a lead is never empty', () => {
    const s = newStartupGame()
    const lead = st(s).leads.find((l) => l.kind === 'prestige')!
    lead.size = 2
    expect(seatTotal(leadSeats(s, me(s), lead))).toBe(2 + STARTUP_LEADS.prestige.extraSeats)
    lead.size = 1
    expect(seatTotal(leadSeats(s, me(s), lead))).toBe(1 + STARTUP_LEADS.prestige.extraSeats)
    lead.size = 2
    const after = take(s, 'prestige')
    expect(me(after).reputation).toBe(me(s).reputation + STARTUP_LEADS.prestige.reputation)
    // Everyone busy: the next lead would still have one seat, for a freelancer or the next hire.
    expect(seatTotal(leadSeats(after, me(after), st(after).leads[0]))).toBe(1)
  })

  it('lets a happy growth customer add seats later, and not an unhappy one', () => {
    const s = take(newStartupGame(), 'growth')
    const c = s.contracts.find((x) => x.tenderId === 'lead')!
    expect(c.ramp?.quarter).toBe(STARTUP_LEADS.growth.rampAfter)
    const before = seatTotal(c.activeSeats)
    let happy = s
    let unhappy = structuredClone(s)
    for (let q = 0; q < STARTUP_LEADS.growth.rampAfter; q++) {
      happy = endTurn(happy)
      unhappy.contracts.find((x) => x.id === c.id)!.satisfaction = 10
      unhappy = endTurn(unhappy)
    }
    const grown = happy.contracts.find((x) => x.id === c.id)!
    expect(seatTotal(grown.activeSeats)).toBe(before + STARTUP_LEADS.growth.rampSeats)
    expect(grown.ramp).toBeUndefined()
    expect(happy.news.some((n) => n.key === 'news.startup.rampUp')).toBe(true)
    const same = unhappy.contracts.find((x) => x.id === c.id)
    if (same && !same.terminated) expect(seatTotal(same.activeSeats)).toBe(before)
  })

  it('offers new leads every quarter', () => {
    const s = take(newStartupGame(), 'steady')
    const next = endTurn(s)
    expect(st(next).takenLead).toBeUndefined()
    expect(st(next).leads.map((l) => l.id)).not.toEqual(st(s).leads.map((l) => l.id))
  })
})

describe('the network', () => {
  it('a coffee chat shows what they like, and that approach works best', () => {
    const s = newStartupGame()
    const c = st(s).candidates[0]
    const coffee = applyAction(s, { type: 'recruit', firmId: 'player', candidateId: c.person.id, move: 'coffee' }).state
    const known = st(coffee).candidates[0]
    expect(known.likesKnown).toBe(true)
    expect(st(coffee).hours).toBe(st(s).hours - 1)
    if (known.likes !== 'coffee') {
      const liked = applyAction(coffee, {
        type: 'recruit',
        firmId: 'player',
        candidateId: c.person.id,
        move: known.likes,
      }).state
      expect(st(liked).candidates[0].interest).toBe(Math.min(100, known.interest + STARTUP_LIKED_INTEREST))
    }
  })

  it('drinks cost money', () => {
    const s = newStartupGame()
    const id = st(s).candidates[0].person.id
    const r = applyAction(s, { type: 'recruit', firmId: 'player', candidateId: id, move: 'drinks' })
    expect(me(r.state).cash).toBeLessThan(me(s).cash)
  })

  it('an offer either hires them into the roster or costs interest, and both happen', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 12 && outcomes.size < 2; seed++) {
      const s = newStartupGame(seed)
      const c = st(s).candidates[0]
      c.interest = 50
      const r = applyAction(s, { type: 'recruit', firmId: 'player', candidateId: c.person.id, move: 'offer' })
      expect(r.error).toBeUndefined()
      const hired = me(r.state).roster!.find((e) => e.id === c.person.id)
      if (hired) {
        outcomes.add('yes')
        expect(st(r.state).candidates.some((x) => x.person.id === c.person.id)).toBe(false)
        expect(me(r.state).pools[c.person.discipline].count).toBe(1)
        expect(me(r.state).cash).toBe(me(s).cash - HIRE_COST)
        expect(me(r.state).stats?.recruits).toBe(1)
      } else {
        outcomes.add('no')
        const after = st(r.state).candidates.find((x) => x.person.id === c.person.id)!
        expect(after.interest).toBe(50 - STARTUP_DECLINE_INTEREST)
        expect(
          applyAction(r.state, { type: 'recruit', firmId: 'player', candidateId: c.person.id, move: 'offer' }).error,
        ).toBe('errors.offerDeclined')
      }
    }
    expect(outcomes).toEqual(new Set(['yes', 'no']))
  })

  it('people stay a few quarters and cool off, and the hours come back', () => {
    let s = newStartupGame()
    const first = st(s).candidates[0]
    s = applyAction(s, { type: 'recruit', firmId: 'player', candidateId: first.person.id, move: 'linkedin' }).state
    const interest = st(s).candidates[0].interest
    s = endTurn(s)
    expect(st(s).hours).toBe(startupHours('magnus'))
    expect(st(s).candidates.find((c) => c.person.id === first.person.id)!.interest).toBeLessThan(interest)
    for (let q = 0; q < 3; q++) s = endTurn(s)
    if (me(s).startup) expect(st(s).candidates.some((c) => c.person.id === first.person.id)).toBe(false)
  })
})

describe('leaving the co-working space', () => {
  it('ends at level 2 and opens tenders and hiring orders', () => {
    const s = take(newStartupGame(), 'steady')
    addPeople(s, me(s), 'backend', 7, 2.5)
    const next = endTurn(s)
    expect(me(next).level).toBe(2)
    expect(me(next).startup).toBeUndefined()
    expect(next.news.some((n) => n.key === 'news.startup.graduated')).toBe(true)
    expect(
      applyAction(next, { type: 'orderHires', firmId: 'player', discipline: 'backend', count: 1 }).error,
    ).toBeUndefined()
    // The lead keeps running.
    expect(next.contracts.some((c) => c.tenderId === 'lead' && isActive(c, next.quarter))).toBe(true)
  })

  it('draws only co-working events during the phase, no crises, and never those events later', () => {
    let s = take(newStartupGame(4), 'steady')
    for (let q = 0; q < 8 && me(s).startup; q++) {
      s = endTurn(s)
      for (const pe of s.pendingEvents) expect(EVENT_MAP[pe.eventId].startup).toBe(true)
      expect(s.crises?.filter((c) => c.firmId === 'player') ?? []).toEqual([])
    }
    const later = structuredClone(s)
    delete me(later).startup
    let t = later
    for (let q = 0; q < 6; q++) {
      t = endTurn(t)
      for (const pe of t.pendingEvents) expect(EVENT_MAP[pe.eventId].startup).toBeFalsy()
    }
  })
})

describe('the UI side', () => {
  it('helpers and to-dos never touch the rng or the roster counter', () => {
    const s = newStartupGame()
    const rng = s.rng.s
    const seq = me(s).rosterSeq
    for (const l of st(s).leads) leadSeats(s, me(s), l)
    for (const c of st(s).candidates) {
      offerChance(c)
      for (const m of ['coffee', 'drinks', 'linkedin', 'offer'] as (Approach | 'offer')[])
        recruitBlock(me(s), c, m, s.quarter)
    }
    quarterTodos(s, 'player')
    expect(s.rng.s).toBe(rng)
    expect(me(s).rosterSeq).toBe(seq)
  })

  it('asks for a lead while people are free, and for the network when the work needs more people', () => {
    const s = newStartupGame()
    const ids = (x: GameState) => quarterTodos(x, 'player').map((t) => [t.id, t.done])
    expect(ids(s)).toEqual([['lead', false]])
    // Prestige wants one more person than the firm has free.
    const after = take(s, 'prestige')
    expect(ids(after)).toEqual([
      ['lead', true],
      ['network', false],
    ])
    const met = applyAction(after, {
      type: 'recruit',
      firmId: 'player',
      candidateId: st(after).candidates[0].person.id,
      move: 'coffee',
    }).state
    expect(ids(met)).toEqual([
      ['lead', true],
      ['network', true],
    ])
  })
})
