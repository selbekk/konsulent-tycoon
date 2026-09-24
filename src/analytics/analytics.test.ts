// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createNewGame } from '../engine'
import type { Action, GameState } from '../engine'
import { deepFreeze } from '../engine/testUtils'
import { describeAction, quarterSummary, settleKey } from './gameEvents'

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  set_config: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('posthog-js', () => ({ default: ph }))

const game = (): GameState => createNewGame({ seed: 7, firmName: 'Hemmelig AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('analytics consent', () => {
  let analytics: typeof import('./index')
  beforeAll(async () => {
    localStorage.clear()
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    analytics = await import('./index')
  })
  afterAll(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('loads and sends nothing before the player says yes', async () => {
    analytics.initAnalytics()
    analytics.track('tab_viewed', { tab: 'staff' })
    analytics.trackSettled('k', 'budgets_set', { social: 3 })
    vi.runAllTimers()
    await vi.dynamicImportSettled()
    expect(ph.init).not.toHaveBeenCalled()
    expect(ph.capture).not.toHaveBeenCalled()
  })

  it('starts after consent and sends what happened while it loaded', async () => {
    analytics.grantConsent()
    analytics.track('tab_viewed', { tab: 'staff' })
    await vi.dynamicImportSettled()
    await flush()
    expect(localStorage.getItem('kt.consent')).toBe('granted')
    expect(ph.init).toHaveBeenCalledTimes(1)
    expect(ph.capture.mock.calls.map((c) => c[0])).toEqual(['analytics_consent_given', 'tab_viewed'])
  })

  it('sends a slider only once it settles', () => {
    ph.capture.mockClear()
    for (let v = 1; v <= 5; v++) analytics.trackSettled('budgets:social', 'budgets_set', { social: v })
    expect(ph.capture).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(ph.capture).toHaveBeenCalledTimes(1)
    expect(ph.capture).toHaveBeenCalledWith('budgets_set', { social: 5 })
  })

  it('tags events with the playthrough while one is set', () => {
    ph.capture.mockClear()
    analytics.setGameId('parti-1')
    analytics.track('tab_viewed', { tab: 'staff' })
    analytics.setGameId(null)
    analytics.track('tab_viewed', { tab: 'staff' })
    expect(ph.capture.mock.calls).toEqual([
      ['tab_viewed', { tab: 'staff', game_id: 'parti-1' }],
      ['tab_viewed', { tab: 'staff' }],
    ])
  })

  it('withdrawing stops tracking and clears what PostHog stored', () => {
    localStorage.setItem('ph_phc_test_posthog', '{}')
    analytics.denyConsent()
    expect(ph.opt_out_capturing).toHaveBeenCalled()
    expect(ph.reset).toHaveBeenCalled()
    expect(localStorage.getItem('ph_phc_test_posthog')).toBeNull()
    expect(localStorage.getItem('kt.consent')).toBe('denied')
    ph.capture.mockClear()
    analytics.track('tab_viewed', { tab: 'staff' })
    expect(ph.capture).not.toHaveBeenCalled()
  })

  it('saying yes again switches the loaded SDK back on', () => {
    analytics.grantConsent()
    expect(ph.opt_in_capturing).toHaveBeenCalled()
    expect(ph.capture).toHaveBeenCalledWith('analytics_consent_given', undefined)
  })
})

describe('game events', () => {
  it('describe actions without touching the state or its rng', () => {
    const s = deepFreeze(game())
    const tender = s.tenders.find((t) => !t.resolved && !t.hidden)!
    const { event, props } = describeAction(
      { type: 'placeBid', tenderId: tender.id, bid: { firmId: s.playerId, rateMultiplier: 1, starIds: [], effort: 1, cvPad: false, ghostCv: false } },
      s,
    )
    expect(event).toBe('bid_placed')
    expect(props).toMatchObject({ action: 'placeBid', customer: tender.customerId, quarter: 0, rebid: false })
  })

  it('never sends the firm name the player typed', () => {
    const s = game()
    const text = JSON.stringify([describeAction({ type: 'lobby', firmId: s.playerId }, s).props, quarterSummary(s, s, 0)])
    expect(text).not.toContain('Hemmelig')
  })

  it('tells a started minigame from a finished one', () => {
    const s = game()
    const base = { type: 'recordMinigame', firmId: s.playerId, tenderId: 'x', kind: 'bingo', score: 0 } as const
    expect(describeAction({ ...base, provisional: true }, s).event).toBe('minigame_started')
    expect(describeAction({ ...base, score: 80 }, s).event).toBe('minigame_finished')
  })

  it('only settles slider actions', () => {
    const s = game()
    const hire: Action = { type: 'orderHires', firmId: s.playerId, discipline: 'design', count: 2 }
    expect(settleKey(hire)).toBe('hires:design')
    expect(settleKey({ type: 'lobby', firmId: s.playerId })).toBeNull()
  })
})
