import { afterEach, describe, expect, it } from 'vitest'
import { applyAction } from './reducer'
import { SHADY_CATALOG, rollShadyDetection } from './shady'
import { veteranTestGame } from './testUtils'

const original = structuredClone(SHADY_CATALOG)
afterEach(() => Object.assign(SHADY_CATALOG, structuredClone(original)))

describe('shady business', () => {
  it('silent outsourcing adds heat and logs an ongoing entry', () => {
    const s = veteranTestGame()
    const c = s.contracts.find((x) => x.firmId === 'player')!
    const r = applyAction(s, {
      type: 'shady',
      firmId: 'player',
      actionId: 'silent_outsource',
      contractId: c.id,
      share: 0.5,
    })
    expect(r.error).toBeUndefined()
    const p = r.state.firms.player
    expect(p.heat).toBe(SHADY_CATALOG.silent_outsource.heat)
    expect(p.shadyLog).toHaveLength(1)
    expect(p.shadyLog[0].active).toBe(true)
    expect(r.state.contracts.find((x) => x.id === c.id)!.outsourcedShare).toBe(0.5)
  })

  it('detected outsourcing terminates the contract, fines and hurts reputation', () => {
    SHADY_CATALOG.silent_outsource.baseDetection = 1
    const s0 = veteranTestGame()
    const c = s0.contracts.find((x) => x.firmId === 'player')!
    const s = applyAction(s0, {
      type: 'shady',
      firmId: 'player',
      actionId: 'silent_outsource',
      contractId: c.id,
      share: 0.5,
    }).state
    const draft = structuredClone(s)
    rollShadyDetection(draft)
    const p = draft.firms.player
    expect(p.shadyLog[0].detected).toBe(true)
    expect(draft.contracts.find((x) => x.id === c.id)!.terminated).toBe(true)
    expect(p.cash).toBe(s.firms.player.cash - SHADY_CATALOG.silent_outsource.consequence.fine)
    expect(p.reputation).toBeLessThan(s.firms.player.reputation)
    expect(draft.news.some((n) => n.key === 'news.scandal.silent_outsource')).toBe(true)
  })

  it('undetected actions stay hidden', () => {
    SHADY_CATALOG.rumor.baseDetection = 0
    const s0 = veteranTestGame()
    const s = applyAction(s0, { type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: 'accentura' }).state
    expect(s.firms.accentura.reputation).toBeLessThan(s0.firms.accentura.reputation)
    const draft = structuredClone(s)
    draft.firms.player.heat = 0
    rollShadyDetection(draft)
    expect(draft.firms.player.shadyLog[0].detected).toBe(false)
  })

  it('cv padding requires an own bid and sets the flag', () => {
    const s = veteranTestGame()
    const t = s.tenders.find((x) => !x.resolved)!
    expect(applyAction(s, { type: 'shady', firmId: 'player', actionId: 'cv_pad', tenderId: t.id }).error).toBe(
      'errors.noBid',
    )
    const withBid = applyAction(s, {
      type: 'placeBid',
      tenderId: t.id,
      bid: { firmId: 'player', rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false },
    }).state
    const r = applyAction(withBid, { type: 'shady', firmId: 'player', actionId: 'cv_pad', tenderId: t.id })
    expect(r.state.tenders.find((x) => x.id === t.id)!.bids[0].cvPad).toBe(true)
  })

  it('AI poaching the player becomes an event for the player', () => {
    const s = veteranTestGame()
    const draft = structuredClone(s)
    const star = draft.starMarket[0]
    draft.firms.player.stars.push(star)
    const r = applyAction(draft, {
      type: 'shady',
      firmId: 'accentura',
      actionId: 'afterwork_poach',
      targetFirmId: 'player',
      starId: star.id,
    })
    expect(r.error).toBeUndefined()
    expect(r.state.pendingEvents.some((e) => e.eventId === 'poach_attempt')).toBe(true)
    expect(r.state.firms.player.stars.some((x) => x.id === star.id)).toBe(true)
    // Letting them go counts as a leaver (retention).
    const pe = r.state.pendingEvents.find((e) => e.eventId === 'poach_attempt')!
    const after = applyAction(r.state, { type: 'resolveEvent', pendingEventId: pe.id, choiceId: 'let_go' }).state
    expect(after.firms.player.stars.some((x) => x.id === star.id)).toBe(false)
    expect(after.firms.player.quarterLeavers).toBe(r.state.firms.player.quarterLeavers + 1)
  })

  it('founders cannot be poached', () => {
    const s = veteranTestGame()
    const founder = s.firms.player.stars[0]
    expect(
      applyAction(s, {
        type: 'shady',
        firmId: 'accentura',
        actionId: 'afterwork_poach',
        targetFirmId: 'player',
        starId: founder.id,
      }).error,
    ).toBe('errors.invalidStar')
  })
})
