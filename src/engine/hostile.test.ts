import { beforeAll, describe, expect, it } from 'vitest'
import { BUDGET_MAX_PER_HEAD, MAX_HIRE_ORDER, MAX_LEVEL, PREMIUM_MAX, PREMIUM_MIN, RATE_MAX, RATE_MIN } from './constants'
import { applyAction } from './reducer'
import { hasValidShape } from './saveShape'
import { botRun } from './testUtils'
import type { Action, GameState } from './types'
import { isKeyTender } from './tenders'

/**
 * The leaderboard replays action logs sent by the client, so the reducer is a trust boundary: anyone can
 * edit the log before it's sent. Every action must either fail or stay within what the UI allows.
 */
let base: GameState
let rival: string

function apply(action: unknown): { state: GameState; error?: string } {
  try {
    return applyAction(base, action as Action)
  } catch {
    // A crash rejects the whole submission on the server, which is as good as an error.
    return { state: base, error: 'crash' }
  }
}

/** Fails, or changes nothing a rival firm has, and leaves a valid state with finite money. */
function expectHarmless(action: unknown) {
  const r = apply(action)
  if (r.error) return r
  expect(hasValidShape(JSON.parse(JSON.stringify(r.state)))).toBe(true)
  expect(Number.isFinite(r.state.firms.player.cash)).toBe(true)
  expect(JSON.stringify(r.state.firms[rival])).toBe(JSON.stringify(base.firms[rival]))
  return r
}

describe('hostile actions from a tampered log', () => {
  beforeAll(() => {
    base = botRun({ seed: 3, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' }, 10).state
    base.firms.player.level = MAX_LEVEL
    base.firms.player.cash = 50_000_000
    rival = base.firmOrder.find((id) => id !== base.playerId && base.firms[id].stars.length > 0)!
  })

  it('clamps budgets, hiring and raises to the UI’s range', () => {
    for (const v of [NaN, -1e12, 1e12, 0.5]) {
      const b = expectHarmless({ type: 'setBudgets', firmId: 'player', budgets: { fagmiljoPerHead: v, sosialtPerHead: v, salaryPremium: v } })
      if (!b.error) {
        const { fagmiljoPerHead, sosialtPerHead, salaryPremium } = b.state.firms.player.budgets
        for (const x of [fagmiljoPerHead, sosialtPerHead]) expect(x >= 0 && x <= BUDGET_MAX_PER_HEAD).toBe(true)
        expect(salaryPremium >= PREMIUM_MIN && salaryPremium <= PREMIUM_MAX).toBe(true)
      }
      const h = expectHarmless({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: v })
      expect(h.state.firms.player.hiringOrders.backend ?? 0).toBeLessThanOrEqual(MAX_HIRE_ORDER)
      const star = base.firms.player.stars[0]
      const g = expectHarmless({ type: 'giveRaise', firmId: 'player', starId: star.id, amount: v })
      if (!g.error) expect(g.state.firms.player.stars[0].salaryPremium - star.salaryPremium).toBeLessThanOrEqual(0.2 + 1e-9)
    }
  })

  it('clamps a bid’s rate and effort', () => {
    const tender = base.tenders.find((t) => !t.resolved && !t.hidden && t.publishedQuarter <= base.quarter && t.dueQuarter >= base.quarter)!
    for (const v of [NaN, -1e12, 1e12]) {
      const r = expectHarmless({ type: 'placeBid', tenderId: tender.id, bid: { firmId: 'player', rateMultiplier: v, starIds: [], effort: v, cvPad: true, ghostCv: true } })
      if (r.error) continue
      const bid = r.state.tenders.find((t) => t.id === tender.id)!.bids.find((b) => b.firmId === 'player')!
      expect(bid.rateMultiplier >= RATE_MIN && bid.rateMultiplier <= RATE_MAX).toBe(true)
      expect([0, 1, 2, 3]).toContain(bid.effort)
      // Fraud flags only come from the backroom.
      expect(bid.cvPad || bid.ghostCv).toBe(false)
    }
    const rivalStar = base.firms[rival].stars[0].id
    expect(apply({ type: 'placeBid', tenderId: tender.id, bid: { firmId: 'player', rateMultiplier: 1, starIds: [rivalStar], effort: 0, cvPad: false, ghostCv: false } }).error).toBeTruthy()
  })

  it('clamps minigame scores and only takes known minigames', () => {
    const tender = base.tenders.find((t) => !t.resolved && !t.hidden && isKeyTender(t) && t.publishedQuarter <= base.quarter && t.dueQuarter >= base.quarter)
    expect(tender && !tender.minigameResults.player).toBe(true)
    if (!tender) return
    const r = expectHarmless({ type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'meeting', score: 1e9 })
    expect(r.state.tenders.find((t) => t.id === tender.id)!.minigameResults.player.score).toBe(100)
    expect(apply({ type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'poker', score: 50 }).error).toBeTruthy()
  })

  it('rejects ids that point outside the player’s own things', () => {
    const rivalStar = base.firms[rival].stars[0].id
    const rivalContract = base.contracts.find((c) => c.firmId === rival && !c.terminated)?.id ?? 'none'
    const employee = base.firms.player.roster![0].id
    const rejected: unknown[] = [
      { type: 'hireStar', firmId: 'player', starId: rivalStar },
      { type: 'giveRaise', firmId: 'player', starId: rivalStar, amount: 0.1 },
      { type: 'setMentor', firmId: 'player', employeeId: employee, starId: rivalStar },
      { type: 'setStretch', firmId: 'player', employeeId: employee, contractId: rivalContract },
      { type: 'cancelContract', firmId: 'player', contractId: rivalContract },
      { type: 'renegotiateContract', firmId: 'player', contractId: rivalContract },
      { type: 'nurtureContract', firmId: 'player', contractId: rivalContract },
      { type: 'upsellContract', firmId: 'player', contractId: rivalContract, discipline: 'backend', count: 1 },
      { type: 'promoteEmployee', firmId: 'player', employeeId: 'nobody' },
      { type: 'acquireFirm', firmId: 'player', targetFirmId: 'player' },
      { type: 'acquireFirm', firmId: 'player', targetFirmId: 'constructor' },
    ]
    for (const a of rejected) expect(apply(a).error, JSON.stringify(a)).toBeTruthy()
  })

  it('never takes inherited object keys for ids', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const rejected: unknown[] = [
        { type: 'setDepartment', firmId: 'player', departmentId: key, on: true },
        { type: 'setPartnership', firmId: 'player', partnershipId: key, on: true },
        { type: 'chooseSpecialty', firmId: 'player', specialty: key },
        { type: 'shady', firmId: 'player', actionId: key },
        { type: 'orderHires', firmId: 'player', discipline: key, count: 3 },
        { type: 'fire', firmId: 'player', discipline: key, count: 1 },
        { type: 'trainEmployee', firmId: 'player', discipline: key },
        { type: 'acquireFirm', firmId: 'player', targetFirmId: key },
      ]
      for (const a of rejected) expect(apply(a).error, JSON.stringify(a)).toBeTruthy()
      // Backroom tricks aimed at a firm: an inherited key is no firm, and nothing lands on the prototype.
      for (const actionId of ['rumor', 'dn_leak', 'linkedin_post', 'spy_salaries', 'plant_mole', 'afterwork_poach']) {
        const a = { type: 'shady', firmId: 'player', actionId, targetFirmId: key, starId: 'x' }
        expect(apply(JSON.parse(JSON.stringify(a))).error, JSON.stringify(a)).toBeTruthy()
      }
    }
    for (const k of ['reputation', 'scandalPenalty', 'brandMod']) expect(Object.hasOwn(Object.prototype, k), k).toBe(false)
  })

  it('keeps only ids it found in the backroom log, never what the action carried', () => {
    const payload = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    // Aimed at the rival on purpose, so it does change them; only the log entry matters here.
    const r = apply({ type: 'shady', firmId: 'player', actionId: 'linkedin_post', targetFirmId: rival, tenderId: payload, contractId: payload })
    expect(r.error).toBeUndefined()
    const entry = r.state.firms.player.shadyLog.at(-1)!
    expect(entry.tenderId).toBeUndefined()
    expect(entry.contractId).toBeUndefined()
    expect(entry.targetFirmId).toBe(rival)
  })

  it('treats a missing or non-number amount as the minimum', () => {
    for (const v of [undefined, 'x', null, {}]) {
      expectHarmless({ type: 'setBudgets', firmId: 'player', budgets: { fagmiljoPerHead: v, sosialtPerHead: v, salaryPremium: v } })
      const star = base.firms.player.stars[0]
      expectHarmless({ type: 'giveRaise', firmId: 'player', starId: star.id, amount: v })
      const own = base.contracts.find((c) => c.firmId === 'player' && !c.terminated)
      if (own) expectHarmless({ type: 'shady', firmId: 'player', actionId: 'silent_outsource', contractId: own.id, share: v })
    }
  })

  it('rejects impossible upsell sizes', () => {
    const own = base.contracts.find((c) => c.firmId === 'player' && !c.terminated && c.kind === 'project')
    expect(own).toBeDefined()
    if (!own) return
    // 0.4 rounds to 0; 0.5 would round to a legal 1.
    for (const count of [0, -3, 0.4, 1e6, NaN, Infinity]) {
      expect(apply({ type: 'upsellContract', firmId: 'player', contractId: own.id, discipline: 'backend', count }).error).toBeTruthy()
    }
  })

  it('caps the share of a contract a backroom outsourcing deal can move', () => {
    const own = base.contracts.find((c) => c.firmId === 'player' && !c.terminated)
    expect(own).toBeDefined()
    if (!own) return
    const r = expectHarmless({ type: 'shady', firmId: 'player', actionId: 'silent_outsource', contractId: own.id, share: 50 })
    expect(r.error).toBeUndefined()
    expect(r.state.contracts.find((c) => c.id === own.id)!.outsourcedShare).toBe(0.8)
  })
})
