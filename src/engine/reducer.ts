import {
  BUDGET_MAX_PER_HEAD,
  FIRE_MORALE_HIT,
  MAX_HIRE_ORDER,
  PREMIUM_MAX,
  PREMIUM_MIN,
  SEVERANCE_QUARTERS,
  clamp,
  pricingPremium,
  quarterlySalaryCost,
} from './constants'
import { spendable } from './economy'
import { handleAcquire } from './acquisitions'
import { handleCancel, handleNurture, handleRenegotiate, handleUpsell } from './contractActions'
import { starBusyThrough } from './contracts'
import { handleResolveCrisis, handleStartCrisisTalk } from './crises'
import { handleCareerTalk, handlePromote, handleSetMentor, handleSetStretch, handleTrain } from './development'
import { handleResolveEvent } from './events'
import { hasFeature, tenderLock } from './levels'
import { employeeOf, removePeople } from './roster'
import { handleShady } from './shady'
import { handleChooseSpecialty, handleIpo, handleLobby, handleSetDepartment, handleSetPartnership } from './strategy'
import { starSigningCost } from './stars'
import { clampRate, effortCost, isKeyTender } from './tenders'
import { PROMISES } from './types'
import type { Action, ActionOf, ActionResult, ActionType, GameState } from './types'

type Handler<T extends ActionType> = (state: GameState, action: ActionOf<T>) => string | undefined

const firmOf = (state: GameState, firmId: string) => {
  const f = state.firms[firmId]
  return f && !f.bankrupt ? f : undefined
}

const openTender = (state: GameState, tenderId: string) =>
  state.tenders.find(
    (t) => t.id === tenderId && !t.resolved && !t.hidden && t.publishedQuarter <= state.quarter && t.dueQuarter >= state.quarter,
  )

const handlers: { [K in ActionType]: Handler<K> } = {
  setBudgets(state, a) {
    const firm = firmOf(state, a.firmId)
    if (!firm) return 'errors.invalid'
    if (!hasFeature(firm, 'culture')) return 'errors.levelTooLow'
    const b = a.budgets
    if (b.fagmiljoPerHead !== undefined) firm.budgets.fagmiljoPerHead = clamp(Math.round(b.fagmiljoPerHead), 0, BUDGET_MAX_PER_HEAD)
    if (b.sosialtPerHead !== undefined) firm.budgets.sosialtPerHead = clamp(Math.round(b.sosialtPerHead), 0, BUDGET_MAX_PER_HEAD)
    if (b.salaryPremium !== undefined)
      firm.budgets.salaryPremium = Math.round(clamp(b.salaryPremium, PREMIUM_MIN, PREMIUM_MAX) * 100) / 100
    return undefined
  },

  orderHires(state, a) {
    const firm = firmOf(state, a.firmId)
    if (!firm) return 'errors.invalid'
    const n = clamp(Math.round(a.count), 0, MAX_HIRE_ORDER)
    if (n) firm.hiringOrders[a.discipline] = n
    else delete firm.hiringOrders[a.discipline]
    return undefined
  },

  fire(state, a) {
    const firm = firmOf(state, a.firmId)
    if (!firm) return 'errors.invalid'
    const pool = firm.pools[a.discipline]
    const n = a.employeeId ? 1 : clamp(Math.round(a.count), 0, pool.count)
    if (!n) return 'errors.invalid'
    if (a.employeeId && employeeOf(firm, a.employeeId)?.discipline !== a.discipline) return 'errors.invalidEmployee'
    const level = pool.level
    // With a roster, pay for the people who actually go; without one they are average.
    const gone = removePeople(state, firm, a.discipline, n, a.employeeId ? { employeeId: a.employeeId } : 'weakest')
    const levels = firm.roster ? gone.map((e) => e.level) : Array<number>(n).fill(level)
    firm.quarterFired = (firm.quarterFired ?? 0) + n
    firm.cash -= levels.reduce((s, l) => s + quarterlySalaryCost(l, pricingPremium(firm)), 0) * SEVERANCE_QUARTERS
    for (const p of Object.values(firm.pools)) p.morale = clamp(p.morale - FIRE_MORALE_HIT, 0, 100)
    for (const s of firm.stars) s.morale = clamp(s.morale - FIRE_MORALE_HIT, 0, 100)
    return undefined
  },

  hireStar(state, a) {
    const firm = firmOf(state, a.firmId)
    if (!firm) return 'errors.invalid'
    if (!hasFeature(firm, 'stars')) return 'errors.levelTooLow'
    const idx = state.starMarket.findIndex((s) => s.id === a.starId)
    if (idx < 0) return 'errors.invalidStar'
    const star = state.starMarket[idx]
    const cost = starSigningCost(star, firm)
    if (firm.cash < cost) return 'errors.notEnoughCash'
    firm.cash -= cost
    state.starMarket.splice(idx, 1)
    star.loyalty = 65
    star.morale = 75
    star.joinedQuarter = state.quarter
    firm.stars.push(star)
    firm.quarterHires += 1
    return undefined
  },

  giveRaise(state, a) {
    const firm = firmOf(state, a.firmId)
    const star = firm?.stars.find((s) => s.id === a.starId)
    if (!firm || !star) return 'errors.invalidStar'
    const amount = clamp(a.amount, 0.01, 0.2)
    star.salaryPremium = Math.round((star.salaryPremium + amount) * 100) / 100
    star.loyalty = clamp(star.loyalty + amount * 200, 0, 100)
    star.morale = clamp(star.morale + 5, 0, 100)
    return undefined
  },

  placeBid(state, a) {
    const firm = firmOf(state, a.bid.firmId)
    const tender = openTender(state, a.tenderId)
    if (!firm) return 'errors.invalid'
    if (!tender) return 'errors.invalidTender'
    const locked = tenderLock(firm, tender)
    if (locked) return locked
    const effort = clamp(Math.round(a.bid.effort), 0, 3) as 0 | 1 | 2 | 3
    if (a.bid.promise && (!isKeyTender(tender) || !PROMISES.includes(a.bid.promise))) return 'errors.promiseNotAllowed'
    const starIds = [...new Set(a.bid.starIds)]
    for (const id of starIds) {
      if (!firm.stars.some((s) => s.id === id)) return 'errors.invalidStar'
      const promised = state.tenders.some(
        (t) => t.id !== tender.id && !t.resolved && t.bids.some((b) => b.firmId === firm.id && b.starIds.includes(id)),
      )
      if (promised) return 'errors.starPromised'
      if (starBusyThrough(state, firm, id, tender) !== undefined) return 'errors.starBusy'
    }
    const existing = tender.bids.find((b) => b.firmId === firm.id)
    const cost = Math.max(0, effortCost(effort) - (existing ? effortCost(existing.effort) : 0))
    // Effort may be paid from the credit line, and a free bid is always allowed.
    if (cost > 0 && cost > spendable(firm)) return 'errors.notEnoughCash'
    firm.cash -= cost
    const bid = {
      firmId: firm.id,
      rateMultiplier: Math.round(clampRate(a.bid.rateMultiplier) * 100) / 100,
      starIds,
      effort: Math.max(effort, existing?.effort ?? 0) as 0 | 1 | 2 | 3,
      // Fraud flags can only be set through the backroom.
      cvPad: existing?.cvPad ?? false,
      ghostCv: existing?.ghostCv ?? false,
      ...(a.bid.promise ? { promise: a.bid.promise } : {}),
    }
    tender.bids = tender.bids.filter((b) => b.firmId !== firm.id)
    tender.bids.push(bid)
    return undefined
  },

  withdrawBid(state, a) {
    const tender = openTender(state, a.tenderId)
    if (!tender) return 'errors.invalidTender'
    const before = tender.bids.length
    tender.bids = tender.bids.filter((b) => b.firmId !== a.firmId)
    return before === tender.bids.length ? 'errors.noBid' : undefined
  },

  recordMinigame(state, a) {
    const tender = openTender(state, a.tenderId)
    if (!tender) return 'errors.invalidTender'
    const firm = firmOf(state, a.firmId)
    if (!firm) return 'errors.invalid'
    if (!isKeyTender(tender)) return 'errors.noMeetingNeeded'
    if (a.kind === 'bingo' && !hasFeature(firm, 'bingo')) return 'errors.levelTooLow'
    const existing = tender.minigameResults[a.firmId]
    if (existing && (!existing.provisional || existing.kind !== a.kind || a.provisional)) return 'errors.minigameAlreadyPlayed'
    tender.minigameResults[a.firmId] = {
      kind: a.kind,
      score: clamp(Math.round(a.score), 0, 100),
      ...(a.provisional ? { provisional: true } : {}),
    }
    return undefined
  },

  resolveEvent: handleResolveEvent,
  resolveCrisis: handleResolveCrisis,
  startCrisisTalk: handleStartCrisisTalk,
  shady: handleShady,
  chooseSpecialty: handleChooseSpecialty,
  setPartnership: handleSetPartnership,
  lobby: handleLobby,
  setDepartment: handleSetDepartment,
  acquireFirm: handleAcquire,
  ipo: handleIpo,
  renegotiateContract: handleRenegotiate,
  cancelContract: handleCancel,
  upsellContract: handleUpsell,
  nurtureContract: handleNurture,
  trainEmployee: handleTrain,
  promoteEmployee: handlePromote,
  setMentor: handleSetMentor,
  setStretch: handleSetStretch,
  careerTalk: handleCareerTalk,
}

/** Mutates `draft` in place. Use inside engine code that already owns a draft (AI turns, sim). */
export function applyActionInPlace(draft: GameState, action: Action): string | undefined {
  if (draft.status !== 'playing') return 'errors.gameOver'
  const handler = handlers[action.type] as Handler<typeof action.type>
  return handler(draft, action as never)
}

/**
 * Pure: returns a new state, never mutates the input. On error, returns the original state.
 * Note: handlers may partially mutate the draft before failing – that's why the draft is discarded.
 */
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status !== 'playing') return { state, error: 'errors.gameOver' }
  const draft = structuredClone(state)
  const error = applyActionInPlace(draft, action)
  return error ? { state, error } : { state: draft }
}
