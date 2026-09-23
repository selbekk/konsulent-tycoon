import { describe, expect, it } from 'vitest'
import { applyAction } from './reducer'
import { deserialize, serialize } from './save'
import { deepFreeze, newTestGame } from './testUtils'
import { endTurn } from './turn'

describe('endTurn', () => {
  it('advances the quarter without mutating the input', () => {
    const s = deepFreeze(newTestGame())
    const next = endTurn(s)
    expect(next.quarter).toBe(1)
    expect(s.quarter).toBe(0)
  })

  it('is deterministic', () => {
    let a = newTestGame(3)
    let b = newTestGame(3)
    for (let i = 0; i < 6; i++) {
      a = endTurn(a)
      b = endTurn(b)
    }
    expect(a).toEqual(b)
  })

  it('continues identically after a save/load round-trip', () => {
    let s = newTestGame(9)
    for (let i = 0; i < 3; i++) s = endTurn(s)
    const loaded = deserialize(serialize(s))
    expect(endTurn(loaded)).toEqual(endTurn(s))
  })

  it('resolves tenders and creates contracts', () => {
    let s = newTestGame(5)
    s = endTurn(endTurn(s))
    const resolved = s.tenders.filter((t) => t.resolved && t.winnerIds.length)
    expect(resolved.length).toBeGreaterThan(0)
    expect(s.contracts.some((c) => c.tenderId === resolved[0].id)).toBe(true)
  })

  it('only bankrupts after two quarters beyond the credit line', () => {
    let s = newTestGame(11)
    s = structuredClone(s)
    s.firms.player.cash = -1_000_000 // inside the credit line
    s = endTurn(s)
    expect(s.firms.player.bankrupt).toBe(false)
    s = structuredClone(s)
    s.firms.player.cash = -50_000_000
    s = endTurn(s)
    expect(s.firms.player.bankrupt).toBe(false)
    expect(s.firms.player.negativeCashQuarters).toBe(1)
    s = endTurn(s)
    expect(s.firms.player.bankrupt).toBe(true)
    expect(s.status).toBe('lost')
    expect(applyAction(s, { type: 'orderHires', firmId: 'player', discipline: 'backend', count: 1 }).error).toBe(
      'errors.gameOver',
    )
  })

  it('finishes after the last quarter', () => {
    let s = newTestGame(2)
    s = { ...s, quarter: s.maxQuarters - 1, firms: { ...s.firms, player: { ...s.firms.player, cash: 1e9 } } }
    s = endTurn(s)
    expect(s.status).toBe('finished')
  })
})
