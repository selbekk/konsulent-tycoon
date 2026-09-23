import { EVENT_MAP } from '../../content/events'
import { AI_MAX_OPEN_BIDS } from '../constants'
import { creditLimit, disciplineSupply, headcount, quarterFinancials, staffFirm } from '../economy'
import { canChoose } from '../events'
import { chance, noise, nextFloat, pick, weightedPick } from '../rng'
import { SHADY_CATALOG } from '../shady'
import { starSigningCost } from '../stars'
import { acceptRate } from '../staff'
import { openTenders, effortCost } from '../tenders'
import { DISCIPLINES } from '../types'
import type { Action, Difficulty, Firm, GameState, ShadyActionId, Tender } from '../types'
import { activeFirms, seatTotal } from '../util'
import { personalityFor } from './personalities'
import type { Personality } from './personalities'

const DIFFICULTY_FACTOR: Record<Difficulty, number> = { easy: 0.6, normal: 1, hard: 1.4 }

function tenderFit(state: GameState, firm: Firm, t: Tender, freeByDiscipline: Record<string, number>): number {
  const total = seatTotal(t.seats)
  const hc = headcount(firm)
  // Simulated players are small and hungry: they bid bigger and hire to fill.
  const maxShare = firm.isPlayer ? 1.2 : 0.8
  if (!total || total > Math.max(firm.isPlayer ? 8 : 4, hc * maxShare)) return 0
  let covered = 0
  for (const d of DISCIPLINES) {
    const n = t.seats[d] ?? 0
    if (!n) continue
    const supply = disciplineSupply(firm, d)
    if (!firm.isPlayer && supply === 0 && n > 1) return 0
    covered += Math.min(n, Math.max(0, freeByDiscipline[d] ?? 0) + (firm.isPlayer ? n * 0.3 : supply * 0.1))
  }
  const rel = state.customers[t.customerId]?.relationships[firm.id] ?? 20
  return (covered / total) * (0.7 + rel / 150)
}

/**
 * Decides what an AI firm (or a simulated player) does this quarter.
 * Draws from state.rng, so call it on a draft only.
 */
export function planAiTurn(state: GameState, firmId: string, override?: Personality): Action[] {
  const firm = state.firms[firmId]
  if (!firm || firm.bankrupt) return []
  const p = override ?? personalityFor(firm.personalityId)
  const df = firm.isPlayer ? 1 : DIFFICULTY_FACTOR[state.difficulty]
  const actions: Action[] = []
  const fin = quarterFinancials(state, firmId)
  const burn = Math.max(1, fin.total)
  // Runway counts the credit line too – that's what it's for.
  const runway = (firm.cash + (firm.isPlayer ? creditLimit(firm) * 0.6 : 0)) / burn
  const hc = headcount(firm)

  // 1. Budgets
  const lean = runway < 1.2
  actions.push({
    type: 'setBudgets',
    firmId,
    budgets: {
      fagmiljoPerHead: Math.round(((4_000 + 22_000 * p.qualityFocus) * (lean ? 0.4 : 1)) / 1000) * 1000,
      sosialtPerHead: Math.round(((5_000 + 12_000 * p.qualityFocus) * (lean ? 0.4 : 1)) / 1000) * 1000,
      salaryPremium: Math.round((p.qualityFocus - 0.5) * 0.15 * 100) / 100,
    },
  })

  // 2. Hiring / firing, based on next quarter's demand
  const next = staffFirm(state, firm, state.quarter + 1)
  const free: Record<string, number> = {}
  const util = fin.utilization
  const rate = Math.max(0.2, acceptRate(firm))
  for (const d of DISCIPLINES) {
    const supply = disciplineSupply(firm, d)
    const demand = next.demand[d] ?? 0
    free[d] = supply - demand
    if (runway > (firm.isPlayer ? 1 : 1.5) && fin.ebitda > -burn * 0.1) {
      const shortfall = Math.max(0, demand - supply - (firm.pendingHires[d] ?? 0))
      const growth = util > 0.75 ? supply * 0.08 * p.growthAppetite * (p.mix[d] ? 1 : 0.3) : 0
      const want = Math.round((shortfall * 0.8 + growth) / rate)
      if (want > 0) actions.push({ type: 'orderHires', firmId, discipline: d, count: Math.min(want, 12) })
    }
  }
  // Losing money: let the bench go, harder the shorter the runway.
  if (fin.ebitda < 0 && util < 0.7 && runway < 3 && hc > 6) {
    const share = runway < 1.5 ? 0.5 : 0.25
    for (const d of DISCIPLINES) {
      const bench = Math.min(firm.pools[d].count, free[d])
      const n = Math.floor(bench * share)
      if (n > 0) actions.push({ type: 'fire', firmId, discipline: d, count: n })
    }
  }

  // 3. Bids
  const open = openTenders(state)
  const myOpen = open.filter((t) => t.bids.some((b) => b.firmId === firmId)).length
  const maxBids = firm.isPlayer ? 5 : Math.min(AI_MAX_OPEN_BIDS, Math.max(2, Math.round(hc / 12)) + (util < 0.6 ? 3 : 0))
  const slots = Math.max(0, maxBids - myOpen)
  const promised = new Set(open.flatMap((t) => t.bids.filter((b) => b.firmId === firmId).flatMap((b) => b.starIds)))
  const candidates = open
    .filter((t) => !t.bids.some((b) => b.firmId === firmId))
    .map((t) => ({ t, fit: tenderFit(state, firm, t, free) * (0.8 + nextFloat(state.rng) * 0.4) }))
    .filter((x) => x.fit > (firm.isPlayer ? 0.4 : 0.2))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, slots)
  for (const { t } of candidates) {
    const hungry = util < 0.6 ? -0.08 : util > 0.92 ? 0.06 : 0
    const priceBias = p.priceBias + hungry + (t.priceWeight > 0.6 ? -0.05 : 0)
    const rateMultiplier = Math.round((priceBias + noise(state.rng, 0.06)) * 100) / 100
    const stars = firm.stars
      .filter((s) => !promised.has(s.id) && (t.seats[s.discipline] ?? 0) > 0)
      .sort((a, b) => b.level - a.level)
      .slice(0, 2)
    stars.forEach((s) => promised.add(s.id))
    const effort = (runway < 1 ? 0 : p.qualityFocus > 0.75 ? 3 : p.qualityFocus > 0.5 ? 2 : 1) as 0 | 1 | 2 | 3
    if (firm.cash < effortCost(effort)) continue
    actions.push({
      type: 'recordMinigame',
      firmId,
      tenderId: t.id,
      kind: 'meeting',
      score: Math.max(0, Math.min(100, (firm.isPlayer ? 70 : p.qualityFocus * 80) + noise(state.rng, 12))),
    })
    actions.push({
      type: 'placeBid',
      tenderId: t.id,
      bid: { firmId, rateMultiplier, starIds: stars.map((s) => s.id), effort, cvPad: false, ghostCv: false },
    })
  }

  // 4. Stars
  if (state.starMarket.length && runway > 2.5 && chance(state.rng, p.growthAppetite * 0.25)) {
    const star = pick(state.rng, state.starMarket)
    if (firm.cash > starSigningCost(star, firm) * 3) actions.push({ type: 'hireStar', firmId, starId: star.id })
  }
  for (const s of firm.stars) {
    if (!s.founder && s.loyalty < 35 && runway > 1.5) actions.push({ type: 'giveRaise', firmId, starId: s.id, amount: 0.05 })
  }

  const rivals = activeFirms(state).filter((f) => f.id !== firmId)
  const pickTarget = (weightFn: (f: Firm) => number) => weightedPick(state.rng, rivals, weightFn)
  const playerWeight = (f: Firm) => (f.isPlayer ? 3 * df : 1)

  // 5. Poaching
  if (runway > 1.5 && chance(state.rng, p.aggression * 0.3 * df)) {
    const target = pickTarget((f) => (f.stars.some((s) => !s.founder) ? playerWeight(f) : 0))
    const star = target?.stars.filter((s) => !s.founder).sort((a, b) => a.loyalty - b.loyalty)[0]
    if (target && star) actions.push({ type: 'shady', firmId, actionId: 'afterwork_poach', targetFirmId: target.id, starId: star.id })
  }

  // 6. Shady business
  if (runway > 1 && chance(state.rng, p.shadiness * df)) {
    const options: ShadyActionId[] = ['rumor', 'linkedin_post', 'linkedin_post', 'spy_bids']
    if (p.priceBias < 0.9) options.push('silent_outsource', 'silent_outsource')
    const bidTenders = candidates.map((c) => c.t)
    if (bidTenders.length) options.push('cv_pad')
    const actionId = pick(state.rng, options)
    const target = pickTarget((f) => playerWeight(f) * (1 + f.reputation / 50))
    if (actionId === 'silent_outsource') {
      const contracts = state.contracts.filter((c) => c.firmId === firmId && !c.terminated && c.outsourcedShare === 0 && c.endQuarter > state.quarter + 1)
      if (contracts.length) actions.push({ type: 'shady', firmId, actionId, contractId: pick(state.rng, contracts).id, share: 0.4 })
    } else if (actionId === 'cv_pad') {
      actions.push({ type: 'shady', firmId, actionId, tenderId: pick(state.rng, bidTenders).id })
    } else if (actionId === 'spy_bids') {
      if (bidTenders.length) actions.push({ type: 'shady', firmId, actionId, tenderId: bidTenders[0].id })
    } else if (target && firm.cash > SHADY_CATALOG[actionId].cost * 5) {
      actions.push({ type: 'shady', firmId, actionId, targetFirmId: target.id })
    }
  }
  // Turn outsourcing off again once the heat gets uncomfortable.
  if (firm.heat > 40) {
    for (const c of state.contracts) {
      if (c.firmId === firmId && c.outsourcedShare > 0)
        actions.push({ type: 'shady', firmId, actionId: 'silent_outsource', contractId: c.id, share: 0 })
    }
  }
  return actions
}

/** Simulated players answer their events: first affordable choice. */
export function planEventAnswers(state: GameState, firmId: string): Action[] {
  return state.pendingEvents
    .filter((pe) => pe.firmId === firmId)
    .map((pe) => {
      const def = EVENT_MAP[pe.eventId]
      const choice = def?.choices.find((c) => canChoose(state, pe, c.id))
      return choice ? ({ type: 'resolveEvent', pendingEventId: pe.id, choiceId: choice.id } as Action) : undefined
    })
    .filter((a): a is Action => !!a)
}
