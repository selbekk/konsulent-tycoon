import { skipStartup, testOptions } from '../engine/testUtils'
import type { NewGameOptions } from '../engine'
import { useGame } from './gameStore'

/** Starts a game through the store, as the menu does, and picks Magnus as co-founder (unless `cofounder` is null). */
export function newStoreGame(opts: Partial<NewGameOptions> = {}, cofounder: string | null = 'magnus') {
  useGame.getState().newGame({ ...testOptions(), ...opts })
  if (cofounder) useGame.getState().dispatch({ type: 'chooseCofounder', firmId: 'player', cofounder })
}

/**
 * Like newStoreGame, then skips the co-working space (see skipStartup in engine/testUtils) for tests of the
 * tabs and the rest of the game. The action log no longer matches the game, so it is dropped.
 */
export function newStoreGameAfterStartup(opts: Partial<NewGameOptions> = {}) {
  newStoreGame(opts)
  useGame.setState({ game: skipStartup(structuredClone(useGame.getState().game!)), log: null })
}
