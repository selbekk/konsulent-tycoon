import { MIN_AWARD_QUALITY, bidQuality, bidScoreEstimate, marketLowestGuess } from '../../engine'
import type { Bid, GameState, Tender } from '../../engine'

export type BidChance = 'low' | 'medium' | 'high'

/** Rough win chance for the UI, against a typical market bid. Pure. */
export function bidChance(game: GameState, bid: Bid, tender: Tender, quality = bidQuality(game, bid, tender)) {
  const tooWeak = quality < MIN_AWARD_QUALITY
  const score = bidScoreEstimate(game, bid, tender, Math.min(bid.rateMultiplier, marketLowestGuess(tender)), quality)
  const chance: BidChance = tooWeak ? 'low' : score >= 78 ? 'high' : score >= 66 ? 'medium' : 'low'
  return { quality, tooWeak, chance }
}

export const chanceTone = (c: BidChance) => (c === 'high' ? 'good' : c === 'medium' ? 'warn' : 'bad')
