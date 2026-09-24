import {
  CANCEL_FEE_QUARTERS,
  CANCEL_RELATION_HIT,
  CANCEL_REPUTATION_HIT,
  NURTURE_COOLDOWN,
  NURTURE_COST_MIN,
  NURTURE_COST_SHARE,
  NURTURE_MAX_SATISFACTION,
  NURTURE_RELATION,
  NURTURE_SATISFACTION,
  RATE_MAX,
  RENEGOTIATE_BASE,
  RENEGOTIATE_FAIL_RELATION,
  RENEGOTIATE_FAIL_SATISFACTION,
  RENEGOTIATE_PER_RELATION,
  RENEGOTIATE_PER_SATISFACTION,
  RENEGOTIATE_PRICE_WEIGHT,
  RENEGOTIATE_RATE_GAIN,
  RENEGOTIATE_WIN_SATISFACTION,
  UPSELL_BASE,
  UPSELL_COOLDOWN,
  UPSELL_FAIL_SATISFACTION,
  UPSELL_MAX_SEATS,
  UPSELL_PER_EXTRA_SEAT,
  UPSELL_PER_SATISFACTION,
  clamp,
} from './constants'
import { terminateContract } from './contracts'
import { contractRevenue, isActive, spendable } from './economy'
import { hasFeature, maxTenderSeats } from './levels'
import { chance } from './rng'
import { DISCIPLINES } from './types'
import type { ActionOf, Contract, Discipline, Firm, GameState } from './types'
import { addNews, seatTotal } from './util'

export type ContractMove = 'renegotiate' | 'cancel' | 'upsell' | 'nurture'

const relationOf = (state: GameState, c: Contract) => state.customers[c.customerId]?.relationships[c.firmId] ?? 20
const bump = (state: GameState, c: Contract, delta: number) => {
  const cust = state.customers[c.customerId]
  if (cust) cust.relationships[c.firmId] = clamp(relationOf(state, c) + delta, 0, 100)
}

/** Chance the customer accepts a higher rate. Pure – safe for the UI. */
export function renegotiateChance(state: GameState, c: Contract): number {
  const priceWeight = state.customers[c.customerId]?.priceWeight ?? 0.5
  return clamp(
    RENEGOTIATE_BASE +
      (c.satisfaction - 60) * RENEGOTIATE_PER_SATISFACTION +
      (relationOf(state, c) - 50) * RENEGOTIATE_PER_RELATION -
      (priceWeight - 0.5) * RENEGOTIATE_PRICE_WEIGHT,
    0,
    1,
  )
}

/** Chance the customer takes `count` more people. Pure – safe for the UI. */
export function upsellChance(c: Contract, count: number): number {
  return clamp(UPSELL_BASE + (c.satisfaction - 60) * UPSELL_PER_SATISFACTION - (count - 1) * UPSELL_PER_EXTRA_SEAT, 0, 1)
}

/** One quarter of the contract's revenue at the firm's own level. */
export const cancelFee = (firm: Firm, c: Contract) => Math.round(contractRevenue(firm, c) * CANCEL_FEE_QUARTERS)

export const nurtureCost = (firm: Firm, c: Contract) =>
  Math.round(Math.max(NURTURE_COST_MIN, contractRevenue(firm, c) * NURTURE_COST_SHARE) / 1000) * 1000

/** Most seats an upsell may add without the contract outgrowing the firm's level. */
export const upsellRoom = (firm: Firm, c: Contract) =>
  Math.max(0, Math.min(UPSELL_MAX_SEATS, maxTenderSeats(firm) - seatTotal(c.activeSeats)))

/**
 * Why a move is not possible right now (an i18n error key), or undefined if it is.
 * Shared by the reducer, the planners and the UI, so all three agree. Pure.
 */
export function contractMoveBlock(state: GameState, firm: Firm, c: Contract, move: ContractMove, count = 1): string | undefined {
  if (c.firmId !== firm.id || c.terminated || c.endQuarter <= state.quarter) return 'errors.invalidContract'
  const active = isActive(c, state.quarter)
  switch (move) {
    case 'cancel':
      return cancelFee(firm, c) > spendable(firm) ? 'errors.notEnoughCash' : undefined
    case 'nurture':
      if (!active) return 'errors.contractNotStarted'
      if (c.nurtureQuarter !== undefined && state.quarter - c.nurtureQuarter < NURTURE_COOLDOWN) return 'errors.contractCooldown'
      if (c.satisfaction >= NURTURE_MAX_SATISFACTION) return 'errors.customerHappy'
      return nurtureCost(firm, c) > spendable(firm) ? 'errors.notEnoughCash' : undefined
    case 'renegotiate':
      if (!hasFeature(firm, 'renegotiate')) return 'errors.levelTooLow'
      // The customer needs to have seen some work first.
      if (!active || state.quarter <= c.startQuarter) return 'errors.contractNotStarted'
      if (c.renegotiated) return 'errors.alreadyDone'
      return c.rateMultiplier >= RATE_MAX ? 'errors.rateAtMax' : undefined
    case 'upsell':
      if (!hasFeature(firm, 'upsell')) return 'errors.levelTooLow'
      // Framework call-offs are rolled by the customer each quarter.
      if (c.kind !== 'project') return 'errors.upsellFramework'
      if (!active) return 'errors.contractNotStarted'
      if (c.upsell && state.quarter - c.upsell.quarter < UPSELL_COOLDOWN) return 'errors.contractCooldown'
      if (!Number.isInteger(count) || count < 1 || count > upsellRoom(firm, c)) return 'errors.upsellTooBig'
      return undefined
  }
}

function target(state: GameState, a: { firmId: string; contractId: string }) {
  const firm = state.firms[a.firmId]
  const c = state.contracts.find((x) => x.id === a.contractId)
  return firm && !firm.bankrupt && c ? { firm, c } : undefined
}

const news = (state: GameState, firm: Firm, key: string, c: Contract, tone: 'good' | 'bad' | 'neutral', params = {}) => {
  if (firm.isPlayer) addNews(state, key, { customer: c.customerId, ...params }, tone, { firmId: firm.id, personal: true })
}

// A "no" from the customer is an outcome, not an error: the handlers return undefined so the
// penalty and the used-up attempt are kept (an error would make applyAction discard the draft).

export function handleRenegotiate(state: GameState, a: ActionOf<'renegotiateContract'>): string | undefined {
  const t = target(state, a)
  if (!t) return 'errors.invalidContract'
  const { firm, c } = t
  const blocked = contractMoveBlock(state, firm, c, 'renegotiate')
  if (blocked) return blocked
  if (chance(state.rng, renegotiateChance(state, c))) {
    c.renegotiated = 'won'
    c.rateMultiplier = Math.round(Math.min(RATE_MAX, c.rateMultiplier + RENEGOTIATE_RATE_GAIN) * 100) / 100
    c.satisfaction = clamp(c.satisfaction - RENEGOTIATE_WIN_SATISFACTION, 0, 100)
    news(state, firm, 'news.contract.renegotiated', c, 'good', { rate: c.rateMultiplier.toFixed(2) })
  } else {
    c.renegotiated = 'lost'
    c.satisfaction = clamp(c.satisfaction - RENEGOTIATE_FAIL_SATISFACTION, 0, 100)
    bump(state, c, -RENEGOTIATE_FAIL_RELATION)
    news(state, firm, 'news.contract.renegotiateFailed', c, 'bad')
  }
  return undefined
}

export function handleCancel(state: GameState, a: ActionOf<'cancelContract'>): string | undefined {
  const t = target(state, a)
  if (!t) return 'errors.invalidContract'
  const { firm, c } = t
  const blocked = contractMoveBlock(state, firm, c, 'cancel')
  if (blocked) return blocked
  firm.cash -= cancelFee(firm, c)
  firm.reputation = clamp(firm.reputation - CANCEL_REPUTATION_HIT, 0, 100)
  c.cancelled = true
  terminateContract(state, c, undefined, CANCEL_RELATION_HIT)
  news(state, firm, 'news.contract.cancelled', c, 'neutral')
  return undefined
}

export function handleUpsell(state: GameState, a: ActionOf<'upsellContract'>): string | undefined {
  const t = target(state, a)
  if (!t || !DISCIPLINES.includes(a.discipline)) return 'errors.invalidContract'
  const { firm, c } = t
  const count = Math.round(a.count)
  const blocked = contractMoveBlock(state, firm, c, 'upsell', count)
  if (blocked) return blocked
  const won = chance(state.rng, upsellChance(c, count))
  c.upsell = { quarter: state.quarter, won, seats: count }
  if (won) {
    const d: Discipline = a.discipline
    c.baseSeats[d] = (c.baseSeats[d] ?? 0) + count
    c.activeSeats[d] = (c.activeSeats[d] ?? 0) + count
    news(state, firm, 'news.contract.upsold', c, 'good', { count, discipline: d })
  } else {
    c.satisfaction = clamp(c.satisfaction - UPSELL_FAIL_SATISFACTION, 0, 100)
    news(state, firm, 'news.contract.upsellFailed', c, 'neutral')
  }
  return undefined
}

export function handleNurture(state: GameState, a: ActionOf<'nurtureContract'>): string | undefined {
  const t = target(state, a)
  if (!t) return 'errors.invalidContract'
  const { firm, c } = t
  const blocked = contractMoveBlock(state, firm, c, 'nurture')
  if (blocked) return blocked
  firm.cash -= nurtureCost(firm, c)
  c.nurtureQuarter = state.quarter
  c.satisfaction = Math.max(c.satisfaction, Math.min(NURTURE_MAX_SATISFACTION, c.satisfaction + NURTURE_SATISFACTION))
  bump(state, c, NURTURE_RELATION)
  return undefined
}
