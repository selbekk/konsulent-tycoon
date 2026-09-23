import { BILLABLE_HOURS } from './constants'
import { headcount, quarterFinancials, staffFirm } from './economy'
import type { Firm, GameState, QuarterReport } from './types'
import { activeFirms, seatTotal } from './util'

/**
 * The numbers a consultancy is steered by. Pure – safe to call from the UI.
 *
 * - FG (faktureringsgrad / utilisation): own people billing ÷ headcount.
 * - OT (oppnådd timepris / achieved rate): own revenue ÷ own billed hours (freelancers excluded).
 * - Growth: headcount now vs. four quarters ago.
 * - Retention: 1 − voluntary leavers over the last four quarters ÷ average headcount.
 */

export interface Capacity {
  headcount: number
  /** Billing this quarter. */
  billing: number
  /** On the bench this quarter. */
  bench: number
  next: {
    /** Already staffed on contracts next quarter. */
    committed: number
    /** Free next quarter and offered in open bids. */
    offered: number
    /** Free next quarter with no bid out. */
    idle: number
    /** Seats in open bids (can exceed free people). */
    seatsInBids: number
  }
}

export function capacity(state: GameState, firmId: string): Capacity {
  const firm = state.firms[firmId]
  const hc = headcount(firm)
  const now = staffFirm(state, firm)
  const next = staffFirm(state, firm, state.quarter + 1)
  const seatsInBids = state.tenders
    .filter((t) => !t.resolved && t.bids.some((b) => b.firmId === firmId))
    .reduce((s, t) => s + seatTotal(t.seats), 0)
  const committed = Math.min(hc, next.billed)
  const free = Math.max(0, hc - committed)
  const offered = Math.min(free, seatsInBids)
  return {
    headcount: hc,
    billing: now.billed,
    bench: Math.max(0, hc - now.billed),
    next: { committed, offered, idle: free - offered, seatsInBids },
  }
}

export interface KpiPoint {
  quarter: number
  value: number
}

export interface Kpis {
  fg: { now: number; last?: number; trend: KpiPoint[] }
  ot: { now?: number; last?: number; trend: KpiPoint[] }
  growth: { yoy?: number; qoq?: number; trend: KpiPoint[] }
  retention: { value?: number; leavers: number; fired: number; trend: KpiPoint[] }
}

const fgOf = (h: QuarterReport) => h.utilization
const otOf = (h: QuarterReport) => (h.billed && h.ownRevenue !== undefined ? h.ownRevenue / (h.billed * BILLABLE_HOURS) : undefined)

/** Rolling 4-quarter retention ending at index i. */
function retentionAt(history: QuarterReport[], i: number): number | undefined {
  const window = history.slice(Math.max(0, i - 3), i + 1)
  if (window.length < 2) return undefined
  const avg = window.reduce((s, h) => s + h.headcount, 0) / window.length
  if (!avg) return undefined
  const leavers = window.reduce((s, h) => s + h.leavers, 0)
  // Scale to a full year when fewer than four quarters are known.
  return Math.max(0, 1 - (leavers / avg) * (4 / window.length))
}

export function kpis(state: GameState, firmId: string): Kpis {
  const firm = state.firms[firmId]
  const h = firm.history
  const fin = quarterFinancials(state, firmId)
  const last = h[h.length - 1]

  const fgTrend = [...h.map((x) => ({ quarter: x.quarter, value: fgOf(x) })), { quarter: state.quarter, value: fin.utilization }]
  const otTrend = h
    .map((x) => ({ quarter: x.quarter, value: otOf(x) }))
    .filter((p): p is KpiPoint => p.value !== undefined)
  const otNow = fin.ownHours ? fin.ownRevenue / fin.ownHours : undefined
  if (otNow !== undefined) otTrend.push({ quarter: state.quarter, value: otNow })

  const hcNow = headcount(firm)
  const hcTrend = [...h.map((x) => ({ quarter: x.quarter, value: x.headcount })), { quarter: state.quarter, value: hcNow }]
  const yearAgo = h.length >= 4 ? h[h.length - 4].headcount : undefined
  const qAgo = last?.headcount

  const recent = h.slice(-4)
  return {
    fg: { now: fin.utilization, last: last ? fgOf(last) : undefined, trend: fgTrend },
    ot: { now: otNow, last: last ? otOf(last) : undefined, trend: otTrend },
    growth: {
      yoy: yearAgo ? hcNow / yearAgo - 1 : undefined,
      qoq: qAgo ? hcNow / qAgo - 1 : undefined,
      trend: hcTrend,
    },
    retention: {
      value: retentionAt(h, h.length - 1),
      leavers: recent.reduce((s, x) => s + x.leavers, 0),
      fired: recent.reduce((s, x) => s + (x.fired ?? 0), 0),
      trend: h.map((_, i) => ({ quarter: h[i].quarter, value: retentionAt(h, i) })).filter((p): p is KpiPoint => p.value !== undefined),
    },
  }
}

export interface Benchmark {
  fg?: number
  ot?: number
  growth?: number
  retention?: number
}

const mean = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

/** Industry averages from last quarter (other firms only). */
export function benchmark(state: GameState, exceptFirmId: string): Benchmark {
  const firms = activeFirms(state).filter((f) => f.id !== exceptFirmId && f.history.length)
  const lastOf = (f: Firm) => f.history[f.history.length - 1]
  return {
    fg: mean(firms.map((f) => fgOf(lastOf(f)))),
    ot: mean(firms.map((f) => otOf(lastOf(f)))),
    growth: mean(firms.map((f) => (f.history.length >= 4 ? headcount(f) / f.history[f.history.length - 4].headcount - 1 : undefined))),
    retention: mean(firms.map((f) => retentionAt(f.history, f.history.length - 1))),
  }
}
