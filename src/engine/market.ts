import { TRENDS } from '../content/trends'
import { chance, nextInt, pick } from './rng'
import type { GameState } from './types'
import { addNews } from './util'

export function updateTrends(state: GameState, nextQuarter: number) {
  const expired = state.trends.filter((t) => t.untilQuarter <= nextQuarter)
  for (const t of expired) addNews(state, 'news.trend.ended', { trend: t.id }, 'neutral')
  state.trends = state.trends.filter((t) => t.untilQuarter > nextQuarter)
  if (state.trends.length < 2 && chance(state.rng, 0.3)) {
    const candidates = TRENDS.filter((t) => !state.trends.some((a) => a.id === t.id))
    if (!candidates.length) return
    const def = pick(state.rng, candidates)
    state.trends.push({ id: def.id, untilQuarter: nextQuarter + nextInt(state.rng, def.minDuration, def.maxDuration) })
    addNews(state, 'news.trend.started', { trend: def.id }, 'neutral')
  }
}
