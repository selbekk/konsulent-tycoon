import type { CrisisChoice, CrisisEffect } from '../../content/crises'
import { CRISIS_AI_HUSH } from '../constants'
import { benchCount, choiceEffect, crisisChoiceBlock, crisisChoices, openCrises } from '../crises'
import { activeContracts, headcount, quarterFinancials } from '../economy'
import type { Action, Crisis, Firm, GameState } from '../types'
import { personalityFor } from './personalities'

/** How a firm handles crises: care for people and reputation, appetite for hushing things up, crisis-talk skill (0–100). */
export interface CrisisStyle {
  care: number
  shady: number
  talk: number
}

/** The simulated player: decent, rarely shady, and as good at talking as humanProxy is in pitch meetings (70). */
export const HUMAN_CRISIS_STYLE: CrisisStyle = { care: 0.7, shady: 0.05, talk: 70 }

export function crisisStyleFor(firm: Firm): CrisisStyle {
  if (firm.isPlayer) return HUMAN_CRISIS_STYLE
  const p = personalityFor(firm.personalityId)
  const hush = CRISIS_AI_HUSH.base + CRISIS_AI_HUSH.perShadiness * p.shadiness + CRISIS_AI_HUSH.perCarelessness * (1 - p.qualityFocus)
  return { care: p.qualityFocus, shady: Math.min(1, hush), talk: Math.round(p.qualityFocus * 80) }
}

function expected(firm: Firm, c: Crisis, choice: CrisisChoice, talk: number): CrisisEffect {
  if (c.revealed) return choiceEffect(firm, c, choice, talk)
  // Unknown severity: average the two outcomes.
  const low = choiceEffect(firm, { ...c, severity: 'low' }, choice, talk)
  const high = choiceEffect(firm, { ...c, severity: 'high' }, choice, talk)
  const out: Record<string, number | boolean> = {}
  for (const k of new Set([...Object.keys(low), ...Object.keys(high)]) as Set<keyof CrisisEffect>) {
    const a = low[k]
    const b = high[k]
    out[k] = typeof a === 'boolean' || typeof b === 'boolean' ? !!(a || b) : ((Number(a ?? 0) + Number(b ?? 0)) / 2)
  }
  return out as CrisisEffect
}

/** Rough value of a choice, in "points". Money counts as its share of a quarter's revenue: 1 % ≈ 1 point. */
function value(state: GameState, firm: Firm, c: Crisis, choice: CrisisChoice, style: CrisisStyle): number {
  const e = expected(firm, c, choice, style.talk)
  const hc = Math.max(1, headcount(firm))
  const revenue = Math.max(1_000_000, quarterFinancials(state, firm.id).revenue)
  const perHead = Math.max(300_000, revenue / hc)
  const benched = (e.bench ? benchCount(firm, e.bench) : 0) + (e.benchStar ? 1.5 : 0)
  const money = (e.cash ?? 0) + (e.cashPerHead ?? 0) * hc + (e.contractRevenue ?? 0) * perHead * 3 - benched * perHead * 0.4
  const soft = 0.5 + style.care
  const outcome = typeof choice.outcome === 'string' ? choice.outcome : choice.outcome?.[c.revealed ? c.severity : 'high']
  return (
    (money / revenue) * 100 +
    ((e.reputation ?? 0) + (e.brand ?? 0)) * 0.6 * soft +
    ((e.morale ?? 0) + 0.5 * ((e.fagmiljo ?? 0) + (e.sosialt ?? 0)) + 0.2 * (e.starLoyalty ?? 0)) * 0.3 * soft +
    ((e.relationship ?? 0) + (e.satisfaction ?? 0) + (e.satisfactionAll ?? 0) * Math.min(3, activeContracts(state, firm.id).length)) * 0.25 -
    (e.rateCut ?? 0) * 40 -
    (e.heat ?? 0) * 0.3 * (1.2 - style.shady) -
    (e.leavers ?? 0) * 3 +
    (e.hires ?? 0) * 2 -
    (e.scandal ?? 0) * 0.5 -
    (e.terminate ? 8 : 0) -
    (e.loseStar ? 6 : 0) +
    (choice.bury ? style.shady * 6 - (1 - style.shady) * 4 : 0) +
    (outcome === 'good' ? 2 : outcome === 'bad' ? -2 : 0)
  )
}

/**
 * Answers the firm's open crisis stages. Only offers choices the reducer accepts, since rejected
 * AI actions fail silently. Pure apart from reading state.
 */
export function planCrisisAnswers(state: GameState, firmId: string, style?: CrisisStyle): Action[] {
  const firm = state.firms[firmId]
  if (!firm || firm.bankrupt) return []
  const s = style ?? crisisStyleFor(firm)
  return openCrises(state, firmId).flatMap((c) => {
    const options = crisisChoices(c).filter((ch) => !crisisChoiceBlock(state, c, ch.id))
    if (!options.length) return []
    const best = options.map((ch) => ({ ch, v: value(state, firm, c, ch, s) })).sort((a, b) => b.v - a.v)[0].ch
    return [{ type: 'resolveCrisis', firmId, crisisId: c.id, choiceId: best.id, ...(best.talk ? { score: s.talk } : {}) } as Action]
  })
}
