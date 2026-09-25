import { describe, expect, it } from 'vitest'
import * as crises from '../content/crises'
import * as customers from '../content/customers'
import * as events from '../content/events'
import * as firms from '../content/firms'
import * as missions from '../content/missions'
import * as quirks from '../content/quirks'
import * as strategy from '../content/strategy'
import * as traits from '../content/traits'
import * as trends from '../content/trends'
import { endTurn } from '../engine'
import type { Action } from '../engine'
import { planAiTurn } from '../engine/ai/planner'
import { SHADY_CATALOG } from '../engine/shady'
import { botRun } from '../engine/testUtils'
import { STRING_MAX_CHARS, stepOk } from './submission'

/**
 * `parse` screens every step before the server replays it. These limits must never turn away a real game, so
 * every kind of action the app can send has to pass them. A new action type fails to compile here until it has
 * a sample below.
 */
const SEEN: Record<Action['type'], boolean> = {
  acquireFirm: false,
  cancelContract: false,
  careerTalk: false,
  chooseSpecialty: false,
  fire: false,
  giveRaise: false,
  hireStar: false,
  ipo: false,
  lobby: false,
  nurtureContract: false,
  orderHires: false,
  placeBid: false,
  promoteEmployee: false,
  recordMinigame: false,
  renegotiateContract: false,
  resolveCrisis: false,
  resolveEvent: false,
  setBudgets: false,
  setDepartment: false,
  setMentor: false,
  setPartnership: false,
  setStretch: false,
  shady: false,
  startCrisisTalk: false,
  trainEmployee: false,
  upsellContract: false,
  withdrawBid: false,
}

describe('submission limits and real games', () => {
  it('let through every kind of step the app sends', () => {
    const steps: Action[] = []
    for (const seed of [1, 2]) {
      // The player bot, then the AI firms, which use the backroom and the rest of the vocabulary.
      const { state, log } = botRun(
        { seed, firmName: 'X', founderDisciplines: ['backend', 'pm'], difficulty: 'normal' },
        16,
      )
      steps.push(...log.filter((e): e is Action => e !== 'end'))
      let s = state
      for (let q = 0; q < 8 && s.status === 'playing'; q++) {
        for (const id of s.firmOrder) steps.push(...planAiTurn(structuredClone(s), id))
        s = endTurn(s)
      }
    }
    // The ones neither bot sends, with the longest ids they can carry.
    const rival = 'x'.repeat(24)
    const longest = (ids: string[]) => ids.reduce((a, b) => (b.length > a.length ? b : a), '')
    steps.push(
      { type: 'acquireFirm', firmId: 'player', targetFirmId: longest(firms.FIRMS.map((f) => f.id)) || rival },
      { type: 'cancelContract', firmId: 'player', contractId: 'c123456' },
      { type: 'nurtureContract', firmId: 'player', contractId: 'c123456' },
      { type: 'withdrawBid', firmId: 'player', tenderId: 't123456' },
      { type: 'chooseSpecialty', firmId: 'player', specialty: 'public' },
      {
        type: 'setPartnership',
        firmId: 'player',
        partnershipId: longest(strategy.PARTNERSHIPS.map((p) => p.id)),
        on: true,
      },
      {
        type: 'setDepartment',
        firmId: 'player',
        departmentId: longest(strategy.DEPARTMENTS.map((d) => d.id)),
        on: false,
      },
      { type: 'lobby', firmId: 'player' },
      { type: 'ipo', firmId: 'player' },
    )
    for (const step of steps) {
      SEEN[step.type] = true
      expect(stepOk(JSON.parse(JSON.stringify(step))), JSON.stringify(step)).toBe(true)
    }
    expect(
      Object.entries(SEEN)
        .filter(([, seen]) => !seen)
        .map(([type]) => type),
    ).toEqual([])
  }, 120_000)

  it('leave room for every content id an action can carry', () => {
    const ids: string[] = Object.keys(SHADY_CATALOG)
    const walk = (x: unknown, depth = 0) => {
      if (depth > 8 || !x || typeof x !== 'object') return
      if (Array.isArray(x)) return x.forEach((v) => walk(v, depth + 1))
      for (const [k, v] of Object.entries(x)) {
        if (k === 'id' && typeof v === 'string') ids.push(v)
        walk(v, depth + 1)
      }
    }
    for (const mod of [crises, customers, events, firms, missions, quirks, strategy, traits, trends])
      walk(Object.values(mod))
    expect(ids.length).toBeGreaterThan(50)
    for (const id of ids) {
      expect(id.length, id).toBeLessThanOrEqual(STRING_MAX_CHARS)
      expect(id in Object.prototype, id).toBe(false)
    }
  })
})
