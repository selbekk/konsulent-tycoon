import { describe, expect, it } from 'vitest'
import { FIRMS } from '../content/firms'
import { headcount, quarterFinancials } from './economy'
import { newTestGame } from './testUtils'

describe('createNewGame', () => {
  it('is deterministic for a seed', () => {
    expect(newTestGame(7)).toEqual(newTestGame(7))
    expect(newTestGame(7)).not.toEqual(newTestGame(8))
  })

  it('is plain serializable data', () => {
    const s = newTestGame()
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('creates the player plus 24 rivals', () => {
    const s = newTestGame()
    expect(s.firmOrder).toHaveLength(FIRMS.length + 1)
    expect(FIRMS).toHaveLength(24)
    expect(s.firms.player.isPlayer).toBe(true)
    expect(
      Object.values(s.firms)
        .filter((f) => !f.isPlayer)
        .every((f) => f.personalityId),
    ).toBe(true)
  })

  it('gives the player founders, a small pool and cash', () => {
    const p = newTestGame().firms.player
    expect(p.cash).toBe(3_000_000)
    expect(p.stars.filter((s) => s.founder)).toHaveLength(2)
    expect(headcount(p)).toBe(6)
  })

  it('gives everyone work at the start', () => {
    const s = newTestGame()
    expect(quarterFinancials(s, 'player').utilization).toBeGreaterThan(0)
    for (const id of s.firmOrder.filter((x) => x !== 'player')) {
      const u = quarterFinancials(s, id).utilization
      expect(u, id).toBeGreaterThanOrEqual(0.6)
      expect(u, id).toBeLessThanOrEqual(0.85)
    }
  })

  it('publishes tenders due next quarter', () => {
    const s = newTestGame()
    const open = s.tenders.filter((t) => !t.resolved)
    expect(open.length).toBeGreaterThanOrEqual(4)
    expect(open.every((t) => t.dueQuarter === 1)).toBe(true)
  })
})
