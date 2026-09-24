import { describe, expect, it } from 'vitest'
import { planHumanProxy } from './ai/humanProxy'
import { planCrisisAnswers } from './ai/crises'
import { planEventAnswers } from './ai/planner'
import { applyActionInPlace } from './reducer'
import { hasValidShape } from './saveShape'
import { newTestGame, veteranTestGame } from './testUtils'
import { endTurn } from './turn'
import type { GameState } from './types'

/** A false negative here deletes a real player's save, so check states from whole games, not just quarter 0. */
function playThrough(start: GameState, check: (s: GameState) => void) {
  let s = start
  while (s.status === 'playing') {
    const draft = structuredClone(s)
    for (const a of planEventAnswers(draft, draft.playerId)) applyActionInPlace(draft, a)
    for (const a of planCrisisAnswers(draft, draft.playerId)) applyActionInPlace(draft, a)
    for (const a of planHumanProxy(draft, { strategic: true })) applyActionInPlace(draft, a)
    s = endTurn(draft)
    check(JSON.parse(JSON.stringify(s)))
  }
}

describe('hasValidShape', () => {
  it('accepts every state from full games', () => {
    for (const start of [newTestGame(1), newTestGame(7), veteranTestGame(42)]) {
      expect(hasValidShape(JSON.parse(JSON.stringify(start)))).toBe(true)
      let quarters = 0
      playThrough(start, (s) => {
        quarters++
        expect(hasValidShape(s), `quarter ${s.quarter}`).toBe(true)
      })
      expect(quarters).toBeGreaterThan(0)
    }
  }, 60_000)

  it('rejects states missing required fields', () => {
    const cases: ((s: Record<string, any>) => void)[] = [
      (s) => delete s.idCounter,
      (s) => delete s.rng.s,
      (s) => delete s.firms.player.budgets,
      (s) => delete s.firms.player.pools.cloud,
      (s) => delete s.firms.player.pools.data.morale,
      (s) => delete s.firms.player.stars[0].ambition,
      (s) => delete s.customers[Object.keys(s.customers)[0]].relationships,
      (s) => delete s.tenders[0].bids,
      (s) => delete s.contracts[0].fraud,
      (s) => (s.playerId = 'nobody'),
      (s) => s.firmOrder.push('ghost'),
      (s) => (s.news = {}),
    ]
    for (const [i, breakIt] of cases.entries()) {
      const s = JSON.parse(JSON.stringify(newTestGame()))
      breakIt(s)
      expect(hasValidShape(s), `case ${i}`).toBe(false)
    }
    expect(hasValidShape(null)).toBe(false)
  })

  it('accepts missing optional fields', () => {
    const s = JSON.parse(JSON.stringify(newTestGame()))
    delete s.baseDemand
    delete s.firms.player.level
    delete s.firms.player.stars[0].founder
    expect(hasValidShape(s)).toBe(true)
  })
})
