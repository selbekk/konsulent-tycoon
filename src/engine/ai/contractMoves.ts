import { NURTURE_TODO_BELOW } from '../constants'
import { contractMoveBlock, renegotiateChance, upsellChance } from '../contractActions'
import { activeContracts, disciplineSupply } from '../economy'
import { chance } from '../rng'
import { DISCIPLINES } from '../types'
import type { Action, GameState, Seats } from '../types'

/**
 * Conservative contract moves shared by AI firms and the human proxy: look after clients at
 * risk, ask very happy ones for a better rate, and offer people who would otherwise sit on
 * the bench. Nobody walks away from a contract. Only proposes moves the reducer accepts.
 * `eagerness` is the chance to try a renegotiation that is likely to work (1 = always, no rng draw).
 * `nurtureRunway` is the runway needed to pay for customer care (0 = whenever the reducer allows it).
 * `demand` is this quarter's staffed demand (`quarterFinancials().staffing.demand`), passed in to save a staffing pass.
 */
export function planContractMoves(
  state: GameState,
  firmId: string,
  demand: Seats,
  opts: { runway: number; eagerness: number; nurtureRunway: number },
): Action[] {
  const firm = state.firms[firmId]
  const actions: Action[] = []
  const bench = Object.fromEntries(DISCIPLINES.map((d) => [d, disciplineSupply(firm, d) - (demand[d] ?? 0)]))
  let upsold = false
  for (const c of activeContracts(state, firmId)) {
    const move = { firmId, contractId: c.id }
    if (c.satisfaction < NURTURE_TODO_BELOW) {
      if (opts.runway > opts.nurtureRunway && !contractMoveBlock(state, firm, c, 'nurture'))
        actions.push({ type: 'nurtureContract', ...move })
      continue
    }
    if (
      !contractMoveBlock(state, firm, c, 'renegotiate') &&
      renegotiateChance(state, c) >= 0.8 &&
      (opts.eagerness >= 1 || chance(state.rng, opts.eagerness))
    ) {
      actions.push({ type: 'renegotiateContract', ...move })
      continue
    }
    if (upsold || contractMoveBlock(state, firm, c, 'upsell') || upsellChance(c, 1) < 0.6) continue
    const idle = DISCIPLINES.filter((d) => bench[d] >= 2).sort((a, b) => bench[b] - bench[a])[0]
    if (idle) {
      actions.push({ type: 'upsellContract', ...move, discipline: idle, count: 1 })
      upsold = true
    }
  }
  return actions
}
