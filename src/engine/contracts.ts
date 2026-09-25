import {
  DISCOVERY_RATE_SHARE,
  DISCOVERY_RENEWAL_FACTOR,
  OFFSHORE_SATISFACTION_HIT,
  PROMISE_BROKEN_RELATION,
  PROMISE_BROKEN_SATISFACTION,
  PROMISE_FULL_TEAM_MAX_GAP,
  PROMISE_KEPT_RELATION,
  PROMISE_KEPT_SATISFACTION,
  PROMISE_PHASED_MAX_GAP,
  RENEWAL_CHANCE,
  RENEWAL_MIN_SATISFACTION,
  clamp,
} from './constants'
import { loyaltyRenewalFactor, maturitySatisfaction } from './customers'
import { disciplineLevel, isActive } from './economy'
import type { ContractStaffing, FirmStaffing } from './economy'
import { chance, nextInt, range } from './rng'
import { DISCIPLINES } from './types'
import type { Bid, Contract, Firm, GameState, Seats, Tender } from './types'
import { addNews, nextId, seatTotal } from './util'

export function createContract(state: GameState, tender: Tender, bid: Bid, share: number, rank: number): Contract {
  const firm = state.firms[bid.firmId]
  const startQuarter = state.quarter + 1
  const contract: Contract = {
    id: nextId(state, 'c'),
    tenderId: tender.id,
    firmId: bid.firmId,
    customerId: tender.customerId,
    kind: tender.kind,
    baseSeats: { ...tender.seats },
    activeSeats: tender.kind === 'framework' ? callOffSeats(tender.seats, share, 1) : { ...tender.seats },
    rateMultiplier: bid.rateMultiplier,
    share,
    rank,
    startQuarter,
    endQuarter: startQuarter + tender.duration,
    starIds: [],
    satisfaction: 70,
    outsourcedShare: 0,
    fraud: { cvPad: bid.cvPad, ghostCv: bid.ghostCv, baitAndSwitch: false },
    terminated: false,
  }
  if (bid.promise) {
    contract.promise = bid.promise
    // A paid survey first: the first quarter bills at a reduced rate, restored once it is delivered.
    if (bid.promise === 'discovery') {
      contract.fullRate = bid.rateMultiplier
      contract.rateMultiplier = bid.rateMultiplier * DISCOVERY_RATE_SHARE
    }
  }
  for (const id of bid.starIds) {
    const star = firm.stars.find((s) => s.id === id)
    if (!star) continue
    // A star only moves once their old contract has run out, but keep references tidy either way.
    const old = state.contracts.find((c) => c.id === star.assignedContractId)
    if (old) old.starIds = old.starIds.filter((x) => x !== id)
    star.assignedContractId = contract.id
    contract.starIds.push(id)
  }
  state.contracts.push(contract)
  return contract
}

/**
 * Last quarter a star is tied up on a running contract that overlaps a contract won from `tender`
 * (which would start the quarter after it is decided), or undefined if the star is free by then.
 * Pure – safe to call from the UI.
 */
export function starBusyThrough(state: GameState, firm: Firm, starId: string, tender: Tender): number | undefined {
  const contractId = firm.stars.find((s) => s.id === starId)?.assignedContractId
  const c = contractId ? state.contracts.find((x) => x.id === contractId) : undefined
  if (!c || c.terminated || c.endQuarter <= tender.dueQuarter + 1) return undefined
  return c.endQuarter - 1
}

export function callOffSeats(base: Seats, share: number, factor: number): Seats {
  const out: Seats = {}
  for (const d of DISCIPLINES) {
    const n = Math.round((base[d] ?? 0) * share * factor)
    if (n > 0) out[d] = n
  }
  return out
}

/** Framework call-offs for the coming quarter. */
export function rollCallOffs(state: GameState, quarter: number) {
  for (const c of state.contracts) {
    if (c.kind !== 'framework' || !isActive(c, quarter)) continue
    c.activeSeats = callOffSeats(c.baseSeats, c.share, range(state.rng, 0.5, 1.5))
  }
}

/** Satisfaction, early termination and star trait effects after the quarter has been billed. */
export function updateContracts(state: GameState, firm: Firm, staffing: FirmStaffing) {
  for (const cs of staffing.contracts) {
    const c = state.contracts.find((x) => x.id === cs.contractId)
    if (!c) continue
    c.lastStaffed = cs.staffed
    c.lastFreelance = cs.freelance
    const total = seatTotal(c.activeSeats)
    if (!total) continue
    const freelanceShare = (seatTotal(cs.freelance) + seatTotal(cs.flex) * 0.5) / total
    const offshoreShare = seatTotal(cs.offshore) / total
    let level = 0
    for (const d of DISCIPLINES) level += (c.activeSeats[d] ?? 0) * disciplineLevel(firm, d)
    level /= total
    const target = clamp(
      75 + maturitySatisfaction(c.customerId) + (level - 3) * 10 - freelanceShare * 30 - offshoreShare * OFFSHORE_SATISFACTION_HIT * 5 - (c.fraud.baitAndSwitch ? 15 : 0),
      0,
      100,
    )
    c.satisfaction = clamp(c.satisfaction + (target - c.satisfaction) * 0.35, 0, 100)
    if (c.promise && c.promiseKept === undefined) checkPromise(state, c, cs, total)
    if (c.satisfaction < 30 && chance(state.rng, 0.25)) terminateContract(state, c, 'news.contract.terminatedUnhappy')
  }
}

/** After the first quarter of delivery: did the firm do what it promised in the bid? */
function checkPromise(state: GameState, c: Contract, cs: ContractStaffing, total: number) {
  const gap = (seatTotal(cs.freelance) + seatTotal(cs.flex) + seatTotal(cs.offshore)) / total
  const kept =
    c.promise === 'fullTeam' ? gap <= PROMISE_FULL_TEAM_MAX_GAP : c.promise === 'phased' ? gap <= PROMISE_PHASED_MAX_GAP : true
  c.promiseKept = kept
  if (c.fullRate !== undefined) {
    c.rateMultiplier = c.fullRate
    delete c.fullRate
  }
  c.satisfaction = clamp(c.satisfaction + (kept ? PROMISE_KEPT_SATISFACTION : -PROMISE_BROKEN_SATISFACTION), 0, 100)
  const cust = state.customers[c.customerId]
  cust.relationships[c.firmId] = clamp(
    (cust.relationships[c.firmId] ?? 20) + (kept ? PROMISE_KEPT_RELATION : -PROMISE_BROKEN_RELATION),
    0,
    100,
  )
  if (c.firmId === state.playerId) {
    addNews(state, `news.promise.${kept ? 'kept' : 'broken'}.${c.promise}`, { customer: c.customerId }, kept ? 'good' : 'bad', {
      personal: true,
    })
  }
}

export function terminateContract(state: GameState, c: Contract, newsKey?: string, relationHit = 15) {
  c.terminated = true
  c.endQuarter = Math.min(c.endQuarter, state.quarter + 1)
  releaseStars(state, c)
  const cust = state.customers[c.customerId]
  cust.relationships[c.firmId] = clamp((cust.relationships[c.firmId] ?? 20) - relationHit, 0, 100)
  const firm = state.firms[c.firmId]
  if (newsKey) {
    addNews(state, newsKey, { customer: c.customerId, firm: firm.name }, firm.isPlayer ? 'bad' : 'neutral', {
      firmId: firm.id,
      personal: firm.isPlayer,
    })
  }
}

export function releaseStars(state: GameState, c: Contract) {
  const firm = state.firms[c.firmId]
  for (const s of firm.stars) if (s.assignedContractId === c.id) s.assignedContractId = undefined
  c.starIds = []
}

/** Contracts ending before `quarter` release their stars and nudge relationships. */
export function expireContracts(state: GameState, quarter: number) {
  for (const c of state.contracts) {
    if (c.terminated || c.endQuarter !== quarter) continue
    const firm = state.firms[c.firmId]
    // Happy clients extend without a new tender. Frameworks run their course.
    if (
      c.kind === 'project' &&
      !firm.bankrupt &&
      c.satisfaction >= RENEWAL_MIN_SATISFACTION &&
      chance(state.rng, RENEWAL_CHANCE * (c.satisfaction / 80) * (c.promise === 'discovery' ? DISCOVERY_RENEWAL_FACTOR : 1) * loyaltyRenewalFactor(c.customerId))
    ) {
      const extra = nextInt(state.rng, 2, 4)
      c.endQuarter += extra
      const stats = (firm.stats ??= {})
      stats.renewals = (stats.renewals ?? 0) + 1
      // Stars who just moved on to a newly won contract stay there.
      c.starIds = c.starIds.filter((id) => firm.stars.some((s) => s.id === id && s.assignedContractId === c.id))
      if (c.firmId === state.playerId) {
        addNews(state, 'news.contract.renewed', { customer: c.customerId, count: extra }, 'good', { personal: true })
      }
      continue
    }
    releaseStars(state, c)
    const cust = state.customers[c.customerId]
    cust.relationships[c.firmId] = clamp((cust.relationships[c.firmId] ?? 20) + (c.satisfaction - 50) / 5, 0, 100)
    if (c.firmId === state.playerId) {
      addNews(state, 'news.contract.ended', { customer: c.customerId, satisfaction: Math.round(c.satisfaction) }, 'neutral', {
        personal: true,
      })
    }
  }
  // Drop contracts that ended over a year ago.
  state.contracts = state.contracts.filter((c) => c.endQuarter > quarter - 4)
}
