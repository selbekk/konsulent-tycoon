import { CREDIT_INTEREST } from './constants'
import { creditLimit, quarterFinancials } from './economy'
import type { Financials } from './economy'
import type { GameState } from './types'

/**
 * The numbers behind the finance tab. Pure – safe to call from the UI.
 *
 * The recorded EBITDA is the operating result only. Interest, fines, events, acquisitions and other one-off
 * spending also move the cash, so the ledger shows them as `other` (the change in cash minus the result).
 */

export interface LedgerRow {
  quarter: number
  revenue: number
  costs: number
  ebitda: number
  fines: number
  headcount: number
  utilization: number
  /** Cash at the end of the quarter. Missing in early saves. */
  cash?: number
  /** Change in cash that isn't the operating result. Needs the cash of the quarter before. */
  other?: number
  /** Firm value at the end of the quarter. */
  valuation?: number
}

export interface FinanceOverview {
  /** What this quarter will cost and bring in, line by line, if nothing changes. */
  budget: Financials
  cash: number
  creditLimit: number
  /** Cash plus what is left on the credit line: how far the firm can fall before the bank steps in. */
  headroom: number
  /** Expected cash burn this quarter incl. overdraft interest (a positive number), 0 when the quarter makes money. */
  burn: number
  /** Quarters of this burn before cash falls below the credit limit. Undefined when not burning. */
  runway?: number
  /** Quarters in a row below the credit limit; the firm goes bust at BANKRUPT_AFTER_QUARTERS. */
  overdrawnQuarters: number
  /** Past quarters, oldest first (as far back as `Firm.history` goes). */
  ledger: LedgerRow[]
}

export function financeOverview(state: GameState, firmId: string): FinanceOverview {
  const firm = state.firms[firmId]
  const budget = quarterFinancials(state, firmId)
  const limit = creditLimit(firm)
  const headroom = firm.cash + limit
  // Interest on the overdraft is charged after the result, the same way endTurn does it.
  const interest = Math.max(0, -(firm.cash + budget.ebitda)) * CREDIT_INTEREST
  const burn = Math.max(0, interest - budget.ebitda)

  const ledger: LedgerRow[] = firm.history.map((h, i) => {
    const prev = firm.history[i - 1]
    const consecutive = prev && prev.quarter === h.quarter - 1
    return {
      quarter: h.quarter,
      revenue: h.revenue,
      costs: h.costs,
      ebitda: h.ebitda,
      fines: h.fines,
      headcount: h.headcount,
      utilization: h.utilization,
      cash: h.cash,
      other: consecutive && h.cash !== undefined && prev.cash !== undefined ? h.cash - prev.cash - h.ebitda : undefined,
      valuation: firm.valuationHistory[h.quarter],
    }
  })

  return {
    budget,
    cash: firm.cash,
    creditLimit: limit,
    headroom,
    burn,
    runway: burn > 0 ? Math.max(0, headroom / burn) : undefined,
    overdrawnQuarters: firm.negativeCashQuarters,
    ledger,
  }
}
