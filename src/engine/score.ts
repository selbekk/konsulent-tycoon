import { IPO_MULTIPLE_BONUS, clamp } from './constants'
import { shadyStats } from './shady'
import type { Firm, GameState } from './types'

export function valuationMultiple(firm: Firm): number {
  return clamp(4 + firm.reputation / 25, 4, 8) + (firm.listed ? IPO_MULTIPLE_BONUS : 0)
}

/** EBITDA of the last four quarters × multiple (driven by reputation) + cash. A listed firm counts only the owners' share. */
export function valuation(firm: Firm): number {
  if (firm.bankrupt) return 0
  const recent = firm.history.slice(-4)
  const ebitda = recent.reduce((s, r) => s + r.ebitda, 0)
  const annualised = recent.length ? (ebitda / recent.length) * 4 : 0
  const value = annualised > 0 ? annualised * valuationMultiple(firm) : annualised
  return Math.max(0, value + firm.cash) * (1 - (firm.listed?.share ?? 0))
}

export function rankings(state: GameState): { firmId: string; value: number }[] {
  return state.firmOrder
    .map((id) => ({ firmId: id, value: valuation(state.firms[id]) }))
    .sort((a, b) => b.value - a.value || a.firmId.localeCompare(b.firmId))
}

export function playerRank(state: GameState): number {
  return rankings(state).findIndex((r) => r.firmId === state.playerId) + 1
}

export type EndTitle =
  | 'bankrupt'
  | 'ethical_champion'
  | 'cheated_to_top'
  | 'industry_leader'
  | 'caught_pants_down'
  | 'solid_challenger'
  | 'midfield'
  | 'acquired'

export function endTitle(state: GameState): EndTitle {
  const firm = state.firms[state.playerId]
  if (firm.bankrupt) return 'bankrupt'
  const rank = playerRank(state)
  const { total, detected } = shadyStats(firm)
  if (rank === 1 && total === 0) return 'ethical_champion'
  if (rank === 1 && total >= 10) return 'cheated_to_top'
  if (rank === 1) return 'industry_leader'
  if (detected >= 3) return 'caught_pants_down'
  if (rank <= 5) return 'solid_challenger'
  if (rank <= 12) return 'midfield'
  return 'acquired'
}
