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

/** Options for a test game: a frontend founder called Test Testesen. */
export const testOptions = (seed = 42): NewGameOptions => ({
  seed,
  firmName: 'Test AS',
  ceoName: 'Test Testesen',
  founderDiscipline: 'frontend',
  difficulty: 'normal',
})

/** A new game as the player sees it once they have picked a co-founder (Magnus, backend, by default). */
export function newStartupGame(seed = 42, cofounder = 'magnus'): GameState {
  const s = createNewGame(testOptions(seed))
  const r = applyAction(s, { type: 'chooseCofounder', firmId: s.playerId, cofounder })
  if (r.error) throw new Error(r.error)
  return r.state
}

/**
 * Ends the startup phase and gives the player the start the game had before it: the two founders plus four
 * people at level 2.5, and a Kryptonitt contract for six quarters with a relationship of 45 to match. Most tests are about the game after the
 * co-working space and were written against that start. Mutates and returns `s`; call it before any actions.
 */
export function skipStartup(s: GameState): GameState {
  const me = s.firms[s.playerId]
  delete me.startup
  for (const d of ['frontend', 'backend', 'backend', 'frontend'] as const) {
    me.pools[d].count += 1
    me.pools[d].level = 2.5
    me.pools[d].morale = 72
  }
  buildRoster(s, me)
  const seats = { frontend: 2, backend: 2 }
  // First in the list, like the old start: AI backlogs are 'starter' contracts too, and tests look it up by that.
  s.contracts.unshift({
    id: 'c-starter',
    tenderId: 'starter',
    firmId: me.id,
    customerId: 'kryptonitt',
    kind: 'project',
    baseSeats: { ...seats },
    activeSeats: { ...seats },
    rateMultiplier: 1,
    share: 1,
    rank: 1,
    startQuarter: 0,
    endQuarter: 6,
    starIds: me.stars.map((x) => x.id),
    satisfaction: 70,
    outsourcedShare: 0,
    fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
    terminated: false,
  })
  for (const star of me.stars) star.assignedContractId = 'c-starter'
  s.customers.kryptonitt.relationships[me.id] = 45
  return s
}

/** The game after the startup phase, with the old start (see skipStartup). Most tests use this. */
export const newTestGame = (seed = 42): GameState => skipStartup(newStartupGame(seed))

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
