import { TRAIT_MAP } from '../content/traits'
import {
  HIRE_BASE_ACCEPT,
  HIRE_COST,
  MORALE_ADJUST_RATE,
  MORALE_BASE,
  MORALE_CULTURE_WEIGHT,
  SCANDAL_PENALTY_DECAY,
  TURNOVER_BASE,
  TURNOVER_MORALE_DIVISOR,
  TURNOVER_MORALE_PIVOT,
  clamp,
} from './constants'
import { employerBrand } from './culture'
import { binomial, noise } from './rng'
import { DISCIPLINES } from './types'
import type { Discipline, Firm, GameState } from './types'
import { addPeople, removePeople } from './roster'
import { addNews } from './util'

export function utilizationEffect(util: number): number {
  if (util > 0.95) return -15
  if (util >= 0.75) return 10
  if (util >= 0.5) return 0
  return -10
}

export function salaryEffect(premium: number): number {
  return clamp(premium * 100, -15, 15)
}

/** Target morale for a discipline pool (or the firm in general when discipline is omitted). */
export function moraleTarget(firm: Firm, util: number, discipline?: Discipline): number {
  let traitMorale = 0
  if (discipline) {
    for (const s of firm.stars) {
      if (s.discipline !== discipline) continue
      for (const t of s.traits) traitMorale += TRAIT_MAP[t]?.poolMorale ?? 0
    }
  }
  return clamp(
    MORALE_BASE +
      MORALE_CULTURE_WEIGHT * firm.fagmiljo +
      MORALE_CULTURE_WEIGHT * firm.sosialt +
      utilizationEffect(util) +
      salaryEffect(firm.budgets.salaryPremium) +
      traitMorale -
      firm.scandalPenalty,
    0,
    100,
  )
}

export function updateMorale(firm: Firm, util: number) {
  for (const d of DISCIPLINES) {
    const p = firm.pools[d]
    p.morale = clamp(p.morale + (moraleTarget(firm, util, d) - p.morale) * MORALE_ADJUST_RATE, 0, 100)
  }
  firm.scandalPenalty *= SCANDAL_PENALTY_DECAY
  if (firm.scandalPenalty < 0.5) firm.scandalPenalty = 0
}

export function turnoverChance(morale: number): number {
  return TURNOVER_BASE + Math.max(0, TURNOVER_MORALE_PIVOT - morale) / TURNOVER_MORALE_DIVISOR
}

export function applyTurnover(state: GameState, firm: Firm) {
  let leavers = 0
  for (const d of DISCIPLINES) {
    const p = firm.pools[d]
    const n = binomial(state.rng, p.count, turnoverChance(p.morale))
    removePeople(state, firm, d, n)
    leavers += n
  }
  firm.quarterLeavers += leavers
  if (firm.isPlayer && leavers >= 3) {
    addNews(state, 'news.staff.leftMany', { count: leavers }, 'bad', { firmId: firm.id, personal: true })
  }
}

export function acceptRate(firm: Firm): number {
  return clamp(
    HIRE_BASE_ACCEPT + employerBrand(firm) / 150 + firm.budgets.salaryPremium * 2 + firm.reputation / 200,
    0,
    1,
  )
}

export function newHireLevel(firm: Firm): number {
  return 2 + firm.fagmiljo / 50
}

/** This quarter's hiring orders are rolled for acceptance and join at the quarter change, ready to bill next quarter. */
export function processHiring(state: GameState, firm: Firm) {
  const rate = acceptRate(firm)
  // Older saves may still hold hires accepted under the previous two-step pipeline.
  const arriving: Partial<Record<Discipline, number>> = { ...firm.pendingHires }
  let accepted = 0
  for (const d of DISCIPLINES) {
    const ordered = firm.hiringOrders[d] ?? 0
    if (!ordered) continue
    const n = binomial(state.rng, ordered, rate)
    arriving[d] = (arriving[d] ?? 0) + n
    accepted += n
  }
  firm.hiringOrders = {}
  firm.pendingHires = {}
  firm.cash -= accepted * HIRE_COST

  let arrived = 0
  for (const d of DISCIPLINES) {
    const n = arriving[d] ?? 0
    if (!n) continue
    const level = clamp(newHireLevel(firm) + noise(state.rng, 0.5), 1, 4.5)
    addPeople(state, firm, d, n, level, 72)
    arrived += n
  }
  firm.quarterHires += arrived
  if (firm.isPlayer && arrived > 0) {
    addNews(state, 'news.staff.arrived', { count: arrived }, 'good', { firmId: firm.id, personal: true })
  }
}
