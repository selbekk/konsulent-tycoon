import type { Archetype, Discipline } from '../types'

export interface Personality {
  id: string
  /** Typical rate multiplier. */
  priceBias: number
  /** 0–1: culture budgets, bid effort, minigame skill. */
  qualityFocus: number
  /** 0–1: chance per quarter to try poaching. */
  aggression: number
  /** 0–1: chance per quarter to do something shady. */
  shadiness: number
  /** 0–1: how eagerly they hire. */
  growthAppetite: number
  /** Average pool level at start. */
  startLevel: number
  mix: Partial<Record<Discipline, number>>
}

const MIXES: Record<Archetype, Partial<Record<Discipline, number>>> = {
  boutique_nerd: { backend: 3, frontend: 2, cloud: 2, architecture: 2, data: 1, design: 1, pm: 0.5 },
  boutique_design: { design: 4, frontend: 3, backend: 1, pm: 1 },
  mid_generalist: { backend: 3, frontend: 2.5, cloud: 1.5, data: 1.5, design: 1, architecture: 1, pm: 1.5 },
  nordic_giant: { backend: 3, frontend: 2, pm: 2, cloud: 2, data: 2, architecture: 1, design: 1 },
  budget_bulk: { backend: 4, frontend: 3, pm: 2, cloud: 1, data: 1 },
  specialist_cloud: { cloud: 5, backend: 2, architecture: 2, pm: 0.5 },
  specialist_data: { data: 5, backend: 2, cloud: 1, architecture: 1 },
}

const archetype = (a: Archetype, p: Omit<Personality, 'id' | 'mix'>): Personality => ({ id: a, mix: MIXES[a], ...p })

export const ARCHETYPES: Record<Archetype, Personality> = {
  boutique_nerd: archetype('boutique_nerd', {
    priceBias: 1.15,
    qualityFocus: 0.85,
    aggression: 0.1,
    shadiness: 0.03,
    growthAppetite: 0.4,
    startLevel: 3.3,
  }),
  boutique_design: archetype('boutique_design', {
    priceBias: 1.1,
    qualityFocus: 0.75,
    aggression: 0.1,
    shadiness: 0.04,
    growthAppetite: 0.4,
    startLevel: 3.1,
  }),
  mid_generalist: archetype('mid_generalist', {
    priceBias: 1.0,
    qualityFocus: 0.55,
    aggression: 0.15,
    shadiness: 0.06,
    growthAppetite: 0.55,
    startLevel: 2.8,
  }),
  nordic_giant: archetype('nordic_giant', {
    priceBias: 0.92,
    qualityFocus: 0.45,
    aggression: 0.2,
    shadiness: 0.08,
    growthAppetite: 0.6,
    startLevel: 2.7,
  }),
  budget_bulk: archetype('budget_bulk', {
    priceBias: 0.82,
    qualityFocus: 0.3,
    aggression: 0.15,
    shadiness: 0.12,
    growthAppetite: 0.65,
    startLevel: 2.4,
  }),
  specialist_cloud: archetype('specialist_cloud', {
    priceBias: 1.08,
    qualityFocus: 0.65,
    aggression: 0.12,
    shadiness: 0.05,
    growthAppetite: 0.5,
    startLevel: 3.1,
  }),
  specialist_data: archetype('specialist_data', {
    priceBias: 1.05,
    qualityFocus: 0.65,
    aggression: 0.12,
    shadiness: 0.05,
    growthAppetite: 0.5,
    startLevel: 3.0,
  }),
}

export const RIVALS: Record<string, Personality> = {
  bekkerson: {
    id: 'bekkerson',
    priceBias: 1.2,
    qualityFocus: 0.95,
    aggression: 0.15,
    shadiness: 0.02,
    growthAppetite: 0.45,
    startLevel: 3.5,
    mix: { backend: 3, frontend: 3, design: 2, cloud: 2, data: 1.5, architecture: 1.5, pm: 1 },
  },
  accentura: {
    id: 'accentura',
    priceBias: 1.12,
    qualityFocus: 0.55,
    aggression: 0.45,
    shadiness: 0.12,
    growthAppetite: 0.7,
    startLevel: 2.9,
    mix: { pm: 3, architecture: 2, backend: 2, cloud: 2, data: 2, frontend: 1, design: 1 },
  },
  knowitall: {
    id: 'knowitall',
    priceBias: 1.0,
    qualityFocus: 0.55,
    aggression: 0.25,
    shadiness: 0.07,
    growthAppetite: 0.65,
    startLevel: 2.8,
    mix: MIXES.mid_generalist,
  },
  soppsteria: {
    id: 'soppsteria',
    priceBias: 0.8,
    qualityFocus: 0.3,
    aggression: 0.2,
    shadiness: 0.22,
    growthAppetite: 0.6,
    startLevel: 2.5,
    mix: MIXES.budget_bulk,
  },
}

/** The player's bot personality in the simulator. Also used as sensible defaults in UI. */
export const PLAYER_BOTS: Record<string, Personality> = {
  idle: { ...ARCHETYPES.mid_generalist, id: 'idle' },
  balanced: { ...ARCHETYPES.mid_generalist, id: 'balanced', qualityFocus: 0.65, priceBias: 0.95, shadiness: 0 },
  greedy: { ...ARCHETYPES.budget_bulk, id: 'greedy', qualityFocus: 0.2, priceBias: 0.85, shadiness: 0, growthAppetite: 0.8 },
  shady: { ...ARCHETYPES.mid_generalist, id: 'shady', qualityFocus: 0.5, shadiness: 0.6, aggression: 0.4 },
}

export function personalityFor(id: string): Personality {
  return RIVALS[id] ?? ARCHETYPES[id as Archetype] ?? PLAYER_BOTS[id] ?? ARCHETYPES.mid_generalist
}
