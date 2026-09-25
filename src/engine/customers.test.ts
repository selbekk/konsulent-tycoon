import { describe, expect, it } from 'vitest'
import { CUSTOMERS, CUSTOMER_MAP, CUSTOMER_METRICS } from '../content/customers'
import { CUSTOMER_APPEAL_WEIGHTS, PORTFOLIO_APPEAL_HALF_SEATS } from './constants'
import { employerBrand, portfolioBrand } from './culture'
import { customerAppeal, loyaltyRenewalFactor, maturitySatisfaction, portfolioAppeal, seniorityCvFactor } from './customers'
import { acceptRate, newHireLevel } from './staff'
import { bidQualityParts } from './tenders'
import { deepFreeze, newTestGame } from './testUtils'
import type { GameState, Seats } from './types'

/** The player works only for `customerId`, with `seats` people there. */
function onlyCustomer(customerId: string, seats: Seats): GameState {
  const s = newTestGame()
  s.contracts = s.contracts.filter((c) => c.firmId !== s.playerId)
  s.contracts.push({
    id: 'c-test',
    tenderId: 'test',
    firmId: s.playerId,
    customerId,
    kind: 'project',
    baseSeats: seats,
    activeSeats: { ...seats },
    rateMultiplier: 1,
    share: 1,
    rank: 1,
    startQuarter: 0,
    endQuarter: s.quarter + 4,
    starIds: [],
    satisfaction: 70,
    outsourcedShare: 0,
    fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
    terminated: false,
  })
  return s
}

const best = CUSTOMERS.reduce((a, b) => (customerAppeal(b) > customerAppeal(a) ? b : a))
const worst = CUSTOMERS.reduce((a, b) => (customerAppeal(b) < customerAppeal(a) ? b : a))

describe('customer profiles', () => {
  it('gives every customer every metric as a whole number from 1 to 5', () => {
    for (const c of CUSTOMERS) {
      for (const m of CUSTOMER_METRICS) {
        expect(Number.isInteger(c.profile[m]), `${c.id}.${m}`).toBe(true)
        expect(c.profile[m]).toBeGreaterThanOrEqual(1)
        expect(c.profile[m]).toBeLessThanOrEqual(5)
      }
    }
  })

  it('keeps appeal weights summing to 1, so appeal runs 0–100', () => {
    const sum = Object.values(CUSTOMER_APPEAL_WEIGHTS).reduce((a, w) => a + Math.abs(w), 0)
    expect(sum).toBeCloseTo(1)
    for (const c of CUSTOMERS) {
      expect(customerAppeal(c)).toBeGreaterThanOrEqual(0)
      expect(customerAppeal(c)).toBeLessThanOrEqual(100)
    }
  })

  it('makes the startup more appealing than the joint municipal purchase', () => {
    expect(customerAppeal(CUSTOMER_MAP.kryptonitt)).toBeGreaterThan(customerAppeal(CUSTOMER_MAP.kommunenorge))
  })
})

describe('portfolio appeal', () => {
  it('is neutral without contracts', () => {
    const s = onlyCustomer(best.id, {})
    s.contracts = []
    expect(portfolioAppeal(s, s.firms[s.playerId])).toBe(50)
    expect(portfolioBrand(s, s.firms[s.playerId])).toBe(0)
  })

  it('counts half at the half-way seat count, and more with more seats', () => {
    const half = onlyCustomer(best.id, { backend: PORTFOLIO_APPEAL_HALF_SEATS })
    expect(portfolioAppeal(half, half.firms.player)).toBeCloseTo(50 + (customerAppeal(best) - 50) / 2)
    const small = onlyCustomer(best.id, { backend: 1 })
    expect(portfolioAppeal(small, small.firms.player)).toBeLessThan(portfolioAppeal(half, half.firms.player))
  })

  it('makes cool customers mean an easier and better hire', () => {
    const good = onlyCustomer(best.id, { backend: 20 })
    const bad = onlyCustomer(worst.id, { backend: 20 })
    expect(employerBrand(good, good.firms.player)).toBeGreaterThan(employerBrand(bad, bad.firms.player))
    expect(acceptRate(good, good.firms.player)).toBeGreaterThan(acceptRate(bad, bad.firms.player))
    expect(newHireLevel(good, good.firms.player)).toBeGreaterThan(newHireLevel(bad, bad.firms.player))
  })

  it('is pure: no input mutation, no rng draws', () => {
    const s = deepFreeze(onlyCustomer(best.id, { backend: 5 }))
    const rng = JSON.stringify(s.rng)
    portfolioAppeal(s, s.firms.player)
    employerBrand(s, s.firms.player)
    acceptRate(s, s.firms.player)
    expect(JSON.stringify(s.rng)).toBe(rng)
  })
})

describe('customer character in the mechanics', () => {
  type M = 'seniority' | 'maturity' | 'loyalty'
  const byMetric = (m: M, v: number) => CUSTOMERS.find((c) => c.profile[m] === v)!.id
  const most = (m: M) => CUSTOMERS.reduce((a, b) => (b.profile[m] > a.profile[m] ? b : a)).id
  const least = (m: M) => CUSTOMERS.reduce((a, b) => (b.profile[m] < a.profile[m] ? b : a)).id

  it('neutral customers (3) change nothing', () => {
    expect(seniorityCvFactor(byMetric('seniority', 3))).toBe(1)
    expect(maturitySatisfaction(byMetric('maturity', 3))).toBe(0)
    expect(loyaltyRenewalFactor(byMetric('loyalty', 3))).toBe(1)
  })

  it('weighs CVs more where the seniority bar is high', () => {
    expect(seniorityCvFactor(most('seniority'))).toBeGreaterThan(seniorityCvFactor(least('seniority')))
    const s = newTestGame()
    const tender = s.tenders.find((t) => !t.resolved)!
    const bid = { firmId: s.playerId, rateMultiplier: 1, starIds: [], effort: 0 as const, cvPad: false, ghostCv: false }
    const cvAt = (customerId: string) => bidQualityParts(s, bid, { ...tender, customerId })!.cv
    expect(cvAt(most('seniority'))).toBeGreaterThan(cvAt(least('seniority')))
  })

  it('makes mature customers easier to please and loyal ones renew more', () => {
    expect(maturitySatisfaction(most('maturity'))).toBeGreaterThan(maturitySatisfaction(least('maturity')))
    expect(loyaltyRenewalFactor(most('loyalty'))).toBeGreaterThan(loyaltyRenewalFactor(least('loyalty')))
  })
})
