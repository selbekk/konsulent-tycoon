// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { isKeyTender, loadFromSlot, replayRun } from '../engine'
import type { GameState, NewGameOptions } from '../engine'
import { planHumanProxy } from '../engine/ai/humanProxy'
import { planEventAnswers } from '../engine/ai/planner'
import { makeKeyTender } from '../engine/testUtils'
import { useGame } from './gameStore'

describe('gameStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useGame.getState().quit()
  })

  it('autosaves after every successful action', () => {
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const game = useGame.getState().game!
    const tender = makeKeyTender(game.tenders.find((t) => !t.resolved && !t.hidden)!)
    expect(
      useGame
        .getState()
        .dispatch({ type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'meeting', score: 12 }),
    ).toBeUndefined()
    const saved = loadFromSlot(localStorage, 'auto')!
    expect(saved.tenders.find((t) => t.id === tender.id)!.minigameResults.player.score).toBe(12)
  })

  it('end turn advances the quarter and opens the report', () => {
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().endTurn()
    expect(useGame.getState().game!.quarter).toBe(1)
    expect(useGame.getState().report).toBe(0)
    expect(loadFromSlot(localStorage, 'auto')!.quarter).toBe(1)
  })

  it('gives each new game its own analytics id and keeps it through quit and continue', () => {
    const opts: NewGameOptions = {
      seed: 5,
      firmName: 'Lagre AS',
      founderDisciplines: ['backend', 'frontend'],
      difficulty: 'normal',
    }
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
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const old = JSON.parse(localStorage.getItem('kt.save.auto')!)
    delete old.gameId
    localStorage.setItem('kt.save.auto', JSON.stringify(old))
    useGame.getState().quit()
    expect(useGame.getState().load()).toBe(true)
    expect(useGame.getState().game!.gameId).toBeTruthy()
  })

  it('deletes a save it cannot read and says so', () => {
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
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
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const game = useGame.getState().game!
    const tender = game.tenders.find((t) => !t.resolved && !t.hidden && t.bids.some((b) => b.firmId !== 'player'))
    const rival =
      tender?.bids.find((b) => b.firmId !== 'player')?.firmId ?? game.firmOrder.find((id) => id !== 'player')!
    expect(useGame.getState().dispatch({ type: 'orderHires', firmId: rival, discipline: 'backend', count: 3 })).toBe(
      'errors.invalid',
    )
    expect(
      useGame.getState().dispatch({
        type: 'placeBid',
        tenderId: game.tenders[0].id,
        bid: { firmId: rival, rateMultiplier: 1, starIds: [], effort: 0, cvPad: false, ghostCv: false },
      }),
    ).toBe('errors.invalid')
    expect(useGame.getState().game).toBe(game)
    expect(
      useGame.getState().dispatch({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: 3 }),
    ).toBeUndefined()
  })

  it('stops playing when another tab saves, until the autosave is loaded again', () => {
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Lagre AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    const other = JSON.parse(localStorage.getItem('kt.save.auto')!)
    other.firms.player.hiringOrders = { design: 2 }
    localStorage.setItem('kt.save.auto', JSON.stringify(other))
    window.dispatchEvent(new StorageEvent('storage', { key: 'kt.save.auto' }))
    expect(useGame.getState().stale).toBe(true)
    expect(useGame.getState().dispatch({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: 3 })).toBe(
      'errors.invalid',
    )
    useGame.getState().endTurn()
    expect(useGame.getState().game!.quarter).toBe(0)
    expect(useGame.getState().load()).toBe(true)
    expect(useGame.getState().stale).toBe(false)
    expect(useGame.getState().game!.firms.player.hiringOrders).toEqual({ design: 2 })
  })

  describe('action log', () => {
    const opts: NewGameOptions = {
      seed: 11,
      firmName: 'Logg AS',
      founderDisciplines: ['backend', 'cloud'],
      difficulty: 'normal',
    }
    /** The whole state as JSON, without the store's `gameId` (the engine never sees it). */
    const json = (s: object) => JSON.stringify(s, (k, v) => (k === 'gameId' ? undefined : v))

    it('logs what the player did, so replaying it ends in the same state', () => {
      useGame.getState().newGame(opts)
      for (let q = 0; q < 5; q++) {
        for (const plan of [(g: GameState) => planEventAnswers(g, g.playerId), (g: GameState) => planHumanProxy(g)]) {
          const game = useGame.getState().game!
          for (const a of plan(structuredClone(game))) useGame.getState().dispatch(a)
        }
        const game = useGame.getState().game!
        const tender = game.tenders.find((t) => !t.resolved && !t.hidden)
        if (tender) useGame.getState().dispatch({ type: 'withdrawBid', firmId: 'player', tenderId: tender.id })
        expect(
          useGame.getState().dispatch({ type: 'promoteEmployee', firmId: 'player', employeeId: 'nobody' }),
        ).toBeTruthy()
        useGame.getState().endTurn()
      }
      const { game, log } = useGame.getState()
      expect(log!.filter((x) => x === 'end')).toHaveLength(5)
      expect(log!.some((x) => x !== 'end' && x.type === 'promoteEmployee')).toBe(false)
      const replay = replayRun(opts, log!)
      expect(replay.error).toBeUndefined()
      expect(json(replay.state)).toBe(json(game!))
    })

    it('logs minigames, including the provisional attempt', () => {
      useGame.getState().newGame(opts)
      const open = () =>
        useGame
          .getState()
          .game!.tenders.find((t) => !t.resolved && !t.hidden && isKeyTender(t) && !t.minigameResults.player)
      while (!open() && useGame.getState().game!.quarter < 12) {
        const game = useGame.getState().game!
        for (const a of planHumanProxy(structuredClone(game))) useGame.getState().dispatch(a)
        useGame.getState().endTurn()
      }
      const tender = open()!
      expect(tender).toBeDefined()
      expect(
        useGame.getState().dispatch({
          type: 'recordMinigame',
          firmId: 'player',
          tenderId: tender.id,
          kind: 'meeting',
          score: 0,
          provisional: true,
        }),
      ).toBeUndefined()
      expect(
        useGame
          .getState()
          .dispatch({ type: 'recordMinigame', firmId: 'player', tenderId: tender.id, kind: 'meeting', score: 67 }),
      ).toBeUndefined()
      const { game, log } = useGame.getState()
      expect(log!.filter((x) => x !== 'end' && x.type === 'recordMinigame')).toHaveLength(2)
      const replay = replayRun(opts, log!)
      expect(replay.state.tenders.find((t) => t.id === tender.id)!.minigameResults.player.score).toBe(67)
      expect(json(replay.state)).toBe(json(game!))
    })

    it('comes back with the autosave, and only for the same game', () => {
      useGame.getState().newGame(opts)
      useGame.getState().dispatch({ type: 'orderHires', firmId: 'player', discipline: 'backend', count: 1 })
      useGame.getState().endTurn()
      const log = useGame.getState().log
      expect(log).toHaveLength(2)
      useGame.getState().quit()
      expect(useGame.getState().log).toBeNull()
      expect(useGame.getState().load()).toBe(true)
      expect(useGame.getState().log).toEqual(log)
      // A log from another game is ignored.
      const stored = JSON.parse(localStorage.getItem('kt.log.auto')!)
      localStorage.setItem('kt.log.auto', JSON.stringify({ ...stored, gameId: 'someone-else' }))
      useGame.getState().quit()
      useGame.getState().load()
      expect(useGame.getState().log).toBeNull()
    })

    it('an incomplete log is dropped rather than submitted', () => {
      useGame.getState().newGame(opts)
      useGame.getState().endTurn()
      useGame.getState().endTurn()
      const stored = JSON.parse(localStorage.getItem('kt.log.auto')!)
      localStorage.setItem('kt.log.auto', JSON.stringify({ ...stored, log: stored.log.slice(1) }))
      useGame.getState().quit()
      useGame.getState().load()
      expect(useGame.getState().log).toBeNull()
    })
  })
})
