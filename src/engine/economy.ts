import {
  BILLABLE_HOURS,
  CREDIT_MIN,
  CREDIT_REVENUE_SHARE,
  FIXED_OVERHEAD,
  FLEX_LEVEL,
  FREELANCER_LEVEL,
  FREELANCER_MARKUP,
  OFFSHORE_COST_FACTOR,
  OVERHEAD_PER_HEAD,
  listRate,
  quarterlySalaryCost,
} from './constants'
import { DISCIPLINES } from './types'
import type { Contract, Discipline, Firm, GameState, Seats } from './types'

export function headcount(firm: Firm): number {
  let n = firm.stars.length
  for (const d of DISCIPLINES) n += firm.pools[d].count
  return n
}

export function disciplineSupply(firm: Firm, d: Discipline): number {
  return firm.pools[d].count + firm.stars.filter((s) => s.discipline === d).length
}

export function disciplineLevel(firm: Firm, d: Discipline): number {
  const pool = firm.pools[d]
  const stars = firm.stars.filter((s) => s.discipline === d)
  const n = pool.count + stars.length
  if (n === 0) return pool.level
  return (pool.level * pool.count + stars.reduce((s, x) => s + x.level, 0)) / n
}

export function averageLevel(firm: Firm): number {
  const n = headcount(firm)
  if (n === 0) return 0
  let sum = 0
  for (const d of DISCIPLINES) sum += disciplineLevel(firm, d) * disciplineSupply(firm, d)
  return sum / n
}

export function averageMorale(firm: Firm): number {
  const n = headcount(firm)
  if (n === 0) return 0
  let sum = firm.stars.reduce((s, x) => s + x.morale, 0)
  for (const d of DISCIPLINES) sum += firm.pools[d].morale * firm.pools[d].count
  return sum / n
}

export const isActive = (c: Contract, quarter: number) =>
  !c.terminated && c.startQuarter <= quarter && quarter < c.endQuarter

export function activeContracts(state: GameState, firmId: string, quarter = state.quarter): Contract[] {
  return state.contracts.filter((c) => c.firmId === firmId && isActive(c, quarter))
}

export interface ContractStaffing {
  contractId: string
  staffed: Seats
  /** Own people from another discipline covering the seat ("knows a bit of React"). */
  flex: Seats
  freelance: Seats
  offshore: Seats
}

export interface FirmStaffing {
  contracts: ContractStaffing[]
  /** Own people on billable work. */
  billed: number
  utilization: number
  demand: Seats
}

/**
 * Staffs all active contracts with own people. Stars assigned to a contract fill that
 * contract first; remaining supply is spread proportionally over remaining demand.
 * Offshore (silent outsourcing) seats are taken out before staffing.
 */
export function staffFirm(state: GameState, firm: Firm, quarter = state.quarter): FirmStaffing {
  const contracts = activeContracts(state, firm.id, quarter)
  const result: ContractStaffing[] = contracts.map((c) => ({ contractId: c.id, staffed: {}, flex: {}, freelance: {}, offshore: {} }))
  const leftover: Partial<Record<Discipline, number>> = {}
  const demand: Seats = {}
  let billed = 0

  for (const d of DISCIPLINES) {
    const remaining = contracts.map((c, i) => {
      const seats = c.activeSeats[d] ?? 0
      const offshore = Math.round(seats * c.outsourcedShare)
      if (offshore) result[i].offshore[d] = offshore
      return seats - offshore
    })
    const totalDemand = remaining.reduce((a, b) => a + b, 0)
    if (totalDemand) demand[d] = totalDemand

    // Assigned stars first
    const starsInD = firm.stars.filter((s) => s.discipline === d)
    const unassignedStars = starsInD.filter((s) => {
      const idx = contracts.findIndex((c) => c.id === s.assignedContractId)
      if (idx >= 0 && remaining[idx] > 0) {
        remaining[idx] -= 1
        result[idx].staffed[d] = (result[idx].staffed[d] ?? 0) + 1
        billed++
        return false
      }
      return true
    })

    let supply = firm.pools[d].count + unassignedStars.length
    const left = remaining.reduce((a, b) => a + b, 0)
    if (left > 0 && supply > 0) {
      const toPlace = Math.min(supply, left)
      // Proportional allocation with largest-remainder rounding
      const raw = remaining.map((r) => (r / left) * toPlace)
      const alloc = raw.map(Math.floor)
      let rest = toPlace - alloc.reduce((a, b) => a + b, 0)
      const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
      for (const [, i] of order) {
        if (rest <= 0) break
        if (alloc[i] < remaining[i]) {
          alloc[i]++
          rest--
        }
      }
      alloc.forEach((n, i) => {
        if (n) result[i].staffed[d] = (result[i].staffed[d] ?? 0) + n
        remaining[i] -= n
        billed += n
      })
      supply -= toPlace
    }
    leftover[d] = supply
    remaining.forEach((r, i) => {
      if (r > 0) result[i].freelance[d] = r
    })
  }

  // Bench people cover missing seats in other disciplines before freelancers are called in.
  for (const cs of result) {
    for (const d of DISCIPLINES) {
      let missing = cs.freelance[d] ?? 0
      while (missing > 0) {
        const donor = DISCIPLINES.filter((x) => x !== d && (leftover[x] ?? 0) > 0).sort((a, b) => (leftover[b] ?? 0) - (leftover[a] ?? 0))[0]
        if (!donor) break
        const n = Math.min(missing, leftover[donor]!)
        leftover[donor]! -= n
        missing -= n
        cs.flex[d] = (cs.flex[d] ?? 0) + n
        billed += n
      }
      if (missing > 0) cs.freelance[d] = missing
      else delete cs.freelance[d]
    }
  }

  const hc = headcount(firm)
  return { contracts: result, billed, utilization: hc ? billed / hc : 0, demand }
}

export interface Financials {
  revenue: number
  salaryCost: number
  overhead: number
  cultureCost: number
  freelanceCost: number
  offshoreCost: number
  total: number
  ebitda: number
  utilization: number
  /** Revenue from own people (incl. flex), excluding what freelancers bill. */
  ownRevenue: number
  /** Hours billed by own people. */
  ownHours: number
  staffing: FirmStaffing
}

/** Own (and offshore) seats are billed at the firm's level; freelancers at theirs. */
export function contractRevenue(firm: Firm, c: Contract, staffing?: ContractStaffing): number {
  let revenue = 0
  for (const d of DISCIPLINES) {
    const seats = c.activeSeats[d] ?? 0
    if (!seats) continue
    const freelance = staffing?.freelance[d] ?? 0
    const flex = staffing?.flex[d] ?? 0
    const own = seats - freelance - flex
    revenue += own * BILLABLE_HOURS * listRate(disciplineLevel(firm, d)) * c.rateMultiplier
    revenue += flex * BILLABLE_HOURS * listRate(FLEX_LEVEL) * c.rateMultiplier
    revenue += freelance * BILLABLE_HOURS * listRate(FREELANCER_LEVEL) * c.rateMultiplier
  }
  return revenue
}

export function salaryCost(firm: Firm): number {
  let cost = 0
  for (const d of DISCIPLINES) {
    const p = firm.pools[d]
    cost += p.count * quarterlySalaryCost(p.level, firm.budgets.salaryPremium)
  }
  for (const s of firm.stars) cost += quarterlySalaryCost(s.level, firm.budgets.salaryPremium + s.salaryPremium)
  return cost
}

export function quarterFinancials(state: GameState, firmId: string, quarter = state.quarter): Financials {
  const firm = state.firms[firmId]
  const staffing = staffFirm(state, firm, quarter)
  const hc = headcount(firm)
  const byId = new Map(state.contracts.map((c) => [c.id, c]))

  let revenue = 0
  let freelanceRevenue = 0
  let freelanceCost = 0
  let offshoreCost = 0
  const freelanceRate = listRate(FREELANCER_LEVEL) * FREELANCER_MARKUP * BILLABLE_HOURS
  const offshoreRate = listRate(FREELANCER_LEVEL) * OFFSHORE_COST_FACTOR * BILLABLE_HOURS
  for (const cs of staffing.contracts) {
    const c = byId.get(cs.contractId)!
    revenue += contractRevenue(firm, c, cs)
    for (const d of DISCIPLINES) {
      freelanceRevenue += (cs.freelance[d] ?? 0) * BILLABLE_HOURS * listRate(FREELANCER_LEVEL) * c.rateMultiplier
      freelanceCost += (cs.freelance[d] ?? 0) * freelanceRate
      offshoreCost += (cs.offshore[d] ?? 0) * offshoreRate
    }
  }

  const salary = salaryCost(firm)
  const overhead = hc * OVERHEAD_PER_HEAD + FIXED_OVERHEAD
  const cultureCost = hc * (firm.budgets.fagmiljoPerHead + firm.budgets.sosialtPerHead)
  const total = salary + overhead + cultureCost + freelanceCost + offshoreCost
  return {
    revenue,
    salaryCost: salary,
    overhead,
    cultureCost,
    freelanceCost,
    offshoreCost,
    total,
    ebitda: revenue - total,
    utilization: staffing.utilization,
    ownRevenue: revenue - freelanceRevenue,
    ownHours: staffing.billed * BILLABLE_HOURS,
    staffing,
  }
}

/** How far below zero the bank lets you go. Grows with revenue. */
export function creditLimit(firm: Firm): number {
  const recent = firm.history.slice(-4)
  const revenue = recent.reduce((s, r) => s + r.revenue, 0)
  const annual = recent.length ? (revenue / recent.length) * 4 : 0
  return Math.max(CREDIT_MIN, annual * CREDIT_REVENUE_SHARE * 0.25)
}

/** What a firm can spend right now: cash plus what is left on the credit line. */
export function spendable(firm: Firm): number {
  return firm.cash + creditLimit(firm)
}
