/**
 * Employee thoughts on the staff screen (RollerCoaster Tycoon-style). Each id is a trigger in
 * `engine/flavor.ts` with a number of text variants: `game:thoughts.<id>.<1..variants>`.
 * A mix of realistic and whimsical, and never mean.
 */
export type ThoughtMood = 'good' | 'bad' | 'neutral'

export interface ThoughtDef {
  id: string
  mood: ThoughtMood
  variants: number
}

export const THOUGHTS = [
  { id: 'overworked', mood: 'bad', variants: 10 },
  { id: 'bench_bored', mood: 'bad', variants: 10 },
  { id: 'good_flow', mood: 'good', variants: 10 },
  { id: 'embarrassed', mood: 'bad', variants: 8 },
  { id: 'suspicious', mood: 'neutral', variants: 8 },
  { id: 'star_restless', mood: 'bad', variants: 6 },
  { id: 'underpaid', mood: 'bad', variants: 8 },
  { id: 'good_pay', mood: 'good', variants: 6 },
  { id: 'no_learning', mood: 'bad', variants: 8 },
  { id: 'fagdag_good', mood: 'good', variants: 8 },
  { id: 'lonely', mood: 'bad', variants: 8 },
  { id: 'great_colleagues', mood: 'good', variants: 8 },
  { id: 'rival_sushi', mood: 'bad', variants: 6 },
  { id: 'who_are_freelancers', mood: 'neutral', variants: 6 },
  { id: 'startup_vibes', mood: 'good', variants: 6 },
  { id: 'all_quiet', mood: 'neutral', variants: 6 },
  { id: 'cash_tight', mood: 'bad', variants: 6 },
  { id: 'crisis_open', mood: 'bad', variants: 6 },
  { id: 'big_firm', mood: 'neutral', variants: 6 },
  { id: 'listed', mood: 'neutral', variants: 5 },
  { id: 'season_q1', mood: 'neutral', variants: 6 },
  { id: 'season_q2', mood: 'neutral', variants: 6 },
  { id: 'season_q3', mood: 'neutral', variants: 6 },
  { id: 'season_q4', mood: 'neutral', variants: 6 },
  { id: 'everyday', mood: 'neutral', variants: 31 },
] as const satisfies readonly ThoughtDef[]

export type ThoughtId = (typeof THOUGHTS)[number]['id']

export const THOUGHT_BY_ID = Object.fromEntries(THOUGHTS.map((t) => [t.id, t])) as Record<ThoughtId, ThoughtDef>
