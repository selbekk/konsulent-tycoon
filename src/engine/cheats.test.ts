import { afterEach, describe, expect, it } from 'vitest'
import { PREMIUM_MIN, clamp } from './constants'
import { applyAction } from './reducer'
import { SHADY_CATALOG } from './shady'
import { starSigningCost } from './stars'
import { newTestGame, veteranTestGame } from './testUtils'
import { endTurn } from './turn'
import type { GameState } from './types'

const original = structuredClone(SHADY_CATALOG)
afterEach(() => Object.assign(SHADY_CATALOG, structuredClone(original)))

const openTender = (s: GameState) => s.tenders.find((t) => !t.resolved && !t.hidden && t.publishedQuarter <= s.quarter)!

/** Loopholes a player could use from the normal UI or a hand-crafted action. */
describe('cheats', () => {
  it('clamp turns NaN into the minimum and still clamps Infinity', () => {
    expect(clamp(NaN, 0, 3)).toBe(0)
    expect(clamp(Infinity, -1, 1)).toBe(1)
    expect(clamp(-Infinity, -1, 1)).toBe(-1)
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('a NaN in an action never reaches the cash', () => {
    const s = newTestGame()
    const bid = { firmId: 'player', rateMultiplier: NaN, starIds: [], effort: NaN as 0, cvPad: false, ghostCv: false }
    let r = applyAction(s, { type: 'placeBid', tenderId: openTender(s).id, bid })
    r = applyAction(r.state, { type: 'setBudgets', firmId: 'player', budgets: { salaryPremium: NaN, fagmiljoPerHead: NaN } })
    const after = endTurn(r.state)
    expect(Number.isFinite(after.firms.player.cash)).toBe(true)
    expect(Number.isFinite(after.firms.player.budgets.salaryPremium)).toBe(true)
  })

  it('lowering the salary premium just before signing a star saves nothing', () => {
    const s = veteranTestGame()
    s.firms.player.cash = 50_000_000
    s.firms.player.budgets.salaryPremium = 0.2
    const [star] = s.starMarket
    const s1 = endTurn(s)
    // Keep the star on the market whatever the quarter's draws did with it.
    if (!s1.starMarket.some((x) => x.id === star.id)) s1.starMarket.push(star)
    const cost = starSigningCost(s1.starMarket.find((x) => x.id === star.id)!, s1.firms.player)
    const dipped = applyAction(s1, { type: 'setBudgets', firmId: 'player', budgets: { salaryPremium: PREMIUM_MIN } }).state
    const target = dipped.starMarket.find((x) => x.id === star.id)!
    expect(starSigningCost(target, dipped.firms.player)).toBe(cost)
  })

  it('a backroom trick against the same rival works once a quarter', () => {
    SHADY_CATALOG.rumor.baseDetection = 0
    const s = veteranTestGame()
    const once = applyAction(s, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: 'accentura' })
    expect(once.error).toBeUndefined()
    expect(applyAction(once.state, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: 'accentura' }).error).toBe('errors.shadyRepeat')
    // Another rival is fair game, and so is the same one next quarter.
    const other = s.firmOrder.find((id) => id !== 'player' && id !== 'accentura')!
    expect(applyAction(once.state, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: other }).error).toBeUndefined()
    const next = endTurn(once.state)
    expect(applyAction(next, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: 'accentura' }).error).not.toBe('errors.shadyRepeat')
  })

  it('a LinkedIn post boosts the brand once a quarter, whoever it targets', () => {
    const s = veteranTestGame()
    const [a, b] = s.firmOrder.filter((id) => id !== 'player')
    const once = applyAction(s, { type: 'shady', firmId: 'player', actionId: 'linkedin_post', targetFirmId: a })
    expect(once.error).toBeUndefined()
    expect(applyAction(once.state, { type: 'shady', firmId: 'player', actionId: 'linkedin_post', targetFirmId: b }).error).toBe('errors.shadyRepeat')
  })

  it('spying needs a tender that is actually out', () => {
    const s = veteranTestGame()
    const t = openTender(s)
    t.hidden = true
    expect(applyAction(s, { type: 'shady', firmId: 'player', actionId: 'spy_bids', tenderId: t.id }).error).toBe('errors.invalidTender')
  })
})
