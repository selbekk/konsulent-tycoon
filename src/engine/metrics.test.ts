import { describe, expect, it } from 'vitest'
import { BILLABLE_HOURS, listRate } from './constants'
import { benchmark, capacity, kpis } from './metrics'
import { applyAction } from './reducer'
import { newTestGame } from './testUtils'
import { endTurn } from './turn'
import type { Contract, GameState } from './types'
import { emptyPools } from './util'

function isolated(): GameState {
  const s = newTestGame()
  const p = s.firms.player
  p.stars = []
  p.pools = emptyPools()
  p.pools.backend = { count: 5, level: 3, morale: 60 }
  s.contracts = []
  return s
}

const contract = (seats: number, over: Partial<Contract> = {}): Contract => ({
  id: 'c1', tenderId: 't', firmId: 'player', customerId: 'navet', kind: 'project',
  baseSeats: { backend: seats }, activeSeats: { backend: seats }, rateMultiplier: 1.2, share: 1, rank: 1,
  startQuarter: 0, endQuarter: 4, starIds: [], satisfaction: 70, outsourcedShare: 0,
  fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false }, terminated: false, ...over,
})

describe('metrics', () => {
  it('FG and OT come from own people only', () => {
    const s = isolated()
    s.contracts.push(contract(8)) // 5 own + 3 freelancers
    const k = kpis(s, 'player')
    expect(k.fg.now).toBe(1)
    expect(k.ot.now).toBeCloseTo(listRate(3) * 1.2)
  })

  it('capacity splits billing, bench, offered and idle', () => {
    let s = isolated()
    s.contracts.push(contract(2, { endQuarter: 1 })) // ends after this quarter
    const t = s.tenders.find((x) => !x.resolved)!
    const seats = Object.values(t.seats).reduce((a, b) => a + (b ?? 0), 0)
    s = applyAction(s, { type: 'placeBid', tenderId: t.id, bid: { firmId: 'player', rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false } }).state
    const c = capacity(s, 'player')
    expect(c).toMatchObject({ headcount: 5, billing: 2, bench: 3 })
    expect(c.next.committed).toBe(0)
    expect(c.next.offered).toBe(Math.min(5, seats))
    expect(c.next.offered + c.next.idle + c.next.committed).toBe(5)
  })

  it('retention and growth need history', () => {
    let s = newTestGame(4)
    expect(kpis(s, 'player').growth.yoy).toBeUndefined()
    for (let i = 0; i < 5; i++) s = endTurn(s)
    const k = kpis(s, 'player')
    expect(k.growth.yoy).toBeDefined()
    expect(k.retention.value).toBeGreaterThan(0)
    expect(k.retention.value).toBeLessThanOrEqual(1)
    expect(k.ot.trend.length).toBeGreaterThan(0)
  })

  it('fired people are counted separately from leavers', () => {
    let s = newTestGame(4)
    s = applyAction(s, { type: 'fire', firmId: 'player', discipline: 'backend', count: 1 }).state
    s = endTurn(s)
    expect(s.firms.player.history.at(-1)!.fired).toBe(1)
    expect(kpis(s, 'player').retention.fired).toBe(1)
  })

  it('benchmark averages the other firms', () => {
    let s = newTestGame(4)
    s = endTurn(s)
    const b = benchmark(s, 'player')
    expect(b.fg).toBeGreaterThan(0.3)
    expect(b.ot).toBeGreaterThan(BILLABLE_HOURS > 0 ? 1000 : 0)
  })
})
