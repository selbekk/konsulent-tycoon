import { describe, expect, it } from 'vitest'
import { ACQUIRE_PRICE_PER_HEAD } from './constants'
import { acquisitionBlock, acquisitionPrice } from './acquisitions'
import { headcount } from './economy'
import { applyAction } from './reducer'
import { deepFreeze, syncRosterToPools, veteranTestGame } from './testUtils'
import { endTurn } from './turn'
import { activeFirms } from './util'

const setup = () => {
  const s = veteranTestGame()
  const me = s.firms.player
  me.pools.backend.count += 60
  syncRosterToPools(s)
  me.cash = 500_000_000
  const target = activeFirms(s).filter((f) => !f.isPlayer).sort((a, b) => headcount(a) - headcount(b))[0]
  return { s, target }
}

describe('acquisitions', () => {
  it('prices at least the per-head floor and never counts the target cash', () => {
    const { target } = setup()
    const price = acquisitionPrice(target)
    expect(price).toBeGreaterThanOrEqual(headcount(target) * ACQUIRE_PRICE_PER_HEAD - 100_000)
    const rich = structuredClone(target)
    rich.cash += 100_000_000
    expect(acquisitionPrice(rich)).toBe(price)
  })

  it('needs level 5, cash and a target at most half your size', () => {
    const { s, target } = setup()
    expect(acquisitionBlock(s.firms.player, target)).toBeUndefined()
    const small = structuredClone(s.firms.player)
    small.level = 4
    expect(acquisitionBlock(small, target)).toBe('errors.levelTooLow')
    small.level = 5
    small.pools.backend.count = 0
    expect(acquisitionBlock(small, target)).toBe('errors.targetTooBig')
  })

  it('moves people, stars, contracts and relationships, but not cash, and the market goes on', () => {
    const { s, target } = setup()
    deepFreeze(s)
    const hcBefore = headcount(s.firms.player)
    const r = applyAction(s, { type: 'acquireFirm', firmId: 'player', targetFirmId: target.id })
    expect(r.error).toBeUndefined()
    const me = r.state.firms.player
    const gone = r.state.firms[target.id]
    expect(headcount(me)).toBe(hcBefore + headcount(target))
    expect(me.cash).toBe(s.firms.player.cash - acquisitionPrice(target))
    expect(gone).toMatchObject({ bankrupt: true, acquiredBy: 'player' })
    expect(headcount(gone)).toBe(0)
    expect(r.state.contracts.some((c) => c.firmId === target.id)).toBe(false)
    expect(r.state.tenders.every((t) => t.bids.every((b) => b.firmId !== target.id))).toBe(true)
    const next = endTurn(r.state)
    expect(next.news.some((n) => n.key === 'news.firm.bankrupt' && n.params.firm === target.name)).toBe(false)
  })
})
