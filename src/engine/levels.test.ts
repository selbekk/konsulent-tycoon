import { describe, expect, it } from 'vitest'
import { LEVELS, MAX_LEVEL, OFFICE_MOVE_BRAND, OFFICE_MOVE_SOSIALT } from './constants'
import { earnedLevel, firmLevel, hasFeature, levelStats, maxTenderSeats, tenderLevel, tenderLock, unlocksAt, updateLevels } from './levels'
import { applyAction } from './reducer'
import { SHADY_LEVELS } from './shady'
import { deepFreeze, newTestGame } from './testUtils'
import { quarterTodos } from './todos'
import { resolveDueTenders } from './tenders'
import type { Bid, GameState, Tender } from './types'

const bid = (overrides: Partial<Bid> = {}): Bid => ({
  firmId: 'player', rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false, ...overrides,
})
const open = (s: GameState) => s.tenders.filter((t) => !t.resolved && !t.hidden)
const withTender = (s: GameState, patch: Partial<Tender>) => {
  const t = open(s)[0]
  Object.assign(t, patch)
  return t
}

describe('firm levels', () => {
  it('starts the player at level 1 and rivals at the level their size earns', () => {
    const s = newTestGame()
    expect(s.firms.player.level).toBe(1)
    for (const id of s.firmOrder.filter((x) => x !== 'player')) {
      const f = s.firms[id]
      expect(f.level).toBe(earnedLevel(f))
      expect(f.level).toBeGreaterThanOrEqual(2)
    }
  })

  it('needs only one goal per level and can skip levels', () => {
    const f = structuredClone(newTestGame().firms.player)
    expect(earnedLevel(f)).toBe(1)
    f.tendersWon = LEVELS[1].tendersWon
    expect(earnedLevel(f)).toBe(2)
    f.pools.backend.count += LEVELS[4].headcount
    expect(earnedLevel(f)).toBe(MAX_LEVEL)
  })

  it('derives the level for saves from before levels existed', () => {
    const f = structuredClone(newTestGame().firms.player)
    delete f.level
    f.pools.backend.count += LEVELS[2].headcount
    expect(firmLevel(f)).toBe(3)
  })

  it('keeps a level-1 firm to small projects', () => {
    const s = newTestGame()
    const me = s.firms.player
    expect(maxTenderSeats(me)).toBe(LEVELS[0].maxSeats)
    const framework = withTender(s, { kind: 'framework', seats: { backend: 2 } })
    expect(tenderLock(me, framework)).toBe('errors.levelTooLow')
    expect(applyAction(s, { type: 'placeBid', tenderId: framework.id, bid: bid() }).error).toBe('errors.levelTooLow')
    Object.assign(framework, { kind: 'project', seats: { backend: LEVELS[0].maxSeats + 1 } })
    expect(applyAction(s, { type: 'placeBid', tenderId: framework.id, bid: bid() }).error).toBe('errors.tenderTooBig')
    expect(tenderLevel(framework)).toBe(2)
    framework.seats = { backend: 2 }
    expect(applyAction(s, { type: 'placeBid', tenderId: framework.id, bid: bid() }).error).toBeUndefined()
  })

  it('locks culture, stars, bingo and the backroom at level 1', () => {
    const s = deepFreeze(newTestGame())
    const me = s.firms.player
    const tender = open(s).find((t) => !tenderLock(me, t))!
    const rival = s.firmOrder[1]
    expect(applyAction(s, { type: 'setBudgets', firmId: 'player', budgets: { fagmiljoPerHead: 20_000 } }).error).toBe('errors.levelTooLow')
    expect(applyAction(s, { type: 'hireStar', firmId: 'player', starId: s.starMarket[0].id }).error).toBe('errors.levelTooLow')
    expect(applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'bingo', score: 50 }).error).toBe('errors.levelTooLow')
    expect(applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'meeting', score: 50 }).error).toBeUndefined()
    expect(applyAction(s, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: rival }).error).toBe('errors.levelTooLow')
  })

  it('opens backroom tricks level by level', () => {
    const s = newTestGame()
    s.firms.player.level = 3
    const rival = s.firmOrder[1]
    expect(hasFeature(s.firms.player, 'backroom')).toBe(true)
    expect(applyAction(s, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: rival }).error).toBeUndefined()
    expect(applyAction(s, { type: 'shady', firmId: 'player', actionId: 'dn_leak', targetFirmId: rival }).error).toBe('errors.levelTooLow')
  })

  it('lists what each level unlocks, and every trick opens at some level', () => {
    expect(unlocksAt(1, SHADY_LEVELS).features).toEqual([])
    expect(unlocksAt(2, SHADY_LEVELS).features).toContain('culture')
    const all = Array.from({ length: MAX_LEVEL }, (_, i) => unlocksAt(i + 1, SHADY_LEVELS).shady).flat()
    expect(all.sort()).toEqual(Object.keys(SHADY_LEVELS).sort())
    expect(Math.min(...Object.values(SHADY_LEVELS))).toBe(3)
  })

  it('levels up at the end of the quarter, never down, and says so', () => {
    const s = newTestGame()
    s.firms.player.tendersWon = LEVELS[1].tendersWon
    updateLevels(s)
    expect(s.firms.player.level).toBe(2)
    expect(s.firms.player.levelUpQuarter).toBe(s.quarter)
    expect(s.news.at(-1)).toMatchObject({ key: 'news.level.up', params: { level: 2 }, personal: true })
    s.firms.player.tendersWon = 0
    updateLevels(s)
    expect(s.firms.player.level).toBe(2)
  })

  it('moves the firm to a bigger office on level-up', () => {
    const s = newTestGame()
    const before = { sosialt: s.firms.player.sosialt, brand: s.firms.player.brandMod }
    s.firms.player.tendersWon = LEVELS[1].tendersWon
    updateLevels(s)
    expect(s.firms.player.sosialt).toBe(before.sosialt + OFFICE_MOVE_SOSIALT)
    expect(s.firms.player.brandMod).toBe(before.brand + OFFICE_MOVE_BRAND)
    updateLevels(s)
    expect(s.firms.player.sosialt).toBe(before.sosialt + OFFICE_MOVE_SOSIALT)
  })

  it('counts won tenders', () => {
    const s = newTestGame()
    const t = open(s).find((x) => !tenderLock(s.firms.player, x))!
    t.bids = [bid()]
    t.dueQuarter = s.quarter
    resolveDueTenders(s)
    expect(s.firms.player.tendersWon).toBe(1)
  })

  it('does not ask for bids on tenders the firm is too small for', () => {
    const s = newTestGame()
    for (const t of open(s)) t.kind = 'framework'
    expect(quarterTodos(s, 'player').find((x) => x.id === 'bid')?.done).toBe(true)
  })

  it('UI helpers never touch the rng', () => {
    const s = newTestGame()
    const before = s.rng.s
    const me = s.firms.player
    levelStats(me)
    firmLevel(me)
    for (const t of open(s)) tenderLock(me, t)
    expect(s.rng.s).toBe(before)
  })
})
