import { describe, expect, it } from 'vitest'
import { applyAction } from './reducer'
import { deepFreeze, makeKeyTender, newTestGame } from './testUtils'
import { quarterTodos } from './todos'
import type { Bid, GameState } from './types'

const todo = (s: GameState, id: string) => quarterTodos(s, 'player').find((t) => t.id === id)
const bid = (overrides: Partial<Bid> = {}): Bid => ({
  firmId: 'player',
  rateMultiplier: 1,
  starIds: [],
  effort: 0,
  cvPad: false,
  ghostCv: false,
  ...overrides,
})

describe('quarter todos', () => {
  it('asks a new firm to bid, and checks it off once the bench is offered', () => {
    let s = newTestGame()
    expect(todo(s, 'bid')).toMatchObject({ done: false })
    for (const t of s.tenders.filter((x) => !x.resolved && !x.hidden)) {
      s = applyAction(s, { type: 'placeBid', tenderId: t.id, bid: bid() }).state
    }
    expect(todo(s, 'bid')?.done).toBe(true)
  })

  it('flags key bids decided this quarter that have no customer meeting', () => {
    let s = newTestGame()
    const routine = s.tenders.filter((x) => !x.resolved && !x.hidden)[1]
    routine.dueQuarter = s.quarter
    routine.seats = { backend: 1 }
    s = applyAction(s, { type: 'placeBid', tenderId: routine.id, bid: bid() }).state
    // Routine tenders have no meeting, so nothing to flag.
    expect(todo(s, 'pitch')).toBeUndefined()
    const t = makeKeyTender(s.tenders.find((x) => !x.resolved && !x.hidden)!)
    t.dueQuarter = s.quarter
    expect(todo(s, 'pitch')).toBeUndefined()
    s = applyAction(s, { type: 'placeBid', tenderId: t.id, bid: bid() }).state
    expect(todo(s, 'pitch')).toMatchObject({ done: false, params: { count: 1 } })
    s = applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: t.id, kind: 'meeting', score: 50 }).state
    expect(todo(s, 'pitch')?.done).toBe(true)
  })

  it('suggests hiring when signed work outgrows the team, done once enough is ordered', () => {
    let s = newTestGame()
    s.firms.player.cash = 50_000_000
    s.contracts.push({
      id: 'big',
      tenderId: 't',
      firmId: 'player',
      customerId: 'navet',
      kind: 'project',
      baseSeats: { backend: 20 },
      activeSeats: { backend: 20 },
      rateMultiplier: 1,
      share: 1,
      rank: 1,
      startQuarter: 0,
      endQuarter: 8,
      starIds: [],
      satisfaction: 70,
      outsourcedShare: 0,
      fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
      terminated: false,
    })
    const hire = todo(s, 'hire')!
    expect(hire.done).toBe(false)
    s = applyAction(s, { type: 'orderHires', firmId: 'player', discipline: 'backend', count: hire.params.count }).state
    expect(todo(s, 'hire')?.done).toBe(true)
  })

  it('stays quiet at the end of the game, when new work would start too late', () => {
    const s = newTestGame()
    s.quarter = s.maxQuarters - 1
    for (const t of s.tenders) t.publishedQuarter = Math.min(t.publishedQuarter, s.quarter)
    expect(quarterTodos(s, 'player').filter((t) => !t.done)).toEqual([])
    s.quarter = s.maxQuarters - 3
    expect(todo(s, 'bid')).toBeDefined()
  })

  it('is pure: never mutates input or touches the rng', () => {
    const s = deepFreeze(newTestGame())
    const before = s.rng.s
    quarterTodos(s, 'player')
    expect(s.rng.s).toBe(before)
  })
})
