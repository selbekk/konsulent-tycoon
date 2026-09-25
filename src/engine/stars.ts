import { TRAITS, TRAIT_MAP } from '../content/traits'
import { MAX_POOL_LEVEL, STAR_MARKET_MAX, clamp, pricingPremium, quarterlySalaryCost } from './constants'
import { fitName, newProfile } from './profile'
import { personName, raiseLevel } from './roster'
import { moraleTarget } from './staff'
import { chance, nextFloat, nextInt, pick, range } from './rng'
import type { RngState } from './rng'
import { DISCIPLINES } from './types'
import type { Ambition, Discipline, Firm, GameState, Star } from './types'
import { addNews, nextId } from './util'

export const AMBITIONS: Ambition[] = ['salary', 'growth', 'leadership', 'remote']

export function generateStarName(rng: RngState): string {
  return personName(rng, 0.35)
}

export function generateStar(state: GameState, discipline?: Discipline, minLevel = 3, maxLevel = 5): Star {
  const rng = state.rng
  const traitCount = chance(rng, 0.4) ? 2 : 1
  const traits: string[] = []
  while (traits.length < traitCount) {
    const t = pick(rng, TRAITS).id
    if (!traits.includes(t)) traits.push(t)
  }
  const star: Star = {
    id: nextId(state, 's'),
    name: generateStarName(rng),
    discipline: discipline ?? pick(rng, DISCIPLINES),
    level: nextInt(rng, minLevel, maxLevel),
    traits,
    ambition: pick(rng, AMBITIONS),
    morale: 70,
    loyalty: 60,
    salaryPremium: Math.round(range(rng, 0.05, 0.25) * 100) / 100,
  }
  // After the state.rng draws, from a hash, so the rest of the game draws exactly as before.
  Object.assign(star, newProfile(state, star.id, star.discipline, star.level))
  star.name = fitName(state, star.id, star.name, star.gender!)
  return star
}

export function ambitionMet(firm: Firm, star: Star, headcount: number): boolean {
  switch (star.ambition) {
    case 'salary':
      return firm.budgets.salaryPremium + star.salaryPremium >= 0.1
    case 'growth':
      return firm.fagmiljo >= 55
    case 'leadership':
      return headcount >= 20
    case 'remote':
      return !!star.remoteGranted
  }
}

export function starSigningCost(star: Star, firm: Firm): number {
  return quarterlySalaryCost(star.level, pricingPremium(firm) + star.salaryPremium)
}

export function starLeaveChance(star: Star): number {
  if (star.founder) return 0
  return 0.01 + Math.max(0, 40 - star.loyalty) / 200 + Math.max(0, 45 - star.morale) / 300
}

export function starBidQuality(star: Star): number {
  return star.traits.reduce((s, t) => s + (TRAIT_MAP[t]?.bidQuality ?? 0), 0)
}

export function updateStars(state: GameState, firm: Firm, util: number, headcount: number) {
  const leaving: Star[] = []
  for (const star of firm.stars) {
    let loyaltyDelta = ambitionMet(firm, star, headcount) ? 2 : -4
    let moraleDrift = 0
    for (const tid of star.traits) {
      const t = TRAIT_MAP[tid]
      if (!t) continue
      loyaltyDelta += t.loyaltyDrift ?? 0
      moraleDrift += t.moraleDrift ?? 0
      if (t.wantsRemote && !star.remoteGranted) loyaltyDelta -= 3
      if (t.needsSosialt !== undefined) moraleDrift += firm.sosialt >= t.needsSosialt ? 2 : -3
      if (t.reputationPerQuarter) firm.reputation = clamp(firm.reputation + t.reputationPerQuarter, 0, 100)
      if (t.poolLevelPerQuarter) raiseLevel(firm, star.discipline, t.poolLevelPerQuarter, MAX_POOL_LEVEL)
      if (t.satisfactionPerQuarter && star.assignedContractId) {
        const c = state.contracts.find((x) => x.id === star.assignedContractId)
        if (c) c.satisfaction = clamp(c.satisfaction + t.satisfactionPerQuarter, 0, 100)
      }
      if (t.relationPerQuarter && star.assignedContractId) {
        const c = state.contracts.find((x) => x.id === star.assignedContractId)
        const cust = c && state.customers[c.customerId]
        if (cust)
          cust.relationships[firm.id] = clamp((cust.relationships[firm.id] ?? 30) + t.relationPerQuarter, 0, 100)
      }
    }
    star.loyalty = clamp(star.loyalty + loyaltyDelta, 0, 100)
    const target = moraleTarget(firm, util, star.discipline) + moraleDrift
    star.morale = clamp(star.morale + (target - star.morale) * 0.3, 0, 100)
    if (chance(state.rng, starLeaveChance(star))) leaving.push(star)
  }
  for (const star of leaving) {
    removeStar(state, firm, star.id)
    firm.quarterLeavers += 1
    addNews(state, 'news.staff.starLeft', { name: star.name, firm: firm.name }, firm.isPlayer ? 'bad' : 'neutral', {
      firmId: firm.id,
      personal: firm.isPlayer,
    })
  }
}

export function removeStar(state: GameState, firm: Firm, starId: string): Star | undefined {
  const idx = firm.stars.findIndex((s) => s.id === starId)
  if (idx < 0) return undefined
  const [star] = firm.stars.splice(idx, 1)
  for (const c of state.contracts) c.starIds = c.starIds.filter((id) => id !== starId)
  for (const t of state.tenders) {
    for (const b of t.bids) if (b.firmId === firm.id) b.starIds = b.starIds.filter((id) => id !== starId)
  }
  star.assignedContractId = undefined
  for (const e of firm.roster ?? []) if (e.mentorStarId === starId) delete e.mentorStarId
  return star
}

export function refreshStarMarket(state: GameState) {
  // Stars on the market get snapped up by someone else after a while.
  state.starMarket = state.starMarket.filter(() => nextFloat(state.rng) > 0.4)
  const newcomers = nextInt(state.rng, 0, 2)
  for (let i = 0; i < newcomers && state.starMarket.length < STAR_MARKET_MAX; i++) {
    state.starMarket.push(generateStar(state))
  }
}
