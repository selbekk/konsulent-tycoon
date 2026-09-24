import {
  ACQUIRE_MAX_SIZE_RATIO,
  ACQUIRE_MORALE_HIT,
  ACQUIRE_PREMIUM,
  ACQUIRE_PRICE_PER_HEAD,
  ACQUIRE_STAR_LOYALTY_HIT,
  clamp,
} from './constants'
import { headcount } from './economy'
import { hasFeature } from './levels'
import { addPeople } from './roster'
import { valuation } from './score'
import { DISCIPLINES } from './types'
import type { ActionOf, Firm, GameState } from './types'
import { addNews } from './util'

/** What the owners want: the business (not its cash, which stays with them) plus a premium, or a floor per head. Pure. */
export function acquisitionPrice(target: Firm): number {
  const business = Math.max(0, valuation(target) - Math.max(0, target.cash))
  return Math.round(Math.max(headcount(target) * ACQUIRE_PRICE_PER_HEAD, business * ACQUIRE_PREMIUM) / 100_000) * 100_000
}

/** Error key if `buyer` can't buy `target` right now, else undefined. Pure. */
export function acquisitionBlock(buyer: Firm, target: Firm | undefined): string | undefined {
  if (!target || target.id === buyer.id || target.bankrupt || target.isPlayer) return 'errors.invalidTarget'
  if (!hasFeature(buyer, 'acquisitions')) return 'errors.levelTooLow'
  if (headcount(target) > headcount(buyer) * ACQUIRE_MAX_SIZE_RATIO) return 'errors.targetTooBig'
  if (buyer.cash < acquisitionPrice(target)) return 'errors.notEnoughCash'
  return undefined
}

/** People, stars, contracts and client relationships move over; the target's cash does not. */
export function handleAcquire(state: GameState, a: ActionOf<'acquireFirm'>): string | undefined {
  const buyer = state.firms[a.firmId]
  const target = state.firms[a.targetFirmId]
  if (!buyer || buyer.bankrupt) return 'errors.invalid'
  const blocked = acquisitionBlock(buyer, target)
  if (blocked) return blocked
  buyer.cash -= acquisitionPrice(target)

  for (const d of DISCIPLINES) {
    const from = target.pools[d]
    const to = buyer.pools[d]
    if (!from.count) continue
    const morale = clamp(from.morale - ACQUIRE_MORALE_HIT, 0, 100)
    if (buyer.roster) addPeople(state, buyer, d, from.count, from.level, morale)
    else {
      const n = to.count + from.count
      to.level = (to.level * to.count + from.level * from.count) / n
      to.morale = (to.morale * to.count + morale * from.count) / n
      to.count = n
    }
    from.count = 0
  }
  for (const star of target.stars) {
    star.loyalty = clamp(star.loyalty - ACQUIRE_STAR_LOYALTY_HIT, 0, 100)
    star.joinedQuarter = state.quarter
    buyer.stars.push(star)
  }
  target.stars = []
  for (const c of state.contracts) if (c.firmId === target.id) c.firmId = buyer.id
  for (const t of state.tenders) t.bids = t.bids.filter((b) => b.firmId !== target.id)
  for (const c of Object.values(state.customers)) {
    c.relationships[buyer.id] = Math.max(c.relationships[buyer.id] ?? 20, c.relationships[target.id] ?? 20)
  }
  const stats = (buyer.stats ??= {})
  stats.acquisitions = (stats.acquisitions ?? 0) + 1

  // Out of the market, but not a bankruptcy: nothing goes back out to tender.
  target.bankrupt = true
  target.acquiredBy = buyer.id
  addNews(state, 'news.firm.acquiredBy', { firm: target.name, buyer: buyer.name }, 'sassy', { firmId: buyer.id, personal: buyer.isPlayer })
  return undefined
}
