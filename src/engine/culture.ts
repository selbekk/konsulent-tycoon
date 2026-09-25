import { TRAIT_MAP } from '../content/traits'
import { BRAND_MOD_DECAY, CULTURE_DECAY, CULTURE_GAIN_PER_1000, PORTFOLIO_BRAND_WEIGHT, clamp } from './constants'
import { portfolioAppeal } from './customers'
import type { Firm, GameState } from './types'

export function nextCultureLevel(level: number, budgetPerHead: number): number {
  return clamp(level * CULTURE_DECAY + (budgetPerHead / 1000) * CULTURE_GAIN_PER_1000, 0, 100)
}

/** Steady-state culture level for a given budget – for UI hints. */
export function cultureEquilibrium(budgetPerHead: number): number {
  return clamp(((budgetPerHead / 1000) * CULTURE_GAIN_PER_1000) / (1 - CULTURE_DECAY), 0, 100)
}

export function updateCulture(firm: Firm) {
  firm.fagmiljo = nextCultureLevel(firm.fagmiljo, firm.budgets.fagmiljoPerHead)
  firm.sosialt = nextCultureLevel(firm.sosialt, firm.budgets.sosialtPerHead)
  firm.brandMod *= BRAND_MOD_DECAY
  if (Math.abs(firm.brandMod) < 0.5) firm.brandMod = 0
}

/** Employer brand points from the firm's current customers. Pure. */
export function portfolioBrand(state: GameState, firm: Firm): number {
  return (portfolioAppeal(state, firm) - 50) * PORTFOLIO_BRAND_WEIGHT
}

export function employerBrand(state: GameState, firm: Firm): number {
  const traitBrand = firm.stars.reduce(
    (sum, s) => sum + s.traits.reduce((t, id) => t + (TRAIT_MAP[id]?.brand ?? 0), 0),
    0,
  )
  return clamp(
    0.4 * firm.fagmiljo +
      0.3 * firm.sosialt +
      0.3 * firm.reputation +
      firm.brandMod +
      traitBrand +
      portfolioBrand(state, firm),
    0,
    100,
  )
}
