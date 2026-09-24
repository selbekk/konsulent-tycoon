import type { Discipline } from '../engine/types'

export interface TrendDef {
  id: string
  /** Multiplier on tender seat demand per discipline. */
  demand: Partial<Record<Discipline, number>>
  /** Multiplier on overall tender volume. */
  volume?: number
  /** Multiplier on customer price weight (budget cuts → price matters more). */
  priceWeight?: number
  minDuration: number
  maxDuration: number
  buzzwords?: string[]
  /** Only started by a crisis (content/crises.ts), never drawn at random. */
  crisisOnly?: boolean
}

export const TRENDS: TrendDef[] = [
  { id: 'genai_hype', demand: { data: 1.6, backend: 1.1 }, minDuration: 4, maxDuration: 8, buzzwords: ['genai', 'innovation'] },
  { id: 'cloud_migration', demand: { cloud: 1.7, architecture: 1.2 }, minDuration: 4, maxDuration: 8, buzzwords: ['cloudNative', 'serverless'] },
  { id: 'public_budget_cuts', demand: {}, volume: 0.75, priceWeight: 1.3, minDuration: 3, maxDuration: 6 },
  { id: 'design_renaissance', demand: { design: 1.8, frontend: 1.2 }, minDuration: 4, maxDuration: 6, buzzwords: ['userJourney', 'userCentric'] },
  { id: 'data_mesh_mania', demand: { data: 1.5, architecture: 1.3 }, minDuration: 3, maxDuration: 6, buzzwords: ['dataMesh', 'selfService'] },
  { id: 'pm_winter', demand: { pm: 0.5, backend: 1.1 }, minDuration: 3, maxDuration: 5, buzzwords: ['productTeam', 'crossFunctional'] },
  { id: 'security_panic', demand: { cloud: 1.3, backend: 1.2, architecture: 1.2 }, minDuration: 2, maxDuration: 4, buzzwords: ['zeroTrust', 'devsecops'] },
  { id: 'boom', demand: {}, volume: 1.3, minDuration: 4, maxDuration: 8 },
  { id: 'ai_act_freeze', demand: { data: 0.55, architecture: 0.9 }, minDuration: 3, maxDuration: 4, crisisOnly: true },
  { id: 'krone_crash', demand: {}, volume: 0.9, priceWeight: 1.25, minDuration: 3, maxDuration: 5, crisisOnly: true },
]

export const TREND_MAP: Record<string, TrendDef> = Object.fromEntries(TRENDS.map((t) => [t.id, t]))
