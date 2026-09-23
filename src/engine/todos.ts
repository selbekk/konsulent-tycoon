import { TODO_HIRE_MIN_RUNWAY, TODO_IDLE_MIN, TODO_IDLE_SHARE } from './constants'
import { creditLimit, disciplineSupply, headcount, quarterFinancials, staffFirm } from './economy'
import { capacity } from './metrics'
import { openTenders } from './tenders'
import { DISCIPLINES } from './types'
import type { GameState } from './types'
import { seatTotal } from './util'

export type TodoId = 'bid' | 'pitch' | 'hire'

export interface Todo {
  id: TodoId
  done: boolean
  /** Numbers for the UI text, e.g. how many people are idle. */
  params: Record<string, number>
}

/**
 * The few things worth doing before ending the quarter. Each open item can be fixed this
 * quarter with one concrete action, so the end-of-quarter warning never nags for nothing.
 * Pure: safe to call from the UI (never touches state.rng).
 */
export function quarterTodos(state: GameState, firmId: string): Todo[] {
  const firm = state.firms[firmId]
  const todos: Todo[] = []
  const open = openTenders(state)
  const mine = open.filter((t) => t.bids.some((b) => b.firmId === firmId))

  // Idle people next quarter and a tender in a discipline the firm actually has people in.
  const idle = capacity(state, firmId).next.idle
  const threshold = Math.max(TODO_IDLE_MIN, Math.round(headcount(firm) * TODO_IDLE_SHARE))
  const fits = open.some(
    (t) => !mine.includes(t) && DISCIPLINES.some((d) => (t.seats[d] ?? 0) > 0 && disciplineSupply(firm, d) > 0),
  )
  todos.push({ id: 'bid', done: idle < threshold || !fits, params: { count: idle } })

  // Bids decided at the end of this quarter without a customer meeting.
  const dueNow = mine.filter((t) => t.dueQuarter === state.quarter)
  if (dueNow.length) {
    const missing = dueNow.filter((t) => !t.minigameResults[firmId]).length
    todos.push({ id: 'pitch', done: missing === 0, params: { count: missing } })
  }

  // Signed work in two quarters (when hires ordered now arrive) that the team can't cover.
  const runway = (firm.cash + creditLimit(firm) * 0.5) / Math.max(1, quarterFinancials(state, firmId).total)
  const demand = seatTotal(staffFirm(state, firm, state.quarter + 2).demand)
  const needed = demand - headcount(firm) - seatTotal(firm.pendingHires)
  if (needed >= 1 && runway > TODO_HIRE_MIN_RUNWAY) {
    const ordered = seatTotal(firm.hiringOrders)
    todos.push({ id: 'hire', done: ordered >= needed, params: { count: Math.ceil(needed) } })
  }

  return todos
}
