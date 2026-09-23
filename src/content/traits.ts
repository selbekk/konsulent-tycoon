export interface TraitDef {
  id: string
  /** Added to bid quality when this star is offered. */
  bidQuality?: number
  /** Added to employer brand while employed. */
  brand?: number
  /** Reputation gained per quarter. */
  reputationPerQuarter?: number
  /** Morale change for the star's discipline pool per quarter. */
  poolMorale?: number
  /** Satisfaction change per quarter on the assigned contract. */
  satisfactionPerQuarter?: number
  /** Relationship change per quarter with the assigned customer. */
  relationPerQuarter?: number
  /** Pool level gain per quarter in the star's discipline. */
  poolLevelPerQuarter?: number
  /** Star's own loyalty drift per quarter. */
  loyaltyDrift?: number
  /** Star's own morale drift per quarter. */
  moraleDrift?: number
  /** Demands remote work, otherwise loyalty drops. */
  wantsRemote?: boolean
  /** Only happy if sosialt is at least this. */
  needsSosialt?: number
}

export const TRAITS: TraitDef[] = [
  { id: 'linkedin_influencer', brand: 3, loyaltyDrift: -1 },
  { id: 'kaffesnobb', needsSosialt: 50, poolMorale: 1 },
  { id: 'tech_debt_hunter', satisfactionPerQuarter: 3, bidQuality: 2 },
  { id: 'sjefsdiplomat', relationPerQuarter: 2, bidQuality: 3 },
  { id: 'tenx_ego', bidQuality: 8, poolMorale: -2 },
  { id: 'remote_hardliner', wantsRemote: true, bidQuality: 2 },
  { id: 'mentor', poolLevelPerQuarter: 0.03, poolMorale: 1 },
  { id: 'conference_speaker', reputationPerQuarter: 0.5, bidQuality: 3 },
  { id: 'workaholic', bidQuality: 4, moraleDrift: -2 },
  { id: 'slack_poet', poolMorale: 2 },
  { id: 'certification_collector', bidQuality: 6 },
  { id: 'loyal_as_a_dog', loyaltyDrift: 2 },
]

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]))
