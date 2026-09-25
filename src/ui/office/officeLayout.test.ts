import { describe, expect, it } from 'vitest'
import { newTestGame } from '../../engine/testUtils'
import { CALM, officeLayout, officeMood } from './officeLayout'

describe('officeLayout', () => {
  it('a small startup has one floor, a coffee machine and a desk per person', () => {
    const firm = newTestGame().firms.player
    const { floors, rooms, hiddenPeople } = officeLayout(firm)
    expect(floors).toHaveLength(1)
    expect(rooms).toEqual(['coffee'])
    const occupied = floors[0].tiles.filter((t) => t.kind === 'desk' && t.occupied).length
    expect(occupied).toBe(6)
    expect(hiddenPeople).toBe(0)
  })

  it('culture unlocks rooms and size unlocks floors', () => {
    const firm = structuredClone(newTestGame().firms.accentura)
    firm.fagmiljo = 80
    firm.sosialt = 80
    const { floors, rooms } = officeLayout(firm)
    expect(rooms).toEqual(expect.arrayContaining(['kitchen', 'sofa', 'fagrom', 'whiteboard', 'plant', 'pingpong']))
    expect(floors.length).toBeGreaterThanOrEqual(3)
  })

  it('each level adds a piece of the new office', () => {
    const firm = structuredClone(newTestGame().firms.player)
    firm.level = 3
    expect(officeLayout(firm).rooms).toEqual(['coffee', 'reception', 'window'])
  })

  it('decorates for the season, the party and the crisis', () => {
    const firm = newTestGame().firms.player
    const rooms = officeLayout(firm, { party: true, crisis: true, season: 'christmas', birthday: 'Kari' }).rooms
    expect(rooms).toEqual(expect.arrayContaining(['tree', 'champagne', 'siren', 'cake']))
    expect(officeLayout(firm, CALM).rooms).toEqual(['coffee'])
  })

  it('reads the mood from the game without touching the rng', () => {
    const game = newTestGame()
    const rng = game.rng.s
    expect(officeMood(game, game.firms.player).party).toBe(false)
    game.quarter = 3
    game.news.push({ id: 'n1', quarter: 2, key: 'news.tender.playerWon', params: {}, tone: 'good', personal: true, firmId: 'player' })
    const mood = officeMood(game, game.firms.player)
    expect(mood).toMatchObject({ party: true, season: 'christmas' })
    expect(game.rng.s).toBe(rng)
  })
})
