import { creditLimit, disciplineSupply, headcount, quarterFinancials, staffFirm } from '../economy'
import { PARTNERSHIPS } from '../../content/strategy'
import { acquisitionBlock, acquisitionPrice } from '../acquisitions'
import { starBusyThrough } from '../contracts'
import { hasFeature, tenderLock } from '../levels'
import { lobbyReadyIn } from '../strategy'
import { planContractMoves } from './contractMoves'
import { choosePromise } from './promises'
import { CAREER_PROMISE_GROWTH, COURSE_MAX_LEVEL, PROMOTE_MIN_POTENTIAL } from '../constants'
import { mentorBlock, promotionBlock, stretchBlock, stretchContracts } from '../development'
import { noise } from '../rng'
import { isKeyTender, openTenders } from '../tenders'
import { DISCIPLINES } from '../types'
import type { Action, Discipline, Employee, GameState } from '../types'
import { seatTotal } from '../util'

/**
 * A simulated "sensible human" for balancing: bids where it can mostly staff the work,
 * prices a little under market, hires in small steps when busy, keeps culture decent.
 * Draws from state.rng – call on a draft only.
 */
export type StrategyMove = 'specialty' | 'partner' | 'lobby' | 'departments' | 'ipo' | 'acquire'
const ALL_MOVES: StrategyMove[] = ['specialty', 'partner', 'lobby', 'departments', 'ipo', 'acquire']

export function planHumanProxy(
  state: GameState,
  opts: { price?: number; minigame?: number; strategic?: boolean | StrategyMove[]; develop?: boolean } = {},
): Action[] {
  const firmId = state.playerId
  const firm = state.firms[firmId]
  if (firm.bankrupt) return []
  const actions: Action[] = []
  const fin = quarterFinancials(state, firmId)
  const hc = headcount(firm)
  const runway = (firm.cash + creditLimit(firm) * 0.5) / Math.max(1, fin.total)

  if (hasFeature(firm, 'culture'))
    actions.push({
      type: 'setBudgets',
      firmId,
      budgets: {
        fagmiljoPerHead: runway > 1.5 ? 15_000 : 8_000,
        sosialtPerHead: runway > 1.5 ? 12_000 : 6_000,
        salaryPremium: 0.02,
      },
    })

  // Free people per discipline when new work would start, minus what's already offered.
  const open = openTenders(state)
  const nextQ = state.quarter + 2
  const committed = staffFirm(state, firm, nextQ).demand
  const free: Record<Discipline, number> = Object.fromEntries(
    DISCIPLINES.map((d) => [d, disciplineSupply(firm, d) + (firm.pendingHires[d] ?? 0) - (committed[d] ?? 0)]),
  ) as Record<Discipline, number>
  for (const t of open) {
    if (!t.bids.some((b) => b.firmId === firmId)) continue
    for (const d of DISCIPLINES) free[d] -= t.seats[d] ?? 0
  }

  // A star can only be on one open bid; a rejected placeBid would silently drop the whole bid.
  const promised = new Set(open.flatMap((t) => t.bids.filter((b) => b.firmId === firmId).flatMap((b) => b.starIds)))

  const candidates = open
    .filter((t) => !t.bids.some((b) => b.firmId === firmId) && !tenderLock(firm, t))
    .map((t) => {
      const total = seatTotal(t.seats)
      const covered = DISCIPLINES.reduce((s, d) => s + Math.min(t.seats[d] ?? 0, Math.max(0, free[d])), 0)
      return { t, total, cover: covered / total }
    })
    .filter((x) => x.cover >= (fin.utilization < 0.6 ? 0.3 : 0.5) && x.total <= Math.max(6, hc * 1.2))
    // Most coverable seats first: small gigs only when that's what fits.
    .sort((a, b) => b.cover * b.total - a.cover * a.total || b.cover - a.cover)
    .slice(0, Math.max(3, Math.round(hc / 4)))

  for (const { t } of candidates) {
    const stars = firm.stars
      .filter(
        (s) =>
          !promised.has(s.id) &&
          (t.seats[s.discipline] ?? 0) > 0 &&
          starBusyThrough(state, firm, s.id, t) === undefined,
      )
      .slice(0, 2)
    stars.forEach((s) => promised.add(s.id))
    // Only key tenders have a customer meeting.
    if (isKeyTender(t))
      actions.push({
        type: 'recordMinigame',
        firmId,
        tenderId: t.id,
        kind: 'meeting',
        score: Math.max(0, Math.min(100, (opts.minigame ?? 70) + noise(state.rng, 15))),
      })
    actions.push({
      type: 'placeBid',
      tenderId: t.id,
      bid: {
        firmId,
        rateMultiplier:
          Math.round(((opts.price ?? 0.95) + noise(state.rng, 0.02) - (t.priceWeight > 0.6 ? 0.05 : 0)) * 100) / 100,
        starIds: stars.map((s) => s.id),
        effort: runway > 1 ? 2 : 1,
        cvPad: false,
        ghostCv: false,
        promise: choosePromise(t, free),
      },
    })
    for (const d of DISCIPLINES) free[d] -= t.seats[d] ?? 0
  }

  // Two slow quarters in a row with little on the way: let a few go.
  const recent = firm.history.slice(-2)
  if (recent.length === 2 && recent.every((h) => h.utilization < 0.5) && runway < 2 && hc > 6) {
    const idle = [...DISCIPLINES].sort((a, b) => free[b] - free[a])[0]
    const n = Math.min(firm.pools[idle].count, Math.max(1, Math.round(free[idle] * 0.3)))
    if (n > 0) actions.push({ type: 'fire', firmId, discipline: idle, count: n })
  }

  // Hire into shortfalls first, then grow gently when busy.
  const next = staffFirm(state, firm, state.quarter + 1)
  if (runway > 1) {
    for (const d of DISCIPLINES) {
      const short = (next.demand[d] ?? 0) - disciplineSupply(firm, d) - (firm.pendingHires[d] ?? 0)
      if (short > 0) actions.push({ type: 'orderHires', firmId, discipline: d, count: Math.ceil(short * 1.5) })
    }
    const nextUtil = next.billed / Math.max(1, hc + DISCIPLINES.reduce((a, d) => a + (firm.pendingHires[d] ?? 0), 0))
    if (fin.utilization > 0.85 && nextUtil > 0.85) {
      const busiest = [...DISCIPLINES].sort((a, b) => (next.demand[b] ?? 0) - (next.demand[a] ?? 0))[0]
      actions.push({ type: 'orderHires', firmId, discipline: busiest, count: Math.max(2, Math.round(hc * 0.1)) })
    }
  }
  // Care whenever the reducer allows it, so the to-do item never stays open.
  actions.push(
    ...planContractMoves(state, firmId, fin.staffing.demand, { runway, eagerness: 1, nurtureRunway: -Infinity }),
  )
  if (opts.develop !== false) actions.push(...planDevelopment(state, runway))
  if (opts.strategic) actions.push(...planStrategy(state, runway, opts.strategic === true ? ALL_MOVES : opts.strategic))
  return actions
}

/**
 * Grows its own people the way a keen player might: promote whoever is ready, send a few on
 * courses (talents first), give every star a mentee, stretch talents who hit the course ceiling,
 * and have a career talk only when the course will clearly keep the promise.
 */
function planDevelopment(state: GameState, runway: number): Action[] {
  const firmId = state.playerId
  const firm = state.firms[firmId]
  if (!firm.roster || !hasFeature(firm, 'development')) return []
  const actions: Action[] = []
  const talent = (e: Employee) => !!e.potentialRevealed && e.potential >= PROMOTE_MIN_POTENTIAL
  const ready = firm.roster.find((e) => !promotionBlock(state, firm, e))
  if (ready) actions.push({ type: 'promoteEmployee', firmId, employeeId: ready.id })
  if (runway > 1.5) {
    const courses = firm.roster
      .filter(
        (e) =>
          e.id !== ready?.id && !e.course && e.level < COURSE_MAX_LEVEL && (!e.potentialRevealed || e.potential >= 0.4),
      )
      .sort(
        (a, b) =>
          Number(talent(b)) - Number(talent(a)) ||
          Number(!!a.potentialRevealed) - Number(!!b.potentialRevealed) ||
          a.level - b.level,
      )
      .slice(0, Math.max(1, Math.round(firm.roster.length / 15)))
    for (const e of courses) {
      actions.push({ type: 'trainEmployee', firmId, discipline: e.discipline, employeeId: e.id })
      if (talent(e) && !e.promise && e.level + CAREER_PROMISE_GROWTH <= COURSE_MAX_LEVEL)
        actions.push({ type: 'careerTalk', firmId, employeeId: e.id })
    }
  }
  const mentored = new Set(firm.roster.filter((e) => e.mentorStarId).map((e) => e.id))
  for (const star of firm.stars) {
    if (firm.roster.some((e) => e.mentorStarId === star.id)) continue
    const mentee = firm.roster
      .filter((e) => e.id !== ready?.id && !mentored.has(e.id) && !mentorBlock(firm, e, star))
      .sort((a, b) => Number(talent(b)) - Number(talent(a)) || a.level - b.level)[0]
    if (mentee) {
      actions.push({ type: 'setMentor', firmId, employeeId: mentee.id, starId: star.id })
      mentored.add(mentee.id)
    }
  }
  for (const e of firm.roster) {
    if (e.id === ready?.id || !talent(e) || e.level < COURSE_MAX_LEVEL || e.stretchContractId) continue
    const c = stretchContracts(state, firm, e)
      .filter((x) => !stretchBlock(state, firm, e, x.id))
      .sort((a, b) => b.satisfaction - a.satisfaction)[0]
    if (c && c.satisfaction >= 70) actions.push({ type: 'setStretch', firmId, employeeId: e.id, contractId: c.id })
  }
  return actions
}

/** Balancing only: uses the Strategy tab the way a sensible player might. */
function planStrategy(state: GameState, runway: number, moves: StrategyMove[]): Action[] {
  const wants = (m: StrategyMove) => moves.includes(m)
  const firmId = state.playerId
  const firm = state.firms[firmId]
  const actions: Action[] = []
  const top = [...DISCIPLINES].sort((a, b) => disciplineSupply(firm, b) - disciplineSupply(firm, a))[0]
  if (wants('specialty') && hasFeature(firm, 'strategy') && !firm.specialty)
    actions.push({ type: 'chooseSpecialty', firmId, specialty: top })
  if (hasFeature(firm, 'partnerships')) {
    const partner = PARTNERSHIPS.find((p) => p.discipline === top)
    if (wants('partner') && partner && !(firm.partnerships ?? []).length && runway > 2)
      actions.push({ type: 'setPartnership', firmId, partnershipId: partner.id, on: true })
    if (wants('lobby') && lobbyReadyIn(state, firm) === 0 && runway > 2) actions.push({ type: 'lobby', firmId })
  }
  if (wants('departments') && hasFeature(firm, 'departments')) {
    for (const [id, minRunway] of [
      ['academy', 2],
      ['sales', 3],
    ] as const) {
      const on = (firm.departments ?? []).includes(id)
      if (!on && runway > minRunway) actions.push({ type: 'setDepartment', firmId, departmentId: id, on: true })
      if (on && runway < 1) actions.push({ type: 'setDepartment', firmId, departmentId: id, on: false })
    }
  }
  if (wants('ipo') && hasFeature(firm, 'ipo') && !firm.listed) actions.push({ type: 'ipo', firmId })
  if (
    wants('acquire') &&
    hasFeature(firm, 'acquisitions') &&
    (firm.stats?.acquisitions ?? 0) < Math.floor(state.quarter / 8)
  ) {
    const target = state.firmOrder
      .map((id) => state.firms[id])
      .filter((f) => !acquisitionBlock(firm, f) && acquisitionPrice(f) * 2 < firm.cash)
      .sort((a, b) => acquisitionPrice(a) - acquisitionPrice(b))[0]
    if (target) actions.push({ type: 'acquireFirm', firmId, targetFirmId: target.id })
  }
  return actions
}
