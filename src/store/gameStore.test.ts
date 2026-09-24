// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { loadFromSlot } from '../engine'
import type { NewGameOptions } from '../engine'
import { makeKeyTender } from '../engine/testUtils'
import { useGame } from './gameStore'

describe('gameStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useGame.getState().quit()
  })

  it('autosaves after every successful action', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const game = useGame.getState().game!
    const tender = makeKeyTender(game.tenders.find((t) => !t.resolved && !t.hidden)!)
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

  it('gives each new game its own analytics id and keeps it through quit and continue', () => {
    const opts: NewGameOptions = { seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' }
    useGame.getState().newGame(opts)
    const first = useGame.getState().game!.gameId
    expect(first).toBeTruthy()
    useGame.getState().quit()
    expect(useGame.getState().load()).toBe(true)
    expect(useGame.getState().game!.gameId).toBe(first)
    useGame.getState().newGame(opts)
    expect(useGame.getState().game!.gameId).not.toBe(first)
  })

  it('gives an old save without an analytics id one on load', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const old = JSON.parse(localStorage.getItem('kt.save.auto')!)
    delete old.gameId
    localStorage.setItem('kt.save.auto', JSON.stringify(old))
    useGame.getState().quit()
    expect(useGame.getState().load()).toBe(true)
    expect(useGame.getState().game!.gameId).toBeTruthy()
  })

  it('deletes a save it cannot read and says so', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const broken = JSON.parse(localStorage.getItem('kt.save.auto')!)
    delete broken.firms.player.budgets
    localStorage.setItem('kt.save.auto', JSON.stringify(broken))
    useGame.getState().quit()
    expect(useGame.getState().load()).toBe(false)
    expect(useGame.getState().droppedSaves).toEqual(['auto'])
    expect(localStorage.getItem('kt.meta.auto')).toBeNull()
    useGame.getState().dismissDroppedSaves()
    expect(useGame.getState().droppedSaves).toEqual([])
  })

  it('only lets the player act for their own firm', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const game = useGame.getState().game!
    const tender = game.tenders.find((t) => !t.resolved && !t.hidden && t.bids.some((b) => b.firmId !== 'player'))
    const rival = tender?.bids.find((b) => b.firmId !== 'player')?.firmId ?? game.firmOrder.find((id) => id !== 'player')!
    expect(useGame.getState().dispatch({ type: 'orderHires', firmId: rival, discipline: 'backend', count: 3 })).toBe('errors.invalid')
    expect(useGame.getState().dispatch({ type: 'placeBid', tenderId: game.tenders[0].id, bid: { firmId: rival, rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false } })).toBe('errors.invalid')
    expect(useGame.getState().game).toBe(game)
    expect(useGame.getState().dispatch({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: 3 })).toBeUndefined()
  })

  it('stops playing when another tab saves, until the autosave is loaded again', () => {
    useGame.getState().newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const other = JSON.parse(localStorage.getItem('kt.save.auto')!)
    other.firms.player.hiringOrders = { design: 2 }
    localStorage.setItem('kt.save.auto', JSON.stringify(other))
    window.dispatchEvent(new StorageEvent('storage', { key: 'kt.save.auto' }))
    expect(useGame.getState().stale).toBe(true)
    expect(useGame.getState().dispatch({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: 3 })).toBe('errors.invalid')
    useGame.getState().endTurn()
    expect(useGame.getState().game!.quarter).toBe(0)
    expect(useGame.getState().load()).toBe(true)
    expect(useGame.getState().stale).toBe(false)
    expect(useGame.getState().game!.firms.player.hiringOrders).toEqual({ design: 2 })
  })
})
