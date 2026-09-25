import { describe, expect, it } from 'vitest'
import {
  CANCEL_RELATION_HIT,
  CANCEL_REPUTATION_HIT,
  NURTURE_MAX_SATISFACTION,
  NURTURE_SATISFACTION,
  RENEGOTIATE_FAIL_SATISFACTION,
  RENEGOTIATE_RATE_GAIN,
  UPSELL_COOLDOWN,
} from './constants'
import { planHumanProxy } from './ai/humanProxy'
import {
  cancelFee,
  contractMoveBlock,
  nurtureCost,
  renegotiateChance,
  upsellChance,
  upsellRoom,
} from './contractActions'
import { applyAction } from './reducer'
import { endTurn } from './turn'
import { quarterTodos } from './todos'
import { deepFreeze, newTestGame, veteranTestGame } from './testUtils'
import type { Contract, GameState } from './types'

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'cx',
  tenderId: 't',
  firmId: 'player',
  customerId: 'navet',
  kind: 'project',
  baseSeats: { backend: 2 },
  activeSeats: { backend: 2 },
  rateMultiplier: 1,
  share: 1,
  rank: 1,
  startQuarter: 0,
  endQuarter: 8,
  starIds: [],
  satisfaction: 70,
  outsourcedShare: 0,
  fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
  terminated: false,
  ...over,
})

function withContract(over: Partial<Contract> = {}, veteran = true): GameState {
  const s = veteran ? veteranTestGame() : newTestGame()
  s.quarter = 2
  s.firms.player.cash = 20_000_000
  s.contracts.push(contract(over))
  return s
}

const base = { firmId: 'player', contractId: 'cx' }
const cx = (s: GameState) => s.contracts.find((c) => c.id === 'cx')!
const relation = (s: GameState) => s.customers.navet.relationships.player ?? 20

describe('contract actions', () => {
  it('renegotiate and upsell are locked below their level, care and cancel are not', () => {
    const s = withContract({}, false)
    s.firms.player.level = 1
    expect(applyAction(s, { type: 'renegotiateContract', ...base }).error).toBe('errors.levelTooLow')
    expect(applyAction(s, { type: 'upsellContract', ...base, discipline: 'backend', count: 1 }).error).toBe(
      'errors.levelTooLow',
    )
    expect(contractMoveBlock(s, s.firms.player, cx(s), 'cancel')).toBeUndefined()
    cx(s).satisfaction = 40
    expect(contractMoveBlock(s, s.firms.player, cx(s), 'nurture')).toBeUndefined()
  })

  it('never mutate their input and are deterministic', () => {
    const s = deepFreeze(withContract({ satisfaction: 60 }))
    const a = applyAction(s, { type: 'renegotiateContract', ...base })
    const b = applyAction(s, { type: 'renegotiateContract', ...base })
    expect(a.error).toBeUndefined()
    expect(a.state).toEqual(b.state)
    expect(applyAction(s, { type: 'nurtureContract', ...base }).error).toBe(undefined)
    expect(applyAction(s, { type: 'cancelContract', ...base }).error).toBe(undefined)
  })

  it('renegotiation: a very happy client says yes, once', () => {
    const s0 = withContract({ satisfaction: 100 })
    expect(renegotiateChance(s0, cx(s0))).toBe(1)
    const s = applyAction(s0, { type: 'renegotiateContract', ...base }).state
    expect(cx(s).renegotiated).toBe('won')
    expect(cx(s).rateMultiplier).toBeCloseTo(1 + RENEGOTIATE_RATE_GAIN)
    expect(applyAction(s, { type: 'renegotiateContract', ...base }).error).toBe('errors.alreadyDone')
  })

  it('renegotiation: a no is an outcome, not an error, so the penalty sticks', () => {
    const s0 = withContract({ satisfaction: 20 })
    expect(renegotiateChance(s0, cx(s0))).toBe(0)
    const r = applyAction(s0, { type: 'renegotiateContract', ...base })
    expect(r.error).toBeUndefined()
    expect(cx(r.state).renegotiated).toBe('lost')
    expect(cx(r.state).rateMultiplier).toBe(1)
    expect(cx(r.state).satisfaction).toBe(20 - RENEGOTIATE_FAIL_SATISFACTION)
    expect(relation(r.state)).toBeLessThan(relation(s0))
  })

  it('renegotiation waits until the client has seen a quarter of work', () => {
    const s = withContract({ startQuarter: 2, satisfaction: 100 })
    expect(applyAction(s, { type: 'renegotiateContract', ...base }).error).toBe('errors.contractNotStarted')
  })

  it('cancel: pays the fee, costs reputation and relationship, frees stars', () => {
    const s0 = withContract()
    const star = s0.firms.player.stars[0]
    star.assignedContractId = 'cx'
    cx(s0).starIds = [star.id]
    const fee = cancelFee(s0.firms.player, cx(s0))
    expect(fee).toBeGreaterThan(0)
    const s = applyAction(s0, { type: 'cancelContract', ...base }).state
    expect(s.firms.player.cash).toBe(s0.firms.player.cash - fee)
    expect(s.firms.player.reputation).toBe(Math.max(0, s0.firms.player.reputation - CANCEL_REPUTATION_HIT))
    expect(relation(s)).toBe(Math.max(0, relation(s0) - CANCEL_RELATION_HIT))
    expect(cx(s)).toMatchObject({ terminated: true, cancelled: true, starIds: [] })
    expect(s.firms.player.stars[0].assignedContractId).toBeUndefined()
    expect(applyAction(s, { type: 'cancelContract', ...base }).error).toBe('errors.invalidContract')
  })

  it('cancel needs the money (credit line included)', () => {
    const s = withContract({ activeSeats: { backend: 20 }, baseSeats: { backend: 20 } })
    s.firms.player.cash = -1_900_000
    expect(applyAction(s, { type: 'cancelContract', ...base }).error).toBe('errors.notEnoughCash')
  })

  it('upsell rejects a count that is not a whole number', () => {
    const s = withContract({ satisfaction: 100 })
    expect(applyAction(s, { type: 'upsellContract', ...base, discipline: 'frontend', count: NaN }).error).toBe(
      'errors.upsellTooBig',
    )
  })

  it('upsell: a yes adds seats that bill this quarter', () => {
    const s0 = withContract({ satisfaction: 100 })
    expect(upsellChance(cx(s0), 1)).toBe(1)
    const s = applyAction(s0, { type: 'upsellContract', ...base, discipline: 'frontend', count: 2 }).state
    expect(cx(s).activeSeats).toEqual({ backend: 2, frontend: 2 })
    expect(cx(s).baseSeats).toEqual({ backend: 2, frontend: 2 })
    expect(cx(s).upsell).toEqual({ quarter: 2, won: true, seats: 2 })
    // One try per cooldown, win or lose.
    expect(applyAction(s, { type: 'upsellContract', ...base, discipline: 'frontend', count: 1 }).error).toBe(
      'errors.contractCooldown',
    )
    s.quarter += UPSELL_COOLDOWN
    expect(contractMoveBlock(s, s.firms.player, cx(s), 'upsell')).toBeUndefined()
  })

  it('upsell: a no still uses the attempt', () => {
    const s0 = withContract({ satisfaction: 20 })
    const r = applyAction(s0, { type: 'upsellContract', ...base, discipline: 'backend', count: 1 })
    expect(r.error).toBeUndefined()
    expect(cx(r.state).activeSeats).toEqual({ backend: 2 })
    expect(cx(r.state).upsell?.won).toBe(false)
    expect(applyAction(r.state, { type: 'upsellContract', ...base, discipline: 'backend', count: 1 }).error).toBe(
      'errors.contractCooldown',
    )
  })

  it('upsell is refused on frameworks and above the level cap', () => {
    const fw = withContract({ kind: 'framework' })
    expect(applyAction(fw, { type: 'upsellContract', ...base, discipline: 'backend', count: 1 }).error).toBe(
      'errors.upsellFramework',
    )
    const s = withContract({}, false)
    s.firms.player.level = 3 // max 20 seats
    cx(s).activeSeats = { backend: 19 }
    expect(applyAction(s, { type: 'upsellContract', ...base, discipline: 'backend', count: 2 }).error).toBe(
      'errors.upsellTooBig',
    )
    expect(applyAction(s, { type: 'upsellContract', ...base, discipline: 'backend', count: 1 }).error).toBeUndefined()
  })

  it('care lifts satisfaction up to a cap, costs money and has a cooldown', () => {
    const s0 = withContract({ satisfaction: 70 })
    const cost = nurtureCost(s0.firms.player, cx(s0))
    const s = applyAction(s0, { type: 'nurtureContract', ...base }).state
    expect(cx(s).satisfaction).toBe(NURTURE_MAX_SATISFACTION)
    expect(s.firms.player.cash).toBe(s0.firms.player.cash - cost)
    expect(applyAction(s, { type: 'nurtureContract', ...base }).error).toBe('errors.contractCooldown')
    const low = applyAction(withContract({ satisfaction: 30 }), { type: 'nurtureContract', ...base }).state
    expect(cx(low).satisfaction).toBe(30 + NURTURE_SATISFACTION)
    expect(applyAction(withContract({ satisfaction: 80 }), { type: 'nurtureContract', ...base }).error).toBe(
      'errors.customerHappy',
    )
  })

  it('the to-do list flags a contract at risk until it has been cared for', () => {
    const s0 = withContract({ satisfaction: 30 })
    expect(quarterTodos(s0, 'player').find((t) => t.id === 'nurture')).toMatchObject({
      done: false,
      params: { count: 1 },
    })
    const s = applyAction(s0, { type: 'nurtureContract', ...base }).state
    expect(quarterTodos(s, 'player').find((t) => t.id === 'nurture')?.done).toBe(true)
    // Next quarter it is on cooldown: nothing to do, so no nagging.
    const next = endTurn(s)
    const item = quarterTodos(next, 'player').find((t) => t.id === 'nurture')
    expect(item === undefined || item.done).toBe(true)
  })

  it('UI helpers are pure: no input mutation, no rng draws', () => {
    const s = deepFreeze(withContract({ satisfaction: 30 }))
    const before = s.rng.s
    const c = cx(s)
    renegotiateChance(s, c)
    upsellChance(c, 2)
    cancelFee(s.firms.player, c)
    nurtureCost(s.firms.player, c)
    upsellRoom(s.firms.player, c)
    for (const move of ['renegotiate', 'cancel', 'upsell', 'nurture'] as const)
      contractMoveBlock(s, s.firms.player, c, move)
    quarterTodos(s, 'player')
    expect(s.rng.s).toBe(before)
  })

  it('the human proxy looks after a client at risk, even when money is tight', () => {
    const s = withContract({ satisfaction: 30 })
    s.firms.player.cash = 100_000
    expect(planHumanProxy(s)).toContainEqual({ type: 'nurtureContract', ...base })
  })
})
