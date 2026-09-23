import { clamp } from './constants'
import { averageMorale, headcount } from './economy'
import type { Award, Firm, GameState } from './types'
import { activeFirms, addNews, quarterLabel } from './util'

interface AwardDef {
  id: string
  score: (f: Firm, state: GameState) => number
  /** Minimum score to hand out the award at all. */
  min?: number
  reputation: number
}

const contractsStartedThisYear = (f: Firm, state: GameState) =>
  state.contracts.filter((c) => c.firmId === f.id && c.startQuarter > state.quarter - 4 && c.startQuarter <= state.quarter + 1)
    .length

const growth = (f: Firm) => {
  const past = f.history.length >= 4 ? f.history[f.history.length - 4].headcount : f.history[0]?.headcount ?? 0
  return past ? headcount(f) / past - 1 : 0
}

export const AWARDS: AwardDef[] = [
  { id: 'best_fagmiljo', score: (f) => f.fagmiljo, reputation: 3 },
  { id: 'coffee_machine', score: (f) => f.sosialt, reputation: 1 },
  { id: 'tender_champion', score: contractsStartedThisYear, min: 1, reputation: 2 },
  { id: 'rocket_growth', score: growth, min: 0.05, reputation: 2 },
  { id: 'creative_timesheets', score: (f) => f.heat, min: 20, reputation: -1 },
  { id: 'glassdoor_disaster', score: (f) => 100 - averageMorale(f), min: 40, reputation: -2 },
]

/** Hands out the year's awards. Ties go to the firm first in firm order. */
export function yearEndAwards(state: GameState): Award[] {
  const firms = activeFirms(state).filter((f) => headcount(f) > 0)
  const { year } = quarterLabel(state.quarter)
  const awards: Award[] = []
  for (const def of AWARDS) {
    let best: Firm | undefined
    let bestScore = -Infinity
    for (const f of firms) {
      const s = def.score(f, state)
      if (s > bestScore) {
        best = f
        bestScore = s
      }
    }
    if (!best || (def.min !== undefined && bestScore < def.min)) continue
    best.reputation = clamp(best.reputation + def.reputation, 0, 100)
    awards.push({ awardId: def.id, firmId: best.id, year })
    addNews(state, `news.award.${def.id}`, { firm: best.name, year }, def.reputation < 0 ? 'sassy' : 'good', {
      personal: best.isPlayer,
    })
  }
  state.lastAwards = awards
  return awards
}
