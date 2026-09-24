import { KEY_TENDER_MIN_SEATS, MAX_LEVEL } from './constants'
import { createNewGame } from './newGame'
import { buildRoster } from './roster'
import type { GameState, Tender } from './types'

export const newTestGame = (seed = 42): GameState =>
  createNewGame({ seed, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })

/** A player firm with every level unlocked, for tests of features behind a level. */
export function veteranTestGame(seed = 42): GameState {
  const s = newTestGame(seed)
  s.firms.player.level = MAX_LEVEL
  return s
}

/** After a test has set the player's pool counts by hand: rebuild the roster to match them. */
export function syncRosterToPools(s: GameState): GameState {
  buildRoster(s, s.firms[s.playerId])
  return s
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v)
  }
  return o
}

/** Turns a tender into a key tender (meeting and promise), still small enough for a level 1 firm. */
export function makeKeyTender(t: Tender): Tender {
  t.kind = 'project'
  t.seats = { backend: KEY_TENDER_MIN_SEATS }
  return t
}
