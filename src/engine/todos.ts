import {
  NURTURE_SATISFACTION,
  NURTURE_TODO_BELOW,
  TODO_HIRE_MIN_RUNWAY,
  TODO_IDLE_MIN,
  TODO_IDLE_SHARE,
} from './constants'
import { contractMoveBlock } from './contractActions'
import { crisesOf } from './crises'
import { activeContracts, creditLimit, disciplineSupply, headcount, quarterFinancials, staffFirm } from './economy'
import { tenderLock } from './levels'
import { capacity } from './metrics'
import { recruitBlock, startupHours } from './startup'
import { isKeyTender, openTenders } from './tenders'
import { DISCIPLINES } from './types'
import type { GameState } from './types'
import { seatTotal } from './util'

export type TodoId = 'crisis' | 'bid' | 'pitch' | 'hire' | 'nurture' | 'lead' | 'network'

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

  // A crisis stage waiting for a decision. Every stage has a free fallback, so it can always be answered now.
  const crises = crisesOf(state, firmId)
  const undecided = crises.filter((c) => c.status === 'active').length
  const decided = crises.some((c) => c.log.some((l) => l.quarter === state.quarter && !l.auto))
  if (undecided || decided) todos.push({ id: 'crisis', done: undecided === 0, params: { count: undecided } })
  // Only nag about things that pay off before the game ends (valuation ignores backlog).
  const matters = (quarter: number) => quarter < state.maxQuarters
  if (firm.startup) return [...todos, ...startupTodos(state, firmId), ...nurtureTodo(state, firmId, matters)]
  const open = openTenders(state)
  const mine = open.filter((t) => t.bids.some((b) => b.firmId === firmId))

  // Idle people next quarter and a tender in a discipline the firm actually has people in.
  // Bids decided next quarter start later, but they still answer "put the idle people to work".
  const cap = capacity(state, firmId).next
  const idle = Math.max(0, cap.idle - cap.laterSeatsInBids)
  const threshold = Math.max(TODO_IDLE_MIN, Math.round(headcount(firm) * TODO_IDLE_SHARE))
  const fits = open.some(
    (t) =>
      !mine.includes(t) &&
      !tenderLock(firm, t) &&
      DISCIPLINES.some((d) => (t.seats[d] ?? 0) > 0 && disciplineSupply(firm, d) > 0),
  )
  // A bid placed now becomes a contract starting in two quarters.
  if (matters(state.quarter + 2)) todos.push({ id: 'bid', done: idle < threshold || !fits, params: { count: idle } })

  // Bids decided at the end of this quarter without a customer meeting.
  const dueNow = mine.filter((t) => t.dueQuarter === state.quarter && isKeyTender(t))
  if (dueNow.length && matters(state.quarter + 1)) {
    const missing = dueNow.filter((t) => !t.minigameResults[firmId]).length
    todos.push({ id: 'pitch', done: missing === 0, params: { count: missing } })
  }

  // Signed work over the next two quarters that the team can't cover. Hires ordered now arrive next quarter.
  const runway = (firm.cash + creditLimit(firm) * 0.5) / Math.max(1, quarterFinancials(state, firmId).total)
  const demand = Math.max(
    seatTotal(staffFirm(state, firm, state.quarter + 1).demand),
    seatTotal(staffFirm(state, firm, state.quarter + 2).demand),
  )
  const needed = demand - headcount(firm) - seatTotal(firm.pendingHires)
  if (needed >= 1 && runway > TODO_HIRE_MIN_RUNWAY && matters(state.quarter + 2)) {
    const ordered = seatTotal(firm.hiringOrders)
    todos.push({ id: 'hire', done: ordered >= needed, params: { count: Math.ceil(needed) } })
  }

  return [...todos, ...nurtureTodo(state, firmId, matters)]
}

/** A contract close to being cancelled by the customer, and customer care is available for it. */
function nurtureTodo(state: GameState, firmId: string, matters: (quarter: number) => boolean): Todo[] {
  if (!matters(state.quarter + 1)) return []
  const firm = state.firms[firmId]
  const running = activeContracts(state, firmId)
  const atRisk = running.filter(
    (c) => c.satisfaction < NURTURE_TODO_BELOW && !contractMoveBlock(state, firm, c, 'nurture'),
  ).length
  // Keep the ticked item visible after caring for a contract that was at risk this quarter.
  const cared = running.some(
    (c) => c.nurtureQuarter === state.quarter && c.satisfaction < NURTURE_TODO_BELOW + NURTURE_SATISFACTION,
  )
  return atRisk || cared ? [{ id: 'nurture', done: atRisk === 0, params: { count: atRisk } }] : []
}

/**
 * The co-working space: take a lead while people are free, and see the network at least once a quarter.
 * Both are one click away; using every evening hour is up to the player, so it isn't a to-do.
 */
function startupTodos(state: GameState, firmId: string): Todo[] {
  const firm = state.firms[firmId]
  const st = firm.startup!
  const todos: Todo[] = []
  const idle = seatTotal(staffFirm(state, firm).idle)
  if (st.takenLead || (idle > 0 && st.leads.length))
    todos.push({ id: 'lead', done: !!st.takenLead, params: { count: idle } })
  const full = startupHours(st.cofounder)
  const canMove = st.candidates.some((c) =>
    (['coffee', 'drinks', 'linkedin', 'offer'] as const).some((m) => !recruitBlock(firm, c, m, state.quarter)),
  )
  if (st.hours < full || (canMove && st.hours > 0))
    todos.push({ id: 'network', done: st.hours < full, params: { count: st.hours } })
  return todos
}
