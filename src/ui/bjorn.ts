import { firmLevel, quarterFinancials } from '../engine'
import type { GameState } from '../engine'

/** Which line Styreleder Bjørn says, based on how things are going. */
export function bjornKey(game: GameState): string {
  const me = game.firms[game.playerId]
  const fin = quarterFinancials(game, me.id)
  // The dashboard first shows when the firm leaves the co-working space (or at the start of an old save).
  if (game.quarter === 0 || (me.levelUpQuarter === game.quarter - 1 && firmLevel(me) === 2)) return 'bjorn.start'
  if (me.cash < 0) return 'bjorn.inCredit'
  if (me.heat > 50) return 'bjorn.heat'
  if (fin.utilization > 0.95) return 'bjorn.overworked'
  if (fin.utilization < 0.5) return 'bjorn.bench'
  if (fin.ebitda < 0) return 'bjorn.losing'
  if (
    me.history.length >= 2 &&
    me.history[me.history.length - 1].headcount > me.history[me.history.length - 2].headcount
  )
    return 'bjorn.growing'
  return 'bjorn.fine'
}
