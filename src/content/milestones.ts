import type { Firm, GameState, QuarterReport } from '../engine/types'

export interface MilestoneCtx {
  state: GameState
  firm: Firm
  headcount: number
  /** The quarter that just ended. */
  last: QuarterReport | undefined
}

/**
 * First-time moments for the trophy wall. Unlike missions they have no reward: they are there
 * to be celebrated. Ordered roughly by when a player reaches them, so the wall fills up early.
 */
export interface MilestoneDef {
  id: string
  check: (ctx: MilestoneCtx) => boolean
}

const revenue = (ctx: MilestoneCtx) => ctx.last?.revenue ?? 0
/** The result line in the quarter report: after fines. */
const result = (last: QuarterReport | undefined) => (last ? last.ebitda - last.fines : 0)

export const MILESTONES: MilestoneDef[] = [
  { id: 'first_quarter', check: () => true },
  { id: 'first_profit', check: ({ last }) => result(last) > 0 },
  { id: 'first_renewal', check: ({ firm }) => (firm.stats?.renewals ?? 0) >= 1 },
  { id: 'revenue_5m', check: (ctx) => revenue(ctx) >= 5_000_000 },
  { id: 'team_10', check: ({ headcount }) => headcount >= 10 },
  { id: 'first_year', check: ({ state }) => state.quarter >= 3 },
  { id: 'ebitda_1m', check: ({ last }) => result(last) >= 1_000_000 },
  {
    id: 'crisis_weathered',
    check: ({ firm }) => (firm.crisisOutcomes?.good ?? 0) + (firm.crisisOutcomes?.ok ?? 0) >= 1,
  },
  { id: 'revenue_10m', check: (ctx) => revenue(ctx) >= 10_000_000 },
  { id: 'team_25', check: ({ headcount }) => headcount >= 25 },
  { id: 'revenue_25m', check: (ctx) => revenue(ctx) >= 25_000_000 },
  { id: 'five_years', check: ({ state }) => state.quarter >= 19 },
  { id: 'team_100', check: ({ headcount }) => headcount >= 100 },
  { id: 'revenue_50m', check: (ctx) => revenue(ctx) >= 50_000_000 },
]
