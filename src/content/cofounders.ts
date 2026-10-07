import type { Ambition, Discipline, Gender } from '../engine/types'

/** What a co-founder brings to the startup phase. Everything that lasts beyond it comes from their traits. */
export interface CofounderPerk {
  /** Evening hours per quarter, on top of STARTUP_HOURS (may be negative). */
  hours?: number
  /** Extra people in the network each quarter. */
  candidates?: number
  /** Added to every new candidate's interest. */
  interest?: number
  /** A fourth, well-paid lead every quarter. */
  insiderLead?: boolean
  /** Added to the starting cash. */
  cash?: number
  /** Added to the starting reputation. */
  reputation?: number
}

/**
 * The people you can start the firm with. Hand-made and the same for everyone, so the weekly challenge is fair.
 * Each one makes some things easier and something harder; texts in `content:cofounders.<id>`.
 */
export interface CofounderDef {
  id: string
  name: string
  gender: Gender
  discipline: Discipline
  /** 3–5, like any star. */
  level: number
  /** Star traits (content/traits.ts): these stay with the firm after the startup phase. */
  traits: string[]
  ambition: Ambition
  /** On top of the firm's salary premium. */
  salaryPremium: number
  perk: CofounderPerk
}

export const COFOUNDERS: CofounderDef[] = [
  {
    id: 'ingrid',
    name: 'Ingrid Nettum',
    gender: 'female',
    discipline: 'pm',
    level: 3,
    traits: ['sjefsdiplomat'],
    ambition: 'leadership',
    salaryPremium: 0,
    perk: { hours: 1, candidates: 1 },
  },
  {
    id: 'magnus',
    name: 'Magnus «10x» Lie',
    gender: 'male',
    discipline: 'backend',
    level: 5,
    traits: ['tenx_ego'],
    ambition: 'growth',
    salaryPremium: 0.05,
    perk: { hours: -1 },
  },
  {
    id: 'marte',
    name: 'Marte Fjellstad',
    gender: 'female',
    discipline: 'design',
    level: 4,
    traits: ['linkedin_influencer'],
    ambition: 'growth',
    salaryPremium: 0.1,
    perk: { interest: 10 },
  },
  {
    id: 'jonas',
    name: 'Jonas Brekke',
    gender: 'male',
    discipline: 'cloud',
    level: 4,
    traits: ['certification_collector'],
    ambition: 'salary',
    salaryPremium: 0.2,
    perk: { insiderLead: true },
  },
  {
    id: 'aisha',
    name: 'Aisha Rahimi',
    gender: 'female',
    discipline: 'data',
    level: 3,
    traits: ['mentor'],
    ambition: 'growth',
    salaryPremium: 0,
    perk: { cash: 1_000_000 },
  },
  {
    id: 'kari',
    name: 'Kari Aas',
    gender: 'female',
    discipline: 'architecture',
    level: 5,
    traits: ['conference_speaker', 'workaholic'],
    ambition: 'leadership',
    salaryPremium: 0.1,
    perk: { reputation: 8 },
  },
]

export const COFOUNDER_IDS = COFOUNDERS.map((c) => c.id)

/** Looks a co-founder up by id; undefined for anything else (ids can come from a leaderboard log). */
export function cofounderDef(id: string): CofounderDef | undefined {
  return COFOUNDERS.find((c) => c.id === id)
}
