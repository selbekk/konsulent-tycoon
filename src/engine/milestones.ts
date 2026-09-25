import { MILESTONES } from '../content/milestones'
import type { MilestoneDef } from '../content/milestones'
import { MISSIONS } from '../content/missions'
import type { MissionDef } from '../content/missions'
import { RECORD_FROM_QUARTER, RECORD_MARGIN } from './constants'
import { headcount } from './economy'
import type { Firm, GameState } from './types'
import { addNews } from './util'

/**
 * First-time moments and record quarters for the player. Pure celebration: no rewards, no
 * state.rng. Runs at the end of the quarter, next to missions.
 */
export function checkMilestones(state: GameState) {
  const firm = state.firms[state.playerId]
  if (firm.bankrupt) return
  const last = firm.history.find((h) => h.quarter === state.quarter)
  const ctx = { state, firm, headcount: headcount(firm), last }
  const reached = new Set(firm.milestones ?? [])
  for (const def of MILESTONES) {
    if (reached.has(def.id) || !def.check(ctx)) continue
    firm.milestones = [...(firm.milestones ?? []), def.id]
    addNews(state, `news.milestone.${def.id}`, {}, 'good', { firmId: firm.id, personal: true })
  }

  if (!last) return
  const stats = (firm.stats ??= {})
  const best = stats.bestRevenue ?? 0
  if (state.quarter >= RECORD_FROM_QUARTER && best > 0 && last.revenue > best * (1 + RECORD_MARGIN)) {
    addNews(state, 'news.record.revenue', { amount: last.revenue }, 'good', { firmId: firm.id, personal: true })
  }
  stats.bestRevenue = Math.max(best, last.revenue)
}

export type Trophy =
  | { kind: 'milestone'; def: MilestoneDef; done: boolean }
  | { kind: 'mission'; def: MissionDef; done: true }

/** What the trophy wall shows: every milestone (dim until reached) and the missions done. Pure. */
export function trophies(firm: Firm): Trophy[] {
  const reached = new Set(firm.milestones ?? [])
  const done = new Set(firm.missionsDone ?? [])
  return [
    ...MILESTONES.map((def) => ({ kind: 'milestone' as const, def, done: reached.has(def.id) })),
    ...MISSIONS.filter((m) => done.has(m.id)).map((def) => ({ kind: 'mission' as const, def, done: true as const })),
  ]
}
