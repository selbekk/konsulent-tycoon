import { describe, expect, it } from 'vitest'
import { LOBBY_COST, LOBBY_RELATION, MAX_PARTNERSHIPS, PARTNER_BONUS, SPECIALTY_CHANGE_COST, SPECIALTY_DISCIPLINE_BONUS, SPECIALTY_SECTOR_BONUS } from './constants'
import { quarterFinancials } from './economy'
import { applyAction } from './reducer'
import { strategyBonus } from './strategy'
import { bidQuality } from './tenders'
import { deepFreeze, newTestGame, veteranTestGame } from './testUtils'
import type { Bid, GameState, Tender } from './types'

const bid: Bid = { firmId: 'player', rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false }
const tender = (s: GameState, patch: Partial<Tender>) => Object.assign(s.tenders.find((t) => !t.resolved && !t.hidden)!, patch)

describe('strategy', () => {
  it('is locked below its level', () => {
    const s = newTestGame()
    expect(applyAction(s, { type: 'chooseSpecialty', firmId: 'player', specialty: 'public' }).error).toBe('errors.levelTooLow')
    s.firms.player.level = 3
    expect(applyAction(s, { type: 'setPartnership', firmId: 'player', partnershipId: 'hyperscaler', on: true }).error).toBe('errors.levelTooLow')
  })

  it('a specialty is free the first time, costs to change, and helps matching tenders', () => {
    const s0 = deepFreeze(veteranTestGame())
    const s = applyAction(s0, { type: 'chooseSpecialty', firmId: 'player', specialty: 'public' }).state
    expect(s.firms.player.cash).toBe(s0.firms.player.cash)
    const pub = tender(structuredClone(s), { customerId: 'navet', seats: { backend: 2 } })
    expect(strategyBonus(s, s.firms.player, pub)).toBe(SPECIALTY_SECTOR_BONUS)
    const changed = applyAction(s, { type: 'chooseSpecialty', firmId: 'player', specialty: 'backend' }).state
    expect(changed.firms.player.cash).toBe(s.firms.player.cash - SPECIALTY_CHANGE_COST)
    expect(strategyBonus(changed, changed.firms.player, pub)).toBe(SPECIALTY_DISCIPLINE_BONUS)
  })

  it('partnerships add a bonus and a fee, up to a limit', () => {
    let s = veteranTestGame()
    const t = tender(s, { seats: { cloud: 1, backend: 3 } })
    const before = { q: bidQuality(s, bid, t), cost: quarterFinancials(s, 'player').total }
    s = applyAction(s, { type: 'setPartnership', firmId: 'player', partnershipId: 'hyperscaler', on: true }).state
    const t2 = s.tenders.find((x) => x.id === t.id)!
    expect(bidQuality(s, bid, t2)).toBeCloseTo(Math.min(100, before.q + PARTNER_BONUS))
    expect(quarterFinancials(s, 'player').total).toBe(before.cost + 150_000)
    for (const id of ['ai_lab', 'design_guild'].slice(0, MAX_PARTNERSHIPS - 1)) {
      s = applyAction(s, { type: 'setPartnership', firmId: 'player', partnershipId: id, on: true }).state
    }
    expect(applyAction(s, { type: 'setPartnership', firmId: 'player', partnershipId: 'agile_institute', on: true }).error).toBe('errors.tooManyPartners')
  })

  it('lobbying lifts every public relationship and has a cooldown', () => {
    const s0 = veteranTestGame()
    const r = applyAction(s0, { type: 'lobby', firmId: 'player' })
    expect(r.error).toBeUndefined()
    expect(r.state.firms.player.cash).toBe(s0.firms.player.cash - LOBBY_COST)
    expect(r.state.customers.navet.relationships.player).toBe(s0.customers.navet.relationships.player + LOBBY_RELATION)
    expect(r.state.customers.kryptonitt.relationships.player).toBe(s0.customers.kryptonitt.relationships.player)
    expect(applyAction(r.state, { type: 'lobby', firmId: 'player' }).error).toBe('errors.alreadyDone')
  })
})
