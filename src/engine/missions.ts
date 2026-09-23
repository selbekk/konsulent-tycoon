import { MISSIONS } from '../content/missions'
import type { MissionDef } from '../content/missions'
import { headcount } from './economy'
import { applyEffect } from './events'
import { firmLevel } from './levels'
import { playerRank } from './score'
import type { Firm, GameState } from './types'
import { addNews } from './util'

/** Missions the firm can see: everything up to its level, done or not. Pure. */
export function visibleMissions(firm: Firm): { def: MissionDef; done: boolean }[] {
  const level = firmLevel(firm)
  const done = new Set(firm.missionsDone ?? [])
  return MISSIONS.filter((m) => m.level <= level).map((def) => ({ def, done: done.has(def.id) }))
}

/**
 * A tutorial layer for the player, like the to-do list: AI firms don't chase missions.
 * Runs at the end of the quarter, after awards. Never touches state.rng.
 */
export function checkMissions(state: GameState) {
  const firm = state.firms[state.playerId]
  if (firm.bankrupt) return
  const ctx = { state, firm, headcount: headcount(firm), rank: playerRank(state) }
  for (const { def, done } of visibleMissions(firm)) {
    if (done || !def.check(ctx)) continue
    firm.missionsDone = [...(firm.missionsDone ?? []), def.id]
    applyEffect(state, firm, def.reward, { id: '', eventId: '', firmId: firm.id, params: {} })
    addNews(state, 'news.mission.done', { mission: def.id }, 'good', { firmId: firm.id, personal: true })
  }
}
