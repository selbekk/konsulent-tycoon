import { afterEach, describe, expect, it } from 'vitest'
import * as C from './constants'
import { BILLABLE_HOURS, FLEX_LEVEL, listRate } from './constants'
import { expireContracts } from './contracts'
import { contractRevenue, staffFirm } from './economy'
import { marketDemand, publishTenders, retenderContracts } from './tenders'
import { newTestGame } from './testUtils'
import type { Contract, GameState } from './types'
import { emptyPools, seatTotal } from './util'

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'cx', tenderId: 't', firmId: 'player', customerId: 'navet', kind: 'project',
  baseSeats: { frontend: 2 }, activeSeats: { frontend: 2 }, rateMultiplier: 1, share: 1, rank: 1,
  startQuarter: 0, endQuarter: 4, starIds: [], satisfaction: 70, outsourcedShare: 0,
  fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false }, terminated: false, ...over,
})

function isolated(): GameState {
  const s = newTestGame()
  s.firms.player.stars = []
  s.firms.player.pools = emptyPools()
  s.contracts = []
  return s
}

describe('market mechanics', () => {
  it('flex: bench people from another discipline fill seats before freelancers', () => {
    const s = isolated()
    s.firms.player.pools.backend = { count: 3, level: 3, morale: 60 }
    s.contracts.push(contract())
    const st = staffFirm(s, s.firms.player)
    expect(st.contracts[0].flex.frontend).toBe(2)
    expect(st.contracts[0].freelance.frontend).toBeUndefined()
    expect(st.billed).toBe(2)
    expect(contractRevenue(s.firms.player, s.contracts[0], st.contracts[0])).toBeCloseTo(2 * BILLABLE_HOURS * listRate(FLEX_LEVEL))
  })

  it('happy clients renew projects instead of re-tendering', () => {
    const s = isolated()
    s.contracts.push(contract({ satisfaction: 100, endQuarter: 3 }))
    const original = C.RENEWAL_CHANCE
    // Try a few seeds: with satisfaction 100 the chance is > 60 %.
    let renewed = false
    for (let i = 0; i < 10 && !renewed; i++) {
      const d = structuredClone(s)
      d.rng.s = i
      expireContracts(d, 3)
      renewed = d.contracts[0].endQuarter > 3
    }
    expect(renewed).toBe(true)
    expect(original).toBeGreaterThan(0)
    const unhappy = structuredClone(s)
    unhappy.contracts[0].satisfaction = 40
    expireContracts(unhappy, 3)
    expect(unhappy.contracts[0]?.endQuarter ?? 3).toBe(3)
  })

  it('a bankrupt firm’s live contracts go back out to tender', () => {
    const s = isolated()
    const before = s.tenders.length
    retenderContracts(s, [contract({ endQuarter: 10, baseSeats: { backend: 5 } })], 1)
    expect(s.tenders).toHaveLength(before + 1)
    const t = s.tenders.at(-1)!
    expect(t.seats.backend).toBe(5)
    expect(t.duration).toBe(10 - 3)
    retenderContracts(s, [contract({ endQuarter: 3 })], 1)
    expect(s.tenders).toHaveLength(before + 1)
  })

  it('small gigs are published every quarter, even in a saturated market', () => {
    const s = newTestGame()
    s.baseDemand = 0 // no demand gap at all
    s.tenders = []
    publishTenders(s, 1)
    const small = s.tenders.filter((t) => seatTotal(t.seats) <= 2)
    expect(small.length).toBeGreaterThanOrEqual(3)
    expect(small.every((t) => t.kind === 'project' && t.duration >= 1 && t.duration <= 3)).toBe(true)
  })

  it('demand does not follow shrinking capacity', () => {
    const s = newTestGame()
    const demand = marketDemand(s, 4)
    for (const id of s.firmOrder.slice(1, 10)) s.firms[id].bankrupt = true
    expect(marketDemand(s, 4)).toBeCloseTo(demand)
    s.tenders = []
    publishTenders(s, 1)
    expect(s.tenders.reduce((a, t) => a + seatTotal(t.seats), 0)).toBeGreaterThan(0)
  })
})

afterEach(() => undefined)
