import { customerWants, isKeyTender } from '../tenders'
import { DISCIPLINES } from '../types'
import type { PromiseId, Tender } from '../types'
import { seatTotal } from '../util'

/**
 * The promise a sensible firm makes on a key tender, given its free people per discipline:
 * what the customer asks for if the firm can keep it, else a full team when everyone is free.
 */
export function choosePromise(tender: Tender, free: Record<string, number>): PromiseId | undefined {
  if (!isKeyTender(tender)) return undefined
  const total = seatTotal(tender.seats)
  const cover = DISCIPLINES.reduce((s, d) => s + Math.min(tender.seats[d] ?? 0, Math.max(0, free[d] ?? 0)), 0) / Math.max(1, total)
  const canKeep = (p: PromiseId) => (p === 'fullTeam' ? cover >= 0.95 : p === 'phased' ? cover >= 0.55 : true)
  const wants = customerWants(tender.customerId)
  if (wants && canKeep(wants)) return wants
  return canKeep('fullTeam') ? 'fullTeam' : undefined
}
