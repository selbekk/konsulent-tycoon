import { hashString } from '../../engine'

/** One in this many people is drawn as green text on a black terminal. */
const TERMINAL_ODDS = 150

/** The rare colleague who still does everything in a terminal. Uses its own hash, so no one else's portrait changes. */
export function isTerminalPerson(seed: string) {
  return hashString(`${seed}:terminal`) % TERMINAL_ODDS === 0
}
