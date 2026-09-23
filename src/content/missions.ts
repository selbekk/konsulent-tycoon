import type { Effect } from './events'
import type { Firm, GameState } from '../engine/types'

export interface MissionCtx {
  state: GameState
  firm: Firm
  headcount: number
  /** Current place in the value ranking, 1 = best. */
  rank: number
}

export interface MissionDef {
  id: string
  /** Shows up (and can be completed) from this firm level. */
  level: number
  check: (ctx: MissionCtx) => boolean
  /** Applied once, through the same effect code as events. */
  reward: Effect
}

const stat = (firm: Firm, key: keyof NonNullable<Firm['stats']>) => firm.stats?.[key] ?? 0

/** Optional goals per level: small nudges towards the features that level opens. */
export const MISSIONS: MissionDef[] = [
  { id: 'first_win', level: 1, check: ({ firm }) => (firm.tendersWon ?? 0) >= 1, reward: { reputation: 3 } },
  { id: 'first_hire', level: 1, check: ({ headcount }) => headcount >= 7, reward: { morale: 3 } },
  { id: 'full_house', level: 1, check: ({ firm }) => (firm.history.at(-1)?.utilization ?? 0) >= 0.9, reward: { brand: 3 } },
  { id: 'first_framework', level: 2, check: ({ firm }) => stat(firm, 'frameworkWins') >= 1, reward: { reputation: 3 } },
  { id: 'first_star', level: 2, check: ({ firm }) => firm.stars.some((s) => !s.founder), reward: { morale: 3 } },
  { id: 'public_win', level: 2, check: ({ firm }) => stat(firm, 'publicWins') >= 1, reward: { reputation: 2 } },
  { id: 'big_win', level: 3, check: ({ firm }) => stat(firm, 'biggestWin') >= 15, reward: { cash: 300_000 } },
  {
    id: 'happy_client',
    level: 3,
    check: ({ state, firm }) =>
      state.contracts.some((c) => c.firmId === firm.id && !c.terminated && c.startQuarter <= state.quarter && c.satisfaction >= 80),
    reward: { reputation: 3 },
  },
  { id: 'award', level: 3, check: ({ firm }) => stat(firm, 'awards') >= 1, reward: { brand: 4 } },
  { id: 'specialist', level: 3, check: ({ firm }) => !!firm.specialty, reward: { brand: 3 } },
  { id: 'partner', level: 4, check: ({ firm }) => (firm.partnerships ?? []).length > 0, reward: { reputation: 2 } },
  { id: 'department', level: 4, check: ({ firm }) => (firm.departments ?? []).length > 0, reward: { morale: 3 } },
  { id: 'fifty', level: 4, check: ({ headcount }) => headcount >= 50, reward: { brand: 5 } },
  { id: 'acquisition', level: 5, check: ({ firm }) => (firm.stats?.acquisitions ?? 0) >= 1, reward: { reputation: 3 } },
  { id: 'top_three', level: 5, check: ({ rank }) => rank <= 3, reward: { reputation: 5 } },
]

export const MISSION_MAP = Object.fromEntries(MISSIONS.map((m) => [m.id, m])) as Record<string, MissionDef>
