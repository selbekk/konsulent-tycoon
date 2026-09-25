import { describe, expect, it } from 'vitest'
import {
  DISCOVERY_RATE_SHARE,
  PROMISE_BROKEN_SATISFACTION,
  PROMISE_FULL_TEAM_QUALITY,
  PROMISE_KEPT_SATISFACTION,
  PROMISE_MATCH_QUALITY,
  ROUTINE_MEETING_SCORE,
} from './constants'
import { createContract, updateContracts } from './contracts'
import { staffFirm } from './economy'
import { applyAction } from './reducer'
import {
  bidQuality,
  bidQualityParts,
  customerNeeds,
  customerWants,
  isKeyTender,
  quickBid,
  resolveDueTenders,
} from './tenders'
import { makeKeyTender, newTestGame, syncRosterToPools } from './testUtils'
import type { Bid, GameState, PromiseId, Tender } from './types'

const bid = (overrides: Partial<Bid> = {}): Bid => ({
  firmId: 'player',
  rateMultiplier: 1,
  starIds: [],
  effort: 1,
  cvPad: false,
  ghostCv: false,
  ...overrides,
})
const firstOpen = (s: GameState) => s.tenders.find((t) => !t.resolved && !t.hidden)!
const routine = (t: Tender) => Object.assign(t, { kind: 'project', seats: { backend: 1 } })

describe('key and routine tenders', () => {
  it('routine tenders have no meeting and count an average one', () => {
    const s = newTestGame()
    const t = routine(firstOpen(s))
    expect(isKeyTender(t)).toBe(false)
    expect(
      applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: t.id, kind: 'meeting', score: 90 }).error,
    ).toBe('errors.noMeetingNeeded')
    expect(bidQualityParts(s, bid(), t)!.meeting).toBeCloseTo(0.15 * ROUTINE_MEETING_SCORE)
  })

  it('key tenders count the meeting, and nothing without one', () => {
    let s = newTestGame()
    const t = makeKeyTender(firstOpen(s))
    expect(bidQualityParts(s, bid(), t)!.meeting).toBe(0)
    s = applyAction(s, { type: 'recordMinigame', firmId: 'player', tenderId: t.id, kind: 'meeting', score: 80 }).state
    expect(
      bidQualityParts(
        s,
        bid(),
        s.tenders.find((x) => x.id === t.id)!,
      )!.meeting,
    ).toBeCloseTo(12)
  })

  it('a quick bid is valid and draws no randomness', () => {
    const s = newTestGame()
    const t = routine(firstOpen(s))
    const before = s.rng.s
    const offer = quickBid(s, 'player', t)
    customerNeeds(s, t, 'player')
    bidQualityParts(s, offer, t)
    expect(s.rng.s).toBe(before)
    expect(applyAction(s, { type: 'placeBid', tenderId: t.id, bid: offer }).error).toBeUndefined()
  })

  it('shows how the customer likes to be talked to only with a good relationship', () => {
    const s = newTestGame()
    const t = firstOpen(s)
    const style = s.customers[t.customerId].meetingPreference
    s.customers[t.customerId].relationships.player = 10
    expect(customerNeeds(s, t, 'player')).toContain('styleUnknown')
    s.customers[t.customerId].relationships.player = 80
    expect(customerNeeds(s, t, 'player')).toContain(style)
    expect(customerNeeds(s, t, 'player')).toContain(customerWants(t.customerId))
  })
})

describe('promises', () => {
  it('can only be made on key tenders', () => {
    const s = newTestGame()
    const t = routine(firstOpen(s))
    expect(applyAction(s, { type: 'placeBid', tenderId: t.id, bid: bid({ promise: 'fullTeam' }) }).error).toBe(
      'errors.promiseNotAllowed',
    )
    makeKeyTender(t)
    const r = applyAction(s, { type: 'placeBid', tenderId: t.id, bid: bid({ promise: 'fullTeam' }) })
    expect(r.error).toBeUndefined()
    expect(r.state.tenders.find((x) => x.id === t.id)!.bids[0].promise).toBe('fullTeam')
  })

  it('a full team lifts quality, more so when it is what the customer wants', () => {
    const s = newTestGame()
    const t = makeKeyTender(firstOpen(s))
    const base = bidQualityParts(s, bid(), t)!.promise
    const full = bidQualityParts(s, bid({ promise: 'fullTeam' }), t)!.promise
    const wantsFull = customerWants(t.customerId) === 'fullTeam'
    expect(full - base).toBe(PROMISE_FULL_TEAM_QUALITY + (wantsFull ? PROMISE_MATCH_QUALITY : 0))
  })

  it('a phased start softens the capacity penalty', () => {
    const s = newTestGame()
    const t = makeKeyTender(firstOpen(s))
    const none = bidQualityParts(s, bid(), t)!
    const phased = bidQualityParts(s, bid({ promise: 'phased' }), t)!
    expect(none.capacity).toBeLessThan(0)
    expect(phased.capacity).toBeGreaterThan(none.capacity)
  })

  const deliverFirstQuarter = (promise: PromiseId, backendPeople: number, rate = 1) => {
    const s = newTestGame()
    const firm = s.firms.player
    firm.pools.backend.count = backendPeople
    syncRosterToPools(s)
    const t = makeKeyTender(firstOpen(s))
    const c = createContract(s, t, bid({ promise, rateMultiplier: rate }), 1, 1)
    s.quarter = c.startQuarter
    const before = c.satisfaction
    const rateAtStart = c.rateMultiplier
    updateContracts(s, firm, staffFirm(s, firm))
    return { s, c, before, rateAtStart }
  }

  it('a kept full-team promise pleases the customer', () => {
    const { c, s } = deliverFirstQuarter('fullTeam', 30)
    expect(c.promiseKept).toBe(true)
    expect(c.satisfaction).toBeGreaterThan(70)
    expect(s.news.some((n) => n.key === 'news.promise.kept.fullTeam')).toBe(true)
  })

  it('a broken full-team promise hurts, and is only checked once', () => {
    const { c, s, before } = deliverFirstQuarter('fullTeam', 0)
    expect(c.promiseKept).toBe(false)
    expect(c.satisfaction).toBeLessThan(before - PROMISE_BROKEN_SATISFACTION + PROMISE_KEPT_SATISFACTION)
    expect(s.news.some((n) => n.key === 'news.promise.broken.fullTeam')).toBe(true)
    const after = c.satisfaction
    s.quarter++
    updateContracts(s, s.firms.player, staffFirm(s, s.firms.player))
    expect(s.news.filter((n) => n.key.startsWith('news.promise.')).length).toBe(1)
    expect(c.satisfaction).toBeGreaterThanOrEqual(after - 30)
  })

  it.each([1, 0.97, 1.39])('discovery bills a reduced first quarter, then the full rate (%s)', (rate) => {
    const { c, rateAtStart } = deliverFirstQuarter('discovery', 0, rate)
    expect(rateAtStart).toBeCloseTo(rate * DISCOVERY_RATE_SHARE)
    expect(c.rateMultiplier).toBe(rate)
    expect(c.promiseKept).toBe(true)
  })
})

describe('explaining the result', () => {
  /** The player against an identical rival firm, so only the rate differs. */
  function duel(playerRate: number, rivalRate: number) {
    const s = newTestGame()
    s.firms.player.pools.backend.count += 10
    syncRosterToPools(s)
    const rival = structuredClone(s.firms.player)
    Object.assign(rival, { id: 'rival', isPlayer: false, name: 'Rival AS' })
    s.firms.rival = rival
    s.firmOrder.push('rival')
    const t = routine(firstOpen(s))
    t.priceWeight = 0.8
    t.qualityWeight = 0.2
    t.dueQuarter = s.quarter
    s.customers[t.customerId].relationships.rival = s.customers[t.customerId].relationships.player
    t.bids = [bid({ rateMultiplier: playerRate }), bid({ firmId: 'rival', rateMultiplier: rivalRate })]
    expect(bidQuality(s, t.bids[0], t)).toBeGreaterThan(35)
    resolveDueTenders(s)
    return s.news.filter((n) => n.personal && n.key.startsWith('news.tender.player'))
  }

  it('names the price when that is what lost it', () => {
    const [news] = duel(1.4, 0.7)
    expect(news).toMatchObject({ key: 'news.tender.playerLost', params: { weak: 'price', firm: 'Rival AS' } })
  })

  it('names the price when that is what won it', () => {
    const [news] = duel(0.7, 1.4)
    expect(news).toMatchObject({ key: 'news.tender.playerWon', params: { strong: 'price' } })
  })

  it('says the player was alone when nobody else bid', () => {
    const s = newTestGame()
    s.firms.player.pools.backend.count += 10
    syncRosterToPools(s)
    const t = routine(firstOpen(s))
    t.dueQuarter = s.quarter
    t.bids = [bid()]
    resolveDueTenders(s)
    expect(s.news.find((n) => n.key === 'news.tender.playerWon')?.params.strong).toBe('alone')
  })
})
