// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadFromSlot } from '../engine'
import { useGame } from './gameStore'

describe('gameStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useGame.getState().quit()
  })

  it('autosaves after every successful action', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const game = useGame.getState().game!
    const tender = game.tenders.find((t) => !t.resolved)!
    expect(useGame.getState().dispatch({ type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'meeting', score: 12 })).toBeUndefined()
    const saved = loadFromSlot(localStorage, 'auto')!
    expect(saved.tenders.find((t) => t.id === tender.id)!.minigameResults.player.score).toBe(12)
  })

  it('end turn advances the quarter and opens the report', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().endTurn()
    expect(useGame.getState().game!.quarter).toBe(1)
    expect(useGame.getState().report).toBe(0)
    expect(loadFromSlot(localStorage, 'auto')!.quarter).toBe(1)
  })

  it('deletes a save it cannot read and says so', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const broken = JSON.parse(localStorage.getItem('kt.save.auto')!)
    delete broken.firms.player.budgets
    localStorage.setItem('kt.save.auto', JSON.stringify(broken))
    useGame.getState().quit()
    expect(useGame.getState().load('auto')).toBe(false)
    expect(useGame.getState().droppedSaves).toEqual(['auto'])
    expect(localStorage.getItem('kt.meta.auto')).toBeNull()
    useGame.getState().dismissDroppedSaves()
    expect(useGame.getState().droppedSaves).toEqual([])
  })
})
