import { creditLimit, disciplineSupply, headcount, quarterFinancials, staffFirm } from '../economy'
import { noise } from '../rng'
import { openTenders } from '../tenders'
import { DISCIPLINES } from '../types'
import type { Action, Discipline, GameState } from '../types'
import { seatTotal } from '../util'

/**
 * A simulated "sensible human" for balancing: bids where it can mostly staff the work,
 * prices a little under market, hires in small steps when busy, keeps culture decent.
 * Draws from state.rng – call on a draft only.
 */
export function planHumanProxy(state: GameState, opts: { price?: number; minigame?: number } = {}): Action[] {
  const firmId = state.playerId
  const firm = state.firms[firmId]
  if (firm.bankrupt) return []
  const actions: Action[] = []
  const fin = quarterFinancials(state, firmId)
  const hc = headcount(firm)
  const runway = (firm.cash + creditLimit(firm) * 0.5) / Math.max(1, fin.total)

  actions.push({
    type: 'setBudgets',
    firmId,
    budgets: { fagmiljoPerHead: runway > 1.5 ? 15_000 : 8_000, sosialtPerHead: runway > 1.5 ? 12_000 : 6_000, salaryPremium: 0.02 },
  })

  // Free people per discipline when new work would start, minus what's already offered.
  const open = openTenders(state)
  const nextQ = state.quarter + 2
  const committed = staffFirm(state, firm, nextQ).demand
  const free: Record<Discipline, number> = Object.fromEntries(
    DISCIPLINES.map((d) => [d, disciplineSupply(firm, d) + (firm.pendingHires[d] ?? 0) - (committed[d] ?? 0)]),
  ) as Record<Discipline, number>
  for (const t of open) {
    if (!t.bids.some((b) => b.firmId === firmId)) continue
    for (const d of DISCIPLINES) free[d] -= t.seats[d] ?? 0
  }

  const candidates = open
    .filter((t) => !t.bids.some((b) => b.firmId === firmId))
    .map((t) => {
      const total = seatTotal(t.seats)
      const covered = DISCIPLINES.reduce((s, d) => s + Math.min(t.seats[d] ?? 0, Math.max(0, free[d])), 0)
      return { t, total, cover: covered / total }
    })
    .filter((x) => x.cover >= (fin.utilization < 0.6 ? 0.3 : 0.5) && x.total <= Math.max(6, hc * 1.2))
    // Most coverable seats first: small gigs only when that's what fits.
    .sort((a, b) => b.cover * b.total - a.cover * a.total || b.cover - a.cover)
    .slice(0, Math.max(3, Math.round(hc / 4)))

  for (const { t } of candidates) {
    const stars = firm.stars.filter((s) => (t.seats[s.discipline] ?? 0) > 0).slice(0, 2)
    actions.push({
      type: 'recordMinigame',
      firmId,
      tenderId: t.id,
      kind: 'meeting',
      score: Math.max(0, Math.min(100, (opts.minigame ?? 70) + noise(state.rng, 15))),
    })
    actions.push({
      type: 'placeBid',
      tenderId: t.id,
      bid: {
        firmId,
        rateMultiplier: Math.round(((opts.price ?? 0.95) + noise(state.rng, 0.02) - (t.priceWeight > 0.6 ? 0.05 : 0)) * 100) / 100,
        starIds: stars.map((s) => s.id),
        effort: runway > 1 ? 2 : 1,
        cvPad: false,
        ghostCv: false,
      },
    })
    for (const d of DISCIPLINES) free[d] -= t.seats[d] ?? 0
  }

  // Two slow quarters in a row with little on the way: let a few go.
  const recent = firm.history.slice(-2)
  if (recent.length === 2 && recent.every((h) => h.utilization < 0.5) && runway < 2 && hc > 6) {
    const idle = [...DISCIPLINES].sort((a, b) => free[b] - free[a])[0]
    const n = Math.min(firm.pools[idle].count, Math.max(1, Math.round(free[idle] * 0.3)))
    if (n > 0) actions.push({ type: 'fire', firmId, discipline: idle, count: n })
  }

  // Hire into shortfalls first, then grow gently when busy.
  const next = staffFirm(state, firm, state.quarter + 1)
  if (runway > 1) {
    for (const d of DISCIPLINES) {
      const short = (next.demand[d] ?? 0) - disciplineSupply(firm, d) - (firm.pendingHires[d] ?? 0)
      if (short > 0) actions.push({ type: 'orderHires', firmId, discipline: d, count: Math.ceil(short * 1.5) })
    }
    const nextUtil = next.billed / Math.max(1, hc + DISCIPLINES.reduce((a, d) => a + (firm.pendingHires[d] ?? 0), 0))
    if (fin.utilization > 0.85 && nextUtil > 0.85) {
      const busiest = [...DISCIPLINES].sort((a, b) => (next.demand[b] ?? 0) - (next.demand[a] ?? 0))[0]
      actions.push({ type: 'orderHires', firmId, discipline: busiest, count: Math.max(2, Math.round(hc * 0.1)) })
    }
  }
  return actions
}
