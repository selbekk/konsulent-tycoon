import { CUSTOMER_MAP } from '../content/customers'
import type { CustomerDef } from '../content/customers'
import {
  CUSTOMER_APPEAL_WEIGHTS,
  CUSTOMER_LOYALTY_RENEWAL,
  CUSTOMER_MATURITY_SATISFACTION,
  CUSTOMER_SENIORITY_CV,
  PORTFOLIO_APPEAL_HALF_SEATS,
} from './constants'
import { activeContracts } from './economy'
import type { Firm, GameState } from './types'
import { seatTotal } from './util'

/** How attractive the customer is to consultants, 0–100. Pure content, no state. */
export function customerAppeal(def: CustomerDef): number {
  let sum = 0
  for (const [key, w] of Object.entries(CUSTOMER_APPEAL_WEIGHTS)) {
    const v = (def.profile[key as keyof typeof CUSTOMER_APPEAL_WEIGHTS] - 1) / 4
    sum += w >= 0 ? w * v : -w * (1 - v)
  }
  return sum * 100
}

/**
 * How attractive the firm's current customers make it, 0–100 with 50 as neutral. The seat-weighted
 * average is pulled towards 50 for small portfolios, so one contract doesn't swing the brand. Pure.
 */
export function portfolioAppeal(state: GameState, firm: Firm): number {
  let seats = 0
  let sum = 0
  for (const c of activeContracts(state, firm.id)) {
    const def = CUSTOMER_MAP[c.customerId]
    if (!def) continue
    const n = seatTotal(c.activeSeats)
    seats += n
    sum += n * customerAppeal(def)
  }
  if (seats === 0) return 50
  return 50 + (sum / seats - 50) * (seats / (seats + PORTFOLIO_APPEAL_HALF_SEATS))
}

/** Steps away from the middle (3) of a profile metric, 0 for unknown customers. */
const step = (customerId: string, metric: keyof CustomerDef['profile']) =>
  (CUSTOMER_MAP[customerId]?.profile[metric] ?? 3) - 3

/** Customers with a high seniority bar weigh the CV part of bid quality more. */
export const seniorityCvFactor = (customerId: string) => 1 + step(customerId, 'seniority') * CUSTOMER_SENIORITY_CV

/** Mature customers are easier to keep happy: an offset to the contract's satisfaction target. */
export const maturitySatisfaction = (customerId: string) =>
  step(customerId, 'maturity') * CUSTOMER_MATURITY_SATISFACTION

/** Loyal customers renew more often. */
export const loyaltyRenewalFactor = (customerId: string) => 1 + step(customerId, 'loyalty') * CUSTOMER_LOYALTY_RENEWAL
