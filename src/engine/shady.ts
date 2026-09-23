import { HEAT_DECAY, SCANDAL_MORALE_HIT, clamp } from './constants'
import { terminateContract, releaseStars } from './contracts'
import { employerBrand } from './culture'
import { isActive } from './economy'
import { chance } from './rng'
import { removeStar } from './stars'
import type { ActionOf, Contract, Firm, GameState, ShadyActionId, ShadyLogEntry } from './types'
import { addNews, nextId } from './util'

export type ShadyRequirement = 'target' | 'tender' | 'contract' | 'star' | 'share' | 'ownBid'

export interface ShadyDef {
  id: ShadyActionId
  category: 'espionage' | 'outsourcing' | 'cv' | 'pr'
  cost: number
  baseDetection: number
  heat: number
  ongoing: boolean
  /** Detection is rolled when (and if) the tender is won, not when performed. */
  rolledAtAward?: boolean
  requires: ShadyRequirement[]
  consequence: { reputation: number; fine: number }
}

export const SHADY_CATALOG: Record<ShadyActionId, ShadyDef> = {
  spy_bids: { id: 'spy_bids', category: 'espionage', cost: 100_000, baseDetection: 0.1, heat: 8, ongoing: false, requires: ['tender'], consequence: { reputation: 8, fine: 250_000 } },
  spy_salaries: { id: 'spy_salaries', category: 'espionage', cost: 50_000, baseDetection: 0.05, heat: 4, ongoing: false, requires: ['target'], consequence: { reputation: 4, fine: 0 } },
  plant_mole: { id: 'plant_mole', category: 'espionage', cost: 300_000, baseDetection: 0.15, heat: 12, ongoing: true, requires: ['target'], consequence: { reputation: 12, fine: 500_000 } },
  afterwork_poach: { id: 'afterwork_poach', category: 'espionage', cost: 80_000, baseDetection: 0.2, heat: 6, ongoing: false, requires: ['target', 'star'], consequence: { reputation: 5, fine: 0 } },
  silent_outsource: { id: 'silent_outsource', category: 'outsourcing', cost: 0, baseDetection: 0.08, heat: 10, ongoing: true, requires: ['contract', 'share'], consequence: { reputation: 15, fine: 1_000_000 } },
  cv_pad: { id: 'cv_pad', category: 'cv', cost: 20_000, baseDetection: 0.12, heat: 5, ongoing: false, rolledAtAward: true, requires: ['tender', 'ownBid'], consequence: { reputation: 10, fine: 0 } },
  ghost_cv: { id: 'ghost_cv', category: 'cv', cost: 40_000, baseDetection: 0.18, heat: 8, ongoing: false, rolledAtAward: true, requires: ['tender', 'ownBid'], consequence: { reputation: 10, fine: 400_000 } },
  bait_and_switch: { id: 'bait_and_switch', category: 'cv', cost: 0, baseDetection: 0.15, heat: 8, ongoing: true, requires: ['contract'], consequence: { reputation: 12, fine: 0 } },
  rumor: { id: 'rumor', category: 'pr', cost: 60_000, baseDetection: 0.1, heat: 5, ongoing: false, requires: ['target'], consequence: { reputation: 8, fine: 0 } },
  dn_leak: { id: 'dn_leak', category: 'pr', cost: 200_000, baseDetection: 0.2, heat: 12, ongoing: false, requires: ['target'], consequence: { reputation: 15, fine: 300_000 } },
  linkedin_post: { id: 'linkedin_post', category: 'pr', cost: 10_000, baseDetection: 0.05, heat: 2, ongoing: false, requires: ['target'], consequence: { reputation: 3, fine: 0 } },
}

export const SHADY_IDS = Object.keys(SHADY_CATALOG) as ShadyActionId[]

export function detectionChance(firm: Firm, def: ShadyDef): number {
  return clamp(def.baseDetection + firm.heat / 200, 0, 0.95)
}

export function riskLevel(firm: Firm, id: ShadyActionId): 'low' | 'medium' | 'high' {
  const p = detectionChance(firm, SHADY_CATALOG[id])
  return p < 0.12 ? 'low' : p < 0.25 ? 'medium' : 'high'
}

export function poachChance(attacker: Firm, target: Firm, starId: string): number {
  const star = target.stars.find((s) => s.id === starId)
  if (!star || star.founder) return 0
  return clamp(0.25 + (60 - star.loyalty) / 100 + (employerBrand(attacker) - employerBrand(target)) / 200, 0.05, 0.85)
}

function log(state: GameState, firm: Firm, a: ActionOf<'shady'>, ongoing: boolean): ShadyLogEntry {
  const entry: ShadyLogEntry = {
    id: nextId(state, 'x'),
    actionId: a.actionId,
    quarter: state.quarter,
    targetFirmId: a.targetFirmId,
    tenderId: a.tenderId,
    contractId: a.contractId,
    detected: false,
    ongoing,
    active: ongoing,
  }
  firm.shadyLog.push(entry)
  return entry
}

/** Reducer handler for `shady` actions. Returns an error key or undefined. */
export function handleShady(state: GameState, a: ActionOf<'shady'>): string | undefined {
  const firm = state.firms[a.firmId]
  const def = SHADY_CATALOG[a.actionId]
  if (!firm || !def) return 'errors.invalid'
  const target = a.targetFirmId ? state.firms[a.targetFirmId] : undefined
  if (def.requires.includes('target') && (!target || target.id === firm.id || target.bankrupt)) return 'errors.invalidTarget'
  const tender = a.tenderId ? state.tenders.find((t) => t.id === a.tenderId && !t.resolved) : undefined
  if (def.requires.includes('tender') && !tender) return 'errors.invalidTender'
  const ownBid = tender?.bids.find((b) => b.firmId === firm.id)
  if (def.requires.includes('ownBid') && !ownBid) return 'errors.noBid'
  const contract = a.contractId
    ? state.contracts.find((c) => c.id === a.contractId && c.firmId === firm.id && !c.terminated)
    : undefined
  if (def.requires.includes('contract') && !contract) return 'errors.invalidContract'
  const cost = def.cost
  if (a.actionId === 'afterwork_poach') {
    const star = target?.stars.find((s) => s.id === a.starId)
    if (!star || star.founder) return 'errors.invalidStar'
  }
  if (firm.cash < cost) return 'errors.notEnoughCash'

  switch (a.actionId) {
    case 'spy_bids':
      if (firm.intel.some((i) => i.kind === 'bids' && i.tenderId === tender!.id)) return 'errors.alreadyDone'
      firm.intel.push({ targetFirmId: '*', kind: 'bids', tenderId: tender!.id, untilQuarter: tender!.dueQuarter })
      break
    case 'spy_salaries':
      firm.intel.push({ targetFirmId: target!.id, kind: 'salaries', untilQuarter: state.quarter + 2 })
      break
    case 'plant_mole':
      if (firm.intel.some((i) => i.kind === 'mole' && i.targetFirmId === target!.id && i.untilQuarter > state.quarter))
        return 'errors.alreadyDone'
      firm.intel.push({ targetFirmId: target!.id, kind: 'mole', untilQuarter: state.quarter + 4 })
      break
    case 'afterwork_poach': {
      if (target!.isPlayer && !firm.isPlayer) {
        // The player gets to respond before anything happens.
        state.pendingEvents.push({
          id: nextId(state, 'pe'),
          eventId: 'poach_attempt',
          firmId: target!.id,
          params: { firm: firm.name, firmId: firm.id, starId: a.starId!, name: target!.stars.find((s) => s.id === a.starId)!.name },
        })
        break
      }
      const p = poachChance(firm, target!, a.starId!)
      if (chance(state.rng, p)) {
        const star = removeStar(state, target!, a.starId!)!
        target!.quarterLeavers += 1
        star.salaryPremium = Math.round((star.salaryPremium + 0.1) * 100) / 100
        star.loyalty = 55
        firm.stars.push(star)
        addNews(state, 'news.shady.poachSuccess', { name: star.name, from: target!.name, to: firm.name }, 'sassy', {
          personal: firm.isPlayer || target!.isPlayer,
        })
      } else if (firm.isPlayer) {
        addNews(state, 'news.shady.poachFailed', { from: target!.name }, 'neutral', { personal: true })
      }
      break
    }
    case 'silent_outsource': {
      const share = clamp(a.share ?? 0, 0, 0.8)
      contract!.outsourcedShare = share
      const existing = firm.shadyLog.find((e) => e.active && e.actionId === 'silent_outsource' && e.contractId === contract!.id)
      if (share === 0) {
        if (existing) existing.active = false
        return undefined // turning it off is free and leaves no trace
      }
      if (existing) return undefined
      break
    }
    case 'cv_pad':
      if (ownBid!.cvPad) return 'errors.alreadyDone'
      ownBid!.cvPad = true
      break
    case 'ghost_cv':
      if (ownBid!.ghostCv) return 'errors.alreadyDone'
      ownBid!.ghostCv = true
      break
    case 'bait_and_switch':
      if (!contract!.starIds.length || contract!.fraud.baitAndSwitch) return 'errors.alreadyDone'
      releaseStars(state, contract!)
      contract!.fraud.baitAndSwitch = true
      break
    case 'rumor':
      target!.reputation = clamp(target!.reputation - 6, 0, 100)
      if (target!.isPlayer) addNews(state, 'news.shady.rumorVictim', {}, 'bad', { personal: true })
      break
    case 'dn_leak':
      target!.reputation = clamp(target!.reputation - 12, 0, 100)
      target!.scandalPenalty += 5
      addNews(state, 'news.shady.dnLeak', { firm: target!.name }, 'sassy', { personal: target!.isPlayer })
      break
    case 'linkedin_post':
      firm.brandMod += 5
      target!.brandMod -= 3
      break
  }

  firm.cash -= cost
  firm.heat = clamp(firm.heat + def.heat, 0, 100)
  log(state, firm, a, def.ongoing)
  return undefined
}

export function applyScandal(state: GameState, firm: Firm, entry: ShadyLogEntry, contract?: Contract) {
  const def = SHADY_CATALOG[entry.actionId]
  entry.detected = true
  entry.active = false
  firm.reputation = clamp(firm.reputation - def.consequence.reputation, 0, 100)
  firm.cash -= def.consequence.fine
  firm.quarterFines += def.consequence.fine
  firm.scandalPenalty += SCANDAL_MORALE_HIT
  firm.heat = clamp(firm.heat + 10, 0, 100)
  const c = contract ?? (entry.contractId ? state.contracts.find((x) => x.id === entry.contractId) : undefined)
  switch (entry.actionId) {
    case 'silent_outsource':
    case 'cv_pad':
    case 'ghost_cv':
      if (c && !c.terminated) terminateContract(state, c, undefined, 25)
      break
    case 'bait_and_switch':
      if (c) {
        const cust = state.customers[c.customerId]
        cust.relationships[firm.id] = clamp((cust.relationships[firm.id] ?? 20) - 30, 0, 100)
      }
      break
    case 'plant_mole':
      firm.intel = firm.intel.filter((i) => !(i.kind === 'mole' && i.targetFirmId === entry.targetFirmId))
      break
  }
  const target = entry.targetFirmId ? state.firms[entry.targetFirmId] : undefined
  addNews(
    state,
    `news.scandal.${entry.actionId}`,
    { firm: firm.name, target: target?.name ?? '', customer: c?.customerId ?? '', fine: def.consequence.fine },
    'sassy',
    { firmId: firm.id, personal: firm.isPlayer || !!target?.isPlayer },
  )
}

/** CV fraud is only checked if the bid actually wins. */
export function checkFraudAtAward(state: GameState, contract: Contract) {
  const firm = state.firms[contract.firmId]
  const tender = state.tenders.find((t) => t.id === contract.tenderId)
  if (!tender) return
  for (const entry of firm.shadyLog) {
    if (entry.detected || entry.tenderId !== tender.id) continue
    const def = SHADY_CATALOG[entry.actionId]
    if (!def.rolledAtAward) continue
    entry.contractId = contract.id
    // From now on the fraud can surface every quarter the contract runs, at half the rate.
    entry.ongoing = true
    entry.active = true
    if (chance(state.rng, detectionChance(firm, def))) applyScandal(state, firm, entry, contract)
  }
}

export function rollShadyDetection(state: GameState) {
  for (const id of state.firmOrder) {
    const firm = state.firms[id]
    if (firm.bankrupt) continue
    for (const entry of firm.shadyLog) {
      if (entry.detected) continue
      const def = SHADY_CATALOG[entry.actionId]
      const contract = entry.contractId ? state.contracts.find((c) => c.id === entry.contractId) : undefined
      if (entry.ongoing && entry.active) {
        // Ongoing: stop once the underlying thing is gone.
        if (contract && !isActive(contract, state.quarter)) {
          entry.active = false
          continue
        }
        if (entry.actionId === 'plant_mole' && !firm.intel.some((i) => i.kind === 'mole' && i.targetFirmId === entry.targetFirmId && i.untilQuarter > state.quarter)) {
          entry.active = false
          continue
        }
        const p = detectionChance(firm, def) * (def.rolledAtAward ? 0.5 : 1)
        if (chance(state.rng, p)) applyScandal(state, firm, entry, contract)
      } else if (!entry.ongoing && !def.rolledAtAward && entry.quarter === state.quarter) {
        if (chance(state.rng, detectionChance(firm, def))) applyScandal(state, firm, entry)
      }
    }
  }
}

export function decayHeatAndIntel(state: GameState) {
  for (const id of state.firmOrder) {
    const f = state.firms[id]
    f.heat = clamp(f.heat - HEAT_DECAY, 0, 100)
    f.intel = f.intel.filter((i) => i.untilQuarter > state.quarter)
    if (f.shadyLog.length > 300) f.shadyLog = f.shadyLog.filter((e) => e.active || e.quarter > state.quarter - 12)
  }
}

export function hasIntel(state: GameState, firmId: string, kind: 'bids' | 'salaries' | 'mole', targetOrTender: string) {
  const f = state.firms[firmId]
  return f.intel.some(
    (i) =>
      i.untilQuarter >= state.quarter &&
      ((kind === 'bids' && i.kind === 'bids' && i.tenderId === targetOrTender) ||
        (kind !== 'bids' && i.targetFirmId === targetOrTender && (i.kind === kind || i.kind === 'mole'))),
  )
}

export function shadyStats(firm: Firm) {
  return {
    total: firm.shadyLog.length,
    detected: firm.shadyLog.filter((e) => e.detected).length,
  }
}
