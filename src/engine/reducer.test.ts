import { describe, expect, it } from 'vitest'
import { applyAction } from './reducer'
import { bidQuality, bidScoreEstimate } from './tenders'
import { deepFreeze, newTestGame } from './testUtils'
import type { Bid, GameState } from './types'

const openTender = (s: GameState) => s.tenders.find((t) => !t.resolved && !t.hidden)!
const bid = (overrides: Partial<Bid> = {}): Bid => ({
  firmId: 'player', rateMultiplier: 1, starIds: [], effort: 1, cvPad: false, ghostCv: false, ...overrides,
})

describe('reducer', () => {
  it('never mutates the input state', () => {
    const s = deepFreeze(newTestGame())
    const r = applyAction(s, { type: 'setBudgets', firmId: 'player', budgets: { fagmiljoPerHead: 20_000 } })
    expect(r.error).toBeUndefined()
    expect(r.state.firms.player.budgets.fagmiljoPerHead).toBe(20_000)
    expect(s.firms.player.budgets.fagmiljoPerHead).toBe(10_000)
  })

  it('clamps budgets and premium', () => {
    const r = applyAction(newTestGame(), {
      type: 'setBudgets', firmId: 'player', budgets: { fagmiljoPerHead: 1e9, salaryPremium: 5 },
    })
    expect(r.state.firms.player.budgets.fagmiljoPerHead).toBe(40_000)
    expect(r.state.firms.player.budgets.salaryPremium).toBe(0.3)
  })

  it('firing costs severance and morale', () => {
    const s = newTestGame()
    const r = applyAction(s, { type: 'fire', firmId: 'player', discipline: 'backend', count: 1 })
    expect(r.state.firms.player.pools.backend.count).toBe(s.firms.player.pools.backend.count - 1)
    expect(r.state.firms.player.cash).toBeLessThan(s.firms.player.cash)
    expect(applyAction(s, { type: 'fire', firmId: 'player', discipline: 'design', count: 1 }).error).toBe('errors.invalid')
  })

  it('places a bid, charges effort and ignores fraud flags from input', () => {
    const s = newTestGame()
    const t = openTender(s)
    const r = applyAction(s, { type: 'placeBid', tenderId: t.id, bid: bid({ effort: 2, cvPad: true, rateMultiplier: 9 }) })
    expect(r.error).toBeUndefined()
    const placed = r.state.tenders.find((x) => x.id === t.id)!.bids.find((b) => b.firmId === 'player')!
    expect(placed.cvPad).toBe(false)
    expect(placed.rateMultiplier).toBe(1.4)
    expect(r.state.firms.player.cash).toBe(s.firms.player.cash - 60_000)
  })

  it('rejects promising the same star in two open bids', () => {
    let s = newTestGame()
    const [t1, t2] = s.tenders.filter((t) => !t.resolved)
    const star = s.firms.player.stars[0].id
    s = applyAction(s, { type: 'placeBid', tenderId: t1.id, bid: bid({ starIds: [star] }) }).state
    expect(applyAction(s, { type: 'placeBid', tenderId: t2.id, bid: bid({ starIds: [star] }) }).error).toBe('errors.starPromised')
  })

  it('allows one minigame attempt per tender', () => {
    let s = newTestGame()
    const t = openTender(s)
    const r1 = applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: t.id, kind: 'bingo', score: 250 })
    expect(r1.error).toBeUndefined()
    s = r1.state
    expect(s.tenders.find((x) => x.id === t.id)!.minigameResults.player.score).toBe(100)
    expect(applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: t.id, kind: 'bingo', score: 10 }).error).toBe(
      'errors.minigameAlreadyPlayed',
    )
  })

  it('UI estimates never touch the rng', () => {
    const s = newTestGame()
    const before = s.rng.s
    const t = openTender(s)
    bidQuality(s, bid(), t)
    bidScoreEstimate(s, bid(), t, 0.9)
    expect(s.rng.s).toBe(before)
  })

  it('hires a star from the market if affordable', () => {
    const s = newTestGame()
    const star = s.starMarket[0]
    const r = applyAction(s, { type: 'hireStar', firmId: 'player', starId: star.id })
    expect(r.error).toBeUndefined()
    expect(r.state.firms.player.stars.some((x) => x.id === star.id)).toBe(true)
    expect(r.state.starMarket.some((x) => x.id === star.id)).toBe(false)
    const broke = structuredClone(s)
    broke.firms.player.cash = 0
    expect(applyAction(broke, { type: 'hireStar', firmId: 'player', starId: star.id }).error).toBe('errors.notEnoughCash')
  })
})
