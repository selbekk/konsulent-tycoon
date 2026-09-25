import { describe, expect, it } from 'vitest'
import { BILLABLE_HOURS, FREELANCER_LEVEL, FREELANCER_MARKUP, listRate } from './constants'
import { contractRevenue, headcount, quarterFinancials, staffFirm } from './economy'
import { newTestGame } from './testUtils'
import type { Contract, GameState } from './types'
import { emptyPools } from './util'

function isolated(): GameState {
  const s = newTestGame()
  const p = s.firms.player
  p.stars = []
  p.pools = emptyPools()
  p.pools.backend = { count: 4, level: 3, morale: 60 }
  s.contracts = []
  return s
}

const contract = (seats: number): Contract => ({
  id: 'c1',
  tenderId: 't',
  firmId: 'player',
  customerId: 'navet',
  kind: 'project',
  baseSeats: { backend: seats },
  activeSeats: { backend: seats },
  rateMultiplier: 1,
  share: 1,
  rank: 1,
  startQuarter: 0,
  endQuarter: 4,
  starIds: [],
  satisfaction: 70,
  outsourcedShare: 0,
  fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
  terminated: false,
})

describe('economy', () => {
  it('a firm without contracts only has costs', () => {
    const s = isolated()
    const fin = quarterFinancials(s, 'player')
    expect(fin.revenue).toBe(0)
    expect(fin.ebitda).toBeLessThan(0)
    expect(headcount(s.firms.player)).toBe(4)
  })

  it('bills staffed seats at list rate × multiplier', () => {
    const s = isolated()
    s.contracts.push(contract(4))
    const fin = quarterFinancials(s, 'player')
    expect(fin.revenue).toBe(4 * BILLABLE_HOURS * listRate(3))
    expect(fin.utilization).toBe(1)
    expect(fin.freelanceCost).toBe(0)
  })

  it('fills missing seats with freelancers at a small loss', () => {
    const s = isolated()
    s.contracts.push(contract(6))
    const staffing = staffFirm(s, s.firms.player)
    expect(staffing.contracts[0].freelance.backend).toBe(2)
    const fin = quarterFinancials(s, 'player')
    const freelanceRevenue = 2 * BILLABLE_HOURS * listRate(FREELANCER_LEVEL)
    expect(fin.freelanceCost).toBeCloseTo(freelanceRevenue * FREELANCER_MARKUP)
    expect(contractRevenue(s.firms.player, s.contracts[0], staffing.contracts[0])).toBeCloseTo(
      4 * BILLABLE_HOURS * listRate(3) + freelanceRevenue,
    )
  })

  it('takes outsourced seats out of own staffing', () => {
    const s = isolated()
    const c = contract(4)
    c.outsourcedShare = 0.5
    s.contracts.push(c)
    const st = staffFirm(s, s.firms.player)
    expect(st.contracts[0].offshore.backend).toBe(2)
    expect(st.billed).toBe(2)
  })
})
