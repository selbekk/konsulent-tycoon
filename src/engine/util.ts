import { NEWS_LENGTH, START_YEAR } from './constants'
import { DISCIPLINES } from './types'
import type { Discipline, Firm, GameState, NewsTone, Params, Pool, Seats } from './types'

/**
 * Locale-free string order for ids. Never `localeCompare` in the engine: its order depends on the
 * locale (in `nb`, "aa" sorts as "å", last), so a browser and the replay server could play differently.
 */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function nextId(state: GameState, prefix: string): string {
  state.idCounter += 1
  return `${prefix}${state.idCounter}`
}

export function emptyPools(): Record<Discipline, Pool> {
  return Object.fromEntries(DISCIPLINES.map((d) => [d, { count: 0, level: 2.5, morale: 60 }])) as Record<
    Discipline,
    Pool
  >
}

export function seatTotal(seats: Seats): number {
  let n = 0
  for (const d of DISCIPLINES) n += seats[d] ?? 0
  return n
}

export function addSeats(a: Seats, b: Seats, factor = 1): Seats {
  const out: Seats = { ...a }
  for (const d of DISCIPLINES) {
    const v = (a[d] ?? 0) + (b[d] ?? 0) * factor
    if (v) out[d] = v
    else delete out[d]
  }
  return out
}

export function quarterLabel(quarter: number): { year: number; q: number } {
  return { year: START_YEAR + Math.floor(quarter / 4), q: (quarter % 4) + 1 }
}

export function addNews(
  state: GameState,
  key: string,
  params: Params = {},
  tone: NewsTone = 'neutral',
  opts: { firmId?: string; personal?: boolean } = {},
) {
  state.news.push({ id: nextId(state, 'n'), quarter: state.quarter, key, params, tone, ...opts })
  if (state.news.length > NEWS_LENGTH) state.news.splice(0, state.news.length - NEWS_LENGTH)
}

export const player = (state: GameState): Firm => state.firms[state.playerId]

export const aiFirms = (state: GameState): Firm[] =>
  state.firmOrder.map((id) => state.firms[id]).filter((f) => !f.isPlayer && !f.bankrupt)

export const activeFirms = (state: GameState): Firm[] =>
  state.firmOrder.map((id) => state.firms[id]).filter((f) => !f.bankrupt)

export function round(n: number, decimals = 0) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
