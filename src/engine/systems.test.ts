import { describe, expect, it } from 'vitest'
import { yearEndAwards } from './awards'
import { cultureEquilibrium, nextCultureLevel } from './culture'
import { employeeThoughts } from './flavor'
import { applyAction } from './reducer'
import { endTitle, rankings, valuation } from './score'
import { moraleTarget, turnoverChance } from './staff'
import { newTestGame } from './testUtils'
import { endTurn } from './turn'

describe('culture', () => {
  it('converges to the equilibrium', () => {
    let lvl = 0
    for (let i = 0; i < 60; i++) lvl = nextCultureLevel(lvl, 20_000)
    expect(lvl).toBeCloseTo(cultureEquilibrium(20_000), 1)
    expect(cultureEquilibrium(20_000)).toBeCloseTo(66.7, 0)
    expect(nextCultureLevel(100, 40_000)).toBe(100)
  })
})

describe('staff', () => {
  it('burnout lowers the morale target', () => {
    const f = newTestGame().firms.player
    expect(moraleTarget(f, 0.99)).toBeLessThan(moraleTarget(f, 0.85))
    expect(moraleTarget(f, 0.3)).toBeLessThan(moraleTarget(f, 0.85))
  })

  it('unhappy people leave more often', () => {
    expect(turnoverChance(20)).toBeGreaterThan(turnoverChance(80))
  })

  it('hires arrive the quarter after ordering', () => {
    let s = newTestGame()
    s = applyAction(s, { type: 'orderHires', firmId: 'player', discipline: 'data', count: 10 }).state
    expect(s.firms.player.pools.data.count).toBe(0)
    s = endTurn(s)
    expect(s.firms.player.pools.data.count).toBeGreaterThan(0)
    expect(s.firms.player.hiringOrders).toEqual({})
    expect(s.firms.player.pendingHires).toEqual({})
    expect(s.firms.player.history.at(-1)!.hires).toBe(s.firms.player.pools.data.count)
  })

  it('hires still pending from an older save arrive at the next quarter change', () => {
    let s = newTestGame()
    s.firms.player.pendingHires = { data: 3 }
    s = endTurn(s)
    expect(s.firms.player.pools.data.count).toBe(3)
    expect(s.firms.player.pendingHires).toEqual({})
  })
})

describe('score & flavour', () => {
  it('valuation is zero for bankrupt firms and rankings are sorted', () => {
    const s = newTestGame()
    const f = structuredClone(s.firms.player)
    f.bankrupt = true
    expect(valuation(f)).toBe(0)
    const r = rankings(s)
    for (let i = 1; i < r.length; i++) expect(r[i - 1].value).toBeGreaterThanOrEqual(r[i].value)
  })

  it('picks an end title', () => {
    const s = newTestGame()
    s.firms.player.bankrupt = true
    expect(endTitle(s)).toBe('bankrupt')
  })

  it('hands out awards at year end', () => {
    let s = newTestGame()
    for (let i = 0; i < 4; i++) s = endTurn(s)
    expect(s.lastAwards.length).toBeGreaterThan(0)
    const again = structuredClone(s)
    expect(yearEndAwards(again).map((a) => a.awardId)).toContain('best_fagmiljo')
  })

  it('employee thoughts are deterministic and non-empty', () => {
    const s = newTestGame()
    const before = s.rng.s
    const a = employeeThoughts(s, 'player')
    expect(a.length).toBeGreaterThan(0)
    expect(employeeThoughts(s, 'player')).toEqual(a)
    expect(s.rng.s).toBe(before)
  })

  it('employee thoughts fill a thin feed and vary between quarters', () => {
    const s = newTestGame()
    const feeds = new Set<string>()
    for (let q = 0; q < 8; q++) {
      const thoughts = employeeThoughts({ ...s, quarter: q }, 'player')
      expect(thoughts.length).toBeGreaterThanOrEqual(3)
      expect(new Set(thoughts.map((t) => t.key)).size).toBe(thoughts.length)
      feeds.add(thoughts.map((t) => t.key).join())
    }
    expect(feeds.size).toBeGreaterThan(1)
  })
})
