import { planCrisisAnswers } from './ai/crises'
import { planHumanProxy } from './ai/humanProxy'
import { planEventAnswers } from './ai/planner'
import { HUMAN_CRISIS_STYLE, KEY_TENDER_MIN_SEATS, MAX_LEVEL } from './constants'
import { createNewGame } from './newGame'
import type { NewGameOptions } from './newGame'
import { applyAction } from './reducer'
import type { RunLog } from './replay'
import { buildRoster } from './roster'
import { endTurn } from './turn'
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

/**
 * Plays a game with the "sensible human" bot the way the store would log it: each planner works on a copy,
 * because the bot may draw from state.rng while planning, and only the actions that succeed are applied and logged.
 */
export function botRun(opts: NewGameOptions, quarters = Infinity): { state: GameState; log: RunLog } {
  let state = createNewGame(opts)
  const log: RunLog = []
  while (state.status === 'playing' && state.quarter < quarters) {
    let draft = state
    const planners = [
      (s: GameState) => planEventAnswers(s, s.playerId),
      (s: GameState) => planCrisisAnswers(s, s.playerId, HUMAN_CRISIS_STYLE),
      (s: GameState) => planHumanProxy(s),
    ]
    for (const plan of planners) {
      for (const a of plan(structuredClone(draft))) {
        // Like the store: a failed action may have half-changed its draft, so it's thrown away with it.
        const r = applyAction(draft, a)
        if (r.error) continue
        draft = r.state
        log.push(a)
      }
    }
    log.push('end')
    state = endTurn(draft)
  }
  return { state, log }
}
