import { BUZZWORDS } from '../content/buzzwords'
import { CUSTOMERS } from '../content/customers'
import { TREND_MAP } from '../content/trends'
import {
  BID_NOISE,
  CAPACITY_PENALTY,
  SMALL_TENDERS_MAX,
  SMALL_TENDERS_MIN,
  SMALL_TENDER_MAX_SEATS,
  FLEX_AVAILABILITY,
  DEMAND_GROWTH_PER_YEAR,
  PRIORITY_BONUS,
  EFFORT_COST,
  FEEDBACK_MIN_STRENGTH,
  FRAMEWORK_SHARES,
  KEY_TENDER_MIN_SEATS,
  NEEDS_STYLE_RELATION,
  PROMISE_FULL_TEAM_QUALITY,
  PROMISE_MATCH_QUALITY,
  PROMISE_PHASED_CAPACITY,
  PROMISE_PHASED_QUALITY,
  QUICK_BID_PRICE_RATE,
  QUICK_BID_RATE,
  ROUTINE_MEETING_SCORE,
  MIN_AWARD_QUALITY,
  RATE_MAX,
  RATE_MIN,
  RELATION_LOSS,
  RELATION_WIN,
  TARGET_DEMAND_RATIO,
  clamp,
} from './constants'
import { createContract } from './contracts'
import { seniorityCvFactor } from './customers'
import { disciplineLevel, disciplineSupply, headcount, isActive, staffFirm } from './economy'
import { chance, nextFloat, nextInt, noise, range, shuffle, weightedPick } from './rng'
import { checkFraudAtAward } from './shady'
import { mentorPenalty } from './roster'
import { starBidQuality } from './stars'
import { strategyBonus } from './strategy'
import { DISCIPLINES } from './types'
import type { Bid, BidFactor, Contract, ContractKind, Discipline, GameState, MeetingStyle, PromiseId, Seats, Tender } from './types'
import { activeFirms, addNews, nextId, seatTotal } from './util'

export function trendDemand(state: GameState, d: Discipline): number {
  return state.trends.reduce((m, t) => m * (TREND_MAP[t.id]?.demand[d] ?? 1), 1)
}

function trendFactor(state: GameState, key: 'volume' | 'priceWeight'): number {
  return state.trends.reduce((m, t) => m * (TREND_MAP[t.id]?.[key] ?? 1), 1)
}

export function marketCapacity(state: GameState): number {
  return activeFirms(state).reduce((s, f) => s + headcount(f), 0)
}

/** Seats that will still be running when newly published tenders start. */
export function committedDemand(state: GameState, quarter: number): number {
  return state.contracts
    .filter((c) => isActive(c, quarter))
    .reduce((s, c) => s + seatTotal(c.kind === 'framework' ? scaleSeats(c.baseSeats, c.share) : c.baseSeats), 0)
}

function scaleSeats(seats: Seats, f: number): Seats {
  const out: Seats = {}
  for (const d of DISCIPLINES) if (seats[d]) out[d] = seats[d]! * f
  return out
}

/** Share of the market's consultants per discipline – tenders roughly follow what exists. */
export function marketSupplyShare(state: GameState): Record<Discipline, number> {
  const firms = activeFirms(state)
  const total = Math.max(1, firms.reduce((s, f) => s + headcount(f), 0))
  return Object.fromEntries(
    DISCIPLINES.map((d) => [d, Math.max(0.02, firms.reduce((s, f) => s + disciplineSupply(f, d), 0) / total)]),
  ) as Record<Discipline, number>
}

/** Seats in open (unresolved) tenders – demand that is already on its way to the market. */
export function pipelineDemand(state: GameState): number {
  return state.tenders
    .filter((t) => !t.resolved && !t.hidden)
    .reduce((s, t) => s + seatTotal(t.seats), 0)
}

function tenderSize(state: GameState, kind: 'project' | 'framework', budgetFactor: number): number {
  const roll = nextFloat(state.rng)
  const base =
    kind === 'framework'
      ? roll < 0.5 ? range(state.rng, 6, 12) : roll < 0.85 ? range(state.rng, 12, 20) : range(state.rng, 20, 30)
      : roll < 0.5 ? range(state.rng, 2, 6) : roll < 0.85 ? range(state.rng, 6, 12) : range(state.rng, 12, 20)
  return Math.max(2, Math.round(base * (0.8 + budgetFactor * 0.2)))
}

/** Total seats customers want, independent of how many consultants survive. Grows slowly. */
export function marketDemand(state: GameState, quarter: number): number {
  const base = state.baseDemand ?? marketCapacity(state) * TARGET_DEMAND_RATIO
  return base * (1 + DEMAND_GROWTH_PER_YEAR) ** (quarter / 4) * trendFactor(state, 'volume')
}

function buildTender(
  state: GameState,
  customerId: string,
  kind: ContractKind,
  seats: Seats,
  duration: number,
  publishedQuarter: number,
): Tender {
  const customer = state.customers[customerId]
  const priceWeight = clamp(customer.priceWeight * trendFactor(state, 'priceWeight') + noise(state.rng, 0.08), 0.1, 0.95)
  const trendWords = state.trends.flatMap((t) => TREND_MAP[t.id]?.buzzwords ?? [])
  const buzzwords = [...new Set([...trendWords, ...shuffle(state.rng, BUZZWORDS)])].slice(0, nextInt(state.rng, 4, 6))
  return {
    id: nextId(state, 't'),
    customerId,
    kind,
    seats,
    duration,
    priceWeight: Math.round(priceWeight * 100) / 100,
    qualityWeight: Math.round((1 - priceWeight) * 100) / 100,
    publishedQuarter,
    dueQuarter: publishedQuarter + 1,
    buzzwords,
    bids: [],
    minigameResults: {},
    resolved: false,
    winnerIds: [],
  }
}

export function publishTenders(state: GameState, publishedQuarter: number) {
  const capacity = marketCapacity(state)
  const startQuarter = publishedQuarter + 2
  const gap = marketDemand(state, startQuarter) - committedDemand(state, startQuarter) - pipelineDemand(state) * 0.8
  const minCount = clamp(Math.round(capacity / 150), 4, 8)
  const supplyShare = marketSupplyShare(state)
  // Small gigs ("we need one more developer for a while") are always out there,
  // so a young firm with a couple of free people has something to bid on.
  const smallCount = nextInt(state.rng, SMALL_TENDERS_MIN, SMALL_TENDERS_MAX)
  for (let i = 0; i < smallCount; i++) {
    const def = weightedPick(state.rng, CUSTOMERS, (c) => c.weight)!
    const d = weightedPick(state.rng, DISCIPLINES, (x) => supplyShare[x] * (def.favours.includes(x) ? 3 : 0.5) * trendDemand(state, x))!
    const size = nextInt(state.rng, 1, SMALL_TENDER_MAX_SEATS)
    state.tenders.push(buildTender(state, def.id, 'project', { [d]: size }, nextInt(state.rng, 1, 3), publishedQuarter))
  }

  // Small gigs come on top: taking them out of the budget crowded out the mid-size
  // tenders small firms live on (see docs/balance-log.md).
  let budget = Math.max(gap, minCount * 6)
  let count = 0
  while (budget > 0 && count < 24) {
    count++
    const def = weightedPick(state.rng, CUSTOMERS, (c) => c.weight)!
    const customer = state.customers[def.id]
    const kind = chance(state.rng, 0.3) ? 'framework' : 'project'
    const size = tenderSize(state, kind, customer.budgetFactor)
    budget -= size
    const nDisc = size < 4 ? 1 : nextInt(state.rng, 1, 3)
    const weightOf = (d: Discipline) => supplyShare[d] * (def.favours.includes(d) ? 3 : 0.5) * trendDemand(state, d)
    const chosen: Discipline[] = []
    while (chosen.length < nDisc) {
      const d = weightedPick(state.rng, DISCIPLINES.filter((x) => !chosen.includes(x)), weightOf)
      if (!d) break
      chosen.push(d)
    }
    const weights = chosen.map((d) => weightOf(d) * range(state.rng, 0.6, 1.4))
    const wsum = weights.reduce((a, b) => a + b, 0)
    const seats: Seats = {}
    let placed = 0
    chosen.forEach((d, idx) => {
      const n = idx === chosen.length - 1 ? size - placed : Math.max(1, Math.round((weights[idx] / wsum) * size))
      if (n > 0) {
        seats[d] = n
        placed += n
      }
    })
    const duration = kind === 'framework' ? nextInt(state.rng, 8, 16) : nextInt(state.rng, 2, 6)
    state.tenders.push(buildTender(state, def.id, kind, seats, duration, publishedQuarter))
  }
}

/** When a firm goes bust its clients still need the people: live contracts go back out to tender. */
export function retenderContracts(state: GameState, contracts: Contract[], publishedQuarter: number) {
  for (const c of contracts) {
    const remaining = c.endQuarter - (publishedQuarter + 2)
    if (remaining < 2 || seatTotal(c.baseSeats) === 0) continue
    state.tenders.push(buildTender(state, c.customerId, c.kind, { ...c.baseSeats }, remaining, publishedQuarter))
  }
}

export const openTenders = (state: GameState) =>
  state.tenders.filter((t) => !t.resolved && !t.hidden && t.publishedQuarter <= state.quarter)

export function effortCost(effort: number) {
  return effort * EFFORT_COST
}

export function clampRate(r: number) {
  return clamp(r, RATE_MIN, RATE_MAX)
}

/** Frameworks and bigger projects: worth a customer meeting and a promise. Everything else is routine. */
export function isKeyTender(tender: Tender): boolean {
  return tender.kind === 'framework' || seatTotal(tender.seats) >= KEY_TENDER_MIN_SEATS
}

/** The start the customer hopes for. */
export function customerWants(customerId: string): PromiseId | undefined {
  return CUSTOMERS.find((c) => c.id === customerId)?.wants
}

export type QualityParts = Record<'cv' | 'fagmiljo' | 'meeting' | 'effort' | 'reputation' | 'extras' | 'capacity' | 'promise', number>

/** Everything that goes into bid quality, before clamping. Pure – never touches state.rng. */
export function bidQualityParts(state: GameState, bid: Bid, tender: Tender): QualityParts | undefined {
  const firm = state.firms[bid.firmId]
  const total = seatTotal(tender.seats)
  if (!firm || total === 0) return undefined
  // What the firm has free when the contract would start.
  const committed = staffFirm(state, firm, tender.dueQuarter + 1).demand
  let levelSum = 0
  let available = 0
  let otherFree = 0
  for (const d of DISCIPLINES) {
    const n = tender.seats[d] ?? 0
    const free = Math.max(0, disciplineSupply(firm, d) - (committed[d] ?? 0))
    if (!n) {
      otherFree += free
      continue
    }
    levelSum += n * disciplineLevel(firm, d)
    available += Math.min(n, free)
    otherFree += Math.max(0, free - n)
  }
  // People from other disciplines count half – customers accept some flex staffing.
  available = Math.min(total, available + otherFree * FLEX_AVAILABILITY)
  const stars = bid.starIds.map((id) => firm.stars.find((s) => s.id === id)).filter((s) => !!s)
  let cv = levelSum / total
  let traitBonus = 0
  const k = Math.min(stars.length, total)
  if (k > 0) {
    const starLevels = stars.slice(0, k).map((s) => (tender.seats[s.discipline] ? s.level : s.level - 1.5))
    cv = (cv * (total - k) + starLevels.reduce((a, b) => a + b, 0)) / total
    traitBonus = stars.slice(0, k).reduce((s, x) => s + starBidQuality(x) - mentorPenalty(firm, x.id), 0)
  }
  // Customers check whether the people on the CVs are actually available – unless you invent them.
  // Up to half the seats from subcontractors is fine; beyond that it hurts.
  const unavailable = 1 - available / total
  const promise = isKeyTender(tender) ? bid.promise : undefined
  const capacityPenalty = bid.ghostCv
    ? 0
    : CAPACITY_PENALTY * Math.max(0, (unavailable - 0.5) * 2) * (promise === 'phased' ? PROMISE_PHASED_CAPACITY : 1)
  // Routine tenders have no meeting: everyone gets an average impression.
  const minigame = isKeyTender(tender) ? (tender.minigameResults[bid.firmId]?.score ?? 0) : ROUTINE_MEETING_SCORE
  const promisePart = !promise
    ? 0
    : (promise === 'fullTeam' ? PROMISE_FULL_TEAM_QUALITY : promise === 'phased' ? PROMISE_PHASED_QUALITY : 0) +
      (customerWants(tender.customerId) === promise ? PROMISE_MATCH_QUALITY : 0)
  return {
    cv: 0.5 * (cv / 5) * 100 * seniorityCvFactor(tender.customerId),
    fagmiljo: 0.2 * firm.fagmiljo,
    meeting: 0.15 * minigame,
    effort: 0.15 * (bid.effort / 3) * 100,
    reputation: 0.1 * (firm.reputation - 50),
    extras: traitBonus + strategyBonus(state, firm, tender) + (bid.cvPad ? 10 : 0) + (bid.ghostCv ? 15 : 0),
    capacity: -capacityPenalty,
    promise: promisePart,
  }
}

const sumParts = (p: QualityParts) => Object.values(p).reduce((a, b) => a + b, 0)

/** Pure – never touches state.rng. Safe for UI estimates. */
export function bidQuality(state: GameState, bid: Bid, tender: Tender): number {
  const parts = bidQualityParts(state, bid, tender)
  return parts ? clamp(sumParts(parts), 0, 100) : 0
}

export function relationship(state: GameState, customerId: string, firmId: string): number {
  return state.customers[customerId]?.relationships[firmId] ?? 20
}

/** Customers like vendors for whom their deal actually matters ("you'll be our top priority"). */
export function priorityBonus(state: GameState, bid: Bid, tender: Tender): number {
  const hc = Math.max(1, headcount(state.firms[bid.firmId]))
  const share = seatTotal(tender.seats) / hc
  return share >= 0.25 ? PRIORITY_BONUS : share >= 0.1 ? PRIORITY_BONUS / 2 : 0
}

/** Pure, noise-free score. Pass `quality` when it is already known, to skip a staffing pass. */
export function bidScoreEstimate(state: GameState, bid: Bid, tender: Tender, lowestRate: number, quality = bidQuality(state, bid, tender)): number {
  const price = (lowestRate / bid.rateMultiplier) * 100
  return (
    tender.priceWeight * price +
    tender.qualityWeight * quality +
    0.1 * relationship(state, tender.customerId, bid.firmId) +
    priorityBonus(state, bid, tender)
  )
}

/** A bid's score split by factor, for explaining the outcome. Quality parts are weighted by the tender. */
function scoreFactors(state: GameState, bid: Bid, tender: Tender, lowestRate: number): Record<BidFactor, number> {
  const parts = bidQualityParts(state, bid, tender)!
  const w = tender.qualityWeight
  return {
    price: tender.priceWeight * (lowestRate / bid.rateMultiplier) * 100,
    cv: w * parts.cv,
    fagmiljo: w * parts.fagmiljo,
    meeting: w * parts.meeting,
    effort: w * parts.effort,
    reputation: w * parts.reputation,
    extras: w * parts.extras,
    capacity: w * parts.capacity,
    promise: w * parts.promise,
    relationship: 0.1 * relationship(state, tender.customerId, bid.firmId),
    priority: priorityBonus(state, bid, tender),
  }
}

type Scored = { bid: Bid; score: number; noise: number }

/**
 * Why `mine` beat or lost to `rival`: the factor that made the biggest difference, plus the
 * biggest one pulling the other way when losing ("the price was fine"). `luck` when the
 * noise decided it against the rest.
 */
function explainOutcome(state: GameState, tender: Tender, lowest: number, mine: Scored, rival: Scored, won: boolean) {
  const a = scoreFactors(state, mine.bid, tender, lowest)
  const b = scoreFactors(state, rival.bid, tender, lowest)
  const diffs = (Object.keys(a) as BidFactor[]).map((f) => ({ f, d: a[f] - b[f] })).sort((x, y) => x.d - y.d)
  const rest = diffs.reduce((s, x) => s + x.d, 0)
  if (won ? rest < 0 : rest > 0) return { main: 'luck' as const }
  const main = won ? diffs[diffs.length - 1] : diffs[0]
  const other = won ? undefined : diffs[diffs.length - 1]
  return { main: main.f, strength: other && other.d >= FEEDBACK_MIN_STRENGTH ? other.f : undefined }
}

/** Why a bid fell below the minimum quality. */
export function rejectionReason(state: GameState, bid: Bid, tender: Tender): BidFactor {
  const parts = bidQualityParts(state, bid, tender)
  return parts && parts.capacity <= -10 ? 'capacity' : 'cv'
}

/** A sensible offer for routine tenders, sent with one click. Pure. */
export function quickBid(state: GameState, firmId: string, tender: Tender): Bid {
  const firm = state.firms[firmId]
  const effort = firm && effortCost(1) <= Math.max(0, firm.cash) ? 1 : 0
  return {
    firmId,
    rateMultiplier: tender.priceWeight > 0.6 ? QUICK_BID_PRICE_RATE : QUICK_BID_RATE,
    starIds: [],
    effort,
    cvPad: false,
    ghostCv: false,
  }
}

export type CustomerNeed = PromiseId | 'tightBudget' | 'qualityFirst' | MeetingStyle | 'styleUnknown'

/** What the customer lets on before the meeting. How they like to be talked to shows with a good relationship. Pure. */
export function customerNeeds(state: GameState, tender: Tender, firmId: string): CustomerNeed[] {
  const needs: CustomerNeed[] = []
  const wants = customerWants(tender.customerId)
  if (wants) needs.push(wants)
  if (tender.priceWeight >= 0.55) needs.push('tightBudget')
  else if (tender.priceWeight <= 0.4) needs.push('qualityFirst')
  const style = state.customers[tender.customerId]?.meetingPreference
  needs.push(style && relationship(state, tender.customerId, firmId) >= NEEDS_STYLE_RELATION ? style : 'styleUnknown')
  return needs
}

/** Rough win-chance hint for the UI: compares against a typical market bid. */
export function marketLowestGuess(tender: Tender) {
  return tender.priceWeight > 0.6 ? 0.8 : 0.9
}

export function resolveDueTenders(state: GameState) {
  for (const tender of state.tenders) {
    if (tender.resolved || tender.dueQuarter !== state.quarter) continue
    tender.resolved = true
    const valid = tender.bids.filter((b) => state.firms[b.firmId] && !state.firms[b.firmId].bankrupt)
    if (!valid.length) {
      if (!tender.hidden) addNews(state, 'news.tender.noBids', { customer: tender.customerId }, 'neutral')
      continue
    }
    const quality = new Map(valid.map((b) => [b, bidQuality(state, b, tender)]))
    const bids = valid.filter((b) => quality.get(b)! >= MIN_AWARD_QUALITY)
    const playerRejected = valid.some((b) => b.firmId === state.playerId) && !bids.some((b) => b.firmId === state.playerId)
    if (playerRejected) {
      const bid = valid.find((b) => b.firmId === state.playerId)!
      const key = rejectionReason(state, bid, tender) === 'capacity' ? 'news.tender.playerRejectedCapacity' : 'news.tender.playerRejected'
      addNews(state, key, { customer: tender.customerId }, 'bad', { firmId: state.playerId, personal: true })
    }
    if (!bids.length) {
      if (!tender.hidden && !playerRejected) addNews(state, 'news.tender.noneGoodEnough', { customer: tender.customerId }, 'neutral')
      continue
    }
    const lowest = Math.min(...bids.map((b) => b.rateMultiplier))
    const scored: Scored[] = bids
      .map((bid) => {
        const n = noise(state.rng, BID_NOISE)
        return { bid, noise: n, score: bidScoreEstimate(state, bid, tender, lowest, quality.get(bid)) + n }
      })
      .sort((a, b) => b.score - a.score)
    const winners = tender.kind === 'framework' ? scored.slice(0, FRAMEWORK_SHARES.length) : scored.slice(0, 1)
    const customer = state.customers[tender.customerId]
    winners.forEach(({ bid }, rank) => {
      const share = tender.kind === 'framework' ? FRAMEWORK_SHARES[rank] : 1
      const contract = createContract(state, tender, bid, share, rank + 1)
      tender.winnerIds.push(bid.firmId)
      const winner = state.firms[bid.firmId]
      winner.tendersWon = (winner.tendersWon ?? 0) + 1
      const stats = (winner.stats ??= {})
      if (customer.sector === 'public') stats.publicWins = (stats.publicWins ?? 0) + 1
      if (tender.kind === 'framework') stats.frameworkWins = (stats.frameworkWins ?? 0) + 1
      stats.biggestWin = Math.max(stats.biggestWin ?? 0, seatTotal(tender.seats))
      customer.relationships[bid.firmId] = clamp(relationship(state, customer.id, bid.firmId) + RELATION_WIN, 0, 100)
      checkFraudAtAward(state, contract)
    })
    for (const { bid } of scored.slice(winners.length)) {
      customer.relationships[bid.firmId] = clamp(relationship(state, customer.id, bid.firmId) + RELATION_LOSS, 0, 100)
    }

    const top = state.firms[winners[0].bid.firmId]
    const playerWon = winners.some((w) => w.bid.firmId === state.playerId)
    const mine = scored.find((x) => x.bid.firmId === state.playerId)
    if (playerWon && mine) {
      const rank = winners.findIndex((w) => w.bid.firmId === state.playerId) + 1
      const rival = scored[winners.length]
      const why = rival ? explainOutcome(state, tender, lowest, mine, rival, true).main : 'alone'
      addNews(
        state,
        tender.kind === 'framework' ? 'news.tender.playerWonFramework' : 'news.tender.playerWon',
        { customer: tender.customerId, rank, bidders: bids.length, strong: why },
        'good',
        { firmId: state.playerId, personal: true },
      )
    } else if (mine) {
      // The bar to clear: the winner, or the last framework place.
      const why = explainOutcome(state, tender, lowest, mine, winners[winners.length - 1], false)
      const params = { customer: tender.customerId, firm: top.name, weak: why.main }
      if (why.main !== 'luck' && why.strength) {
        addNews(state, 'news.tender.playerLostBoth', { ...params, strong: why.strength }, 'bad', { personal: true })
      } else {
        addNews(state, 'news.tender.playerLost', params, 'bad', { personal: true })
      }
    }
    if (!tender.hidden && (bids.length >= 4 || seatTotal(tender.seats) >= 10)) {
      addNews(state, tender.kind === 'framework' ? 'news.tender.frameworkAwarded' : 'news.tender.awarded', {
        customer: tender.customerId,
        firm: top.name,
        bidders: bids.length,
      })
    }
  }
  // Keep resolved tenders around for one year for history, then drop them.
  state.tenders = state.tenders.filter((t) => !t.resolved || t.dueQuarter > state.quarter - 4)
}
