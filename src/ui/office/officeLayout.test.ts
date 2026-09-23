import { describe, expect, it } from 'vitest'
import { newTestGame } from '../../engine/testUtils'
import { officeLayout } from './officeLayout'

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
})
