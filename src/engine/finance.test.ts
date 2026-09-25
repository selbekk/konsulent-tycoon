import { describe, expect, it } from 'vitest'
import { creditLimit } from './economy'
import { financeOverview } from './finance'
import { deepFreeze, newTestGame } from './testUtils'
import { endTurn } from './turn'

describe('finance', () => {
  it('records end-of-quarter cash in the history', () => {
    let s = newTestGame()
    for (let i = 0; i < 3; i++) s = endTurn(s)
    for (const f of Object.values(s.firms).filter((x) => !x.bankrupt)) expect(f.history.at(-1)!.cash).toBe(f.cash)
  })

  it('splits the change in cash into result and other items', () => {
    let s = newTestGame()
    for (let i = 0; i < 3; i++) s = endTurn(s)
    const { ledger } = financeOverview(s, s.playerId)
    expect(ledger).toHaveLength(3)
    expect(ledger[0].other).toBeUndefined()
    for (let i = 1; i < ledger.length; i++) {
      expect(ledger[i].cash! - ledger[i - 1].cash!).toBeCloseTo(ledger[i].ebitda + ledger[i].other!)
      expect(ledger[i].valuation).toBe(s.firms.player.valuationHistory[ledger[i].quarter])
    }
  })

  it('counts runway down to the credit limit, only while burning', () => {
    const s = newTestGame()
    const p = s.firms.player
    s.contracts = s.contracts.filter((c) => c.firmId !== p.id)
    const burning = financeOverview(s, p.id)
    expect(burning.burn).toBeGreaterThan(0)
    expect(burning.runway).toBeCloseTo((p.cash + creditLimit(p)) / burning.burn)

    p.cash = -creditLimit(p) - 1
    expect(financeOverview(s, p.id).runway).toBe(0)
  })

  it('does not touch the input or the rng', () => {
    const s = deepFreeze(endTurn(newTestGame()))
    const rng = { ...s.rng }
    financeOverview(s, s.playerId)
    expect(s.rng).toEqual(rng)
  })
})
