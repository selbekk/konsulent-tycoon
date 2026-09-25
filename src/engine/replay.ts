import { createNewGame } from './newGame'
import type { NewGameOptions } from './newGame'
import { applyActionInPlace } from './reducer'
import { endTurn } from './turn'
import type { Action, GameState } from './types'

/** One step of a playthrough: an action the player made, or `'end'` for ending the quarter. */
export type RunEntry = Action | 'end'
/** Every successful step of a playthrough, in order. The store records it; the leaderboard replays it. */
export type RunLog = RunEntry[]

/**
 * The firm an action acts for. The engine lets any firm act (the AI uses the same actions), so the store and
 * the replay are where the player is held to their own firm.
 */
export function actingFirm(game: GameState, action: Action): string | undefined {
  switch (action.type) {
    case 'placeBid':
      return action.bid.firmId
    case 'resolveEvent':
      return game.pendingEvents.find((e) => e.id === action.pendingEventId)?.firmId
    default:
      return action.firmId
  }
}

export interface ReplayResult {
  state: GameState
  /** The first step that failed. A log from the store never has one, so this means a bug or a tampered log. */
  error?: { index: number; key: string }
}

/**
 * Plays a logged game again from its options. The engine is deterministic, so this ends in the same state
 * the player saw (apart from the store's `gameId`). Stops at the first step that fails, including any action
 * for a firm other than the player's, which the store would never have let through.
 */
export function replayRun(opts: NewGameOptions, log: RunLog): ReplayResult {
  let state = createNewGame(opts)
  for (let i = 0; i < log.length; i++) {
    const step = log[i]
    if (step === 'end') {
      if (state.status !== 'playing') return { state, error: { index: i, key: 'errors.gameOver' } }
      state = endTurn(state)
      continue
    }
    if (actingFirm(state, step) !== state.playerId) return { state, error: { index: i, key: 'errors.invalid' } }
    const key = applyActionInPlace(state, step)
    if (key) return { state, error: { index: i, key } }
  }
  return { state }
}
