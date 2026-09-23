import { FEATURE_LEVEL, LEVELS, MAX_LEVEL } from './constants'
import { headcount } from './economy'
import type { Firm, GameState, ShadyActionId, Tender } from './types'
import { addNews, seatTotal } from './util'

export type Feature = keyof typeof FEATURE_LEVEL
export type LevelGoal = 'headcount' | 'revenue' | 'tendersWon'
export const LEVEL_GOALS: LevelGoal[] = ['headcount', 'revenue', 'tendersWon']

/** Current value for each level goal. */
export function levelStats(firm: Firm): Record<LevelGoal, number> {
  return {
    headcount: headcount(firm),
    revenue: firm.history[firm.history.length - 1]?.revenue ?? 0,
    tendersWon: firm.tendersWon ?? 0,
  }
}

/** Highest level whose goals the firm meets right now (any one goal is enough). */
export function earnedLevel(firm: Firm): number {
  const stats = levelStats(firm)
  let level = 1
  for (let l = 2; l <= MAX_LEVEL; l++) {
    const goal = LEVELS[l - 1]
    if (LEVEL_GOALS.some((g) => stats[g] >= goal[g])) level = l
  }
  return level
}

/** Saves from before levels existed derive the level from the firm's stats. Pure. */
export function firmLevel(firm: Firm): number {
  return firm.level ?? earnedLevel(firm)
}

export function hasFeature(firm: Firm, feature: Feature): boolean {
  return firmLevel(firm) >= FEATURE_LEVEL[feature]
}

export function maxTenderSeats(firm: Firm): number {
  return LEVELS[firmLevel(firm) - 1].maxSeats
}

/** Error key if the firm is too small for this tender, else undefined. */
export function tenderLock(firm: Firm, tender: Tender): string | undefined {
  if (tender.kind === 'framework' && !hasFeature(firm, 'framework')) return 'errors.levelTooLow'
  if (seatTotal(tender.seats) > maxTenderSeats(firm)) return 'errors.tenderTooBig'
  return undefined
}

/** Level needed to bid on a tender, for the UI. */
export function tenderLevel(tender: Tender): number {
  const seats = seatTotal(tender.seats)
  const bySize = LEVELS.findIndex((l) => seats <= l.maxSeats) + 1
  return Math.max(bySize, tender.kind === 'framework' ? FEATURE_LEVEL.framework : 1)
}

export interface LevelUnlocks {
  features: Feature[]
  shady: ShadyActionId[]
  maxSeats: number
}

/** What opens at exactly this level. `shadyLevels` is passed in to avoid a cycle with shady.ts. */
export function unlocksAt(level: number, shadyLevels: Record<ShadyActionId, number>): LevelUnlocks {
  return {
    features: (Object.keys(FEATURE_LEVEL) as Feature[]).filter((f) => FEATURE_LEVEL[f] === level),
    shady: (Object.keys(shadyLevels) as ShadyActionId[]).filter((id) => shadyLevels[id] === level),
    maxSeats: LEVELS[level - 1].maxSeats,
  }
}

/** Runs in endTurn after tenders are awarded, so this quarter's wins count. */
export function updateLevels(state: GameState) {
  for (const id of state.firmOrder) {
    const firm = state.firms[id]
    if (firm.bankrupt) continue
    const before = firmLevel(firm)
    const after = Math.max(before, earnedLevel(firm))
    firm.level = after
    if (after > before && firm.isPlayer) {
      firm.levelUpQuarter = state.quarter
      addNews(state, 'news.level.up', { level: after, from: before }, 'good', { firmId: firm.id, personal: true })
    }
  }
}
