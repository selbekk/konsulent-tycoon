import { firmLevel, headcount, playerRank, valuation } from '../engine'
import type { Action, ActionOf, ActionType, GameState } from '../engine'

/**
 * What each player action is called in PostHog, and which details go with it.
 * Only ids from the content (customers, events, crises, rival firms) and numbers: never names the player typed.
 */
type Props = Record<string, string | number | boolean | undefined>
type Describe<T extends ActionType> = { event: string; props?: (a: ActionOf<T>, s: GameState) => Props }

const customerOf = (s: GameState, contractId: string) => s.contracts.find((c) => c.id === contractId)?.customerId
const crisisOf = (s: GameState, crisisId: string) => s.crises?.find((c) => c.id === crisisId)

export const ACTION_EVENTS: { [T in ActionType]: Describe<T> } = {
  setBudgets: { event: 'budgets_set', props: (a) => ({ ...a.budgets }) },
  orderHires: { event: 'hires_ordered', props: (a) => ({ discipline: a.discipline, count: a.count }) },
  fire: {
    event: 'employee_fired',
    props: (a) => ({ discipline: a.discipline, count: a.count, picked_person: !!a.employeeId }),
  },
  trainEmployee: { event: 'employee_trained', props: (a) => ({ discipline: a.discipline }) },
  promoteEmployee: { event: 'employee_promoted' },
  setMentor: { event: 'mentor_set', props: (a) => ({ ended: !a.starId }) },
  setStretch: { event: 'stretch_assignment_set', props: (a) => ({ ended: !a.contractId }) },
  careerTalk: { event: 'career_talk_held' },
  hireStar: { event: 'star_hired' },
  giveRaise: { event: 'star_raise_given', props: (a) => ({ amount: a.amount }) },
  placeBid: {
    event: 'bid_placed',
    props: (a, s) => {
      const tender = s.tenders.find((t) => t.id === a.tenderId)
      return {
        customer: tender?.customerId,
        tender_kind: tender?.kind,
        rebid: !!tender?.bids.some((b) => b.firmId === a.bid.firmId),
        rate_multiplier: a.bid.rateMultiplier,
        effort: a.bid.effort,
        stars: a.bid.starIds.length,
        cv_pad: a.bid.cvPad,
        ghost_cv: a.bid.ghostCv,
        promise: a.bid.promise,
      }
    },
  },
  withdrawBid: {
    event: 'bid_withdrawn',
    props: (a, s) => ({ customer: s.tenders.find((t) => t.id === a.tenderId)?.customerId }),
  },
  recordMinigame: {
    event: 'minigame_finished',
    props: (a) => ({ kind: a.kind, score: a.score }),
  },
  resolveEvent: {
    event: 'event_resolved',
    props: (a, s) => ({
      event_id: s.pendingEvents.find((e) => e.id === a.pendingEventId)?.eventId,
      choice: a.choiceId,
    }),
  },
  resolveCrisis: {
    event: 'crisis_choice_made',
    props: (a, s) => ({
      crisis: crisisOf(s, a.crisisId)?.defId,
      stage: crisisOf(s, a.crisisId)?.stage,
      choice: a.choiceId,
      score: a.score,
    }),
  },
  startCrisisTalk: {
    event: 'crisis_talk_started',
    props: (a, s) => ({
      crisis: crisisOf(s, a.crisisId)?.defId,
      stage: crisisOf(s, a.crisisId)?.stage,
      choice: a.choiceId,
    }),
  },
  chooseSpecialty: { event: 'specialty_chosen', props: (a) => ({ specialty: a.specialty }) },
  setPartnership: { event: 'partnership_set', props: (a) => ({ partnership: a.partnershipId, on: a.on }) },
  lobby: { event: 'lobbied' },
  setDepartment: { event: 'department_set', props: (a) => ({ department: a.departmentId, on: a.on }) },
  acquireFirm: { event: 'firm_acquired', props: (a) => ({ target_firm: a.targetFirmId }) },
  ipo: { event: 'ipo_launched' },
  renegotiateContract: { event: 'contract_renegotiated', props: (a, s) => ({ customer: customerOf(s, a.contractId) }) },
  cancelContract: { event: 'contract_cancelled', props: (a, s) => ({ customer: customerOf(s, a.contractId) }) },
  upsellContract: {
    event: 'contract_upsold',
    props: (a, s) => ({ customer: customerOf(s, a.contractId), discipline: a.discipline, count: a.count }),
  },
  nurtureContract: { event: 'contract_nurtured', props: (a, s) => ({ customer: customerOf(s, a.contractId) }) },
  shady: {
    event: 'shady_action_taken',
    props: (a) => ({ shady_action: a.actionId, target_firm: a.targetFirmId, share: a.share }),
  },
}

/** Where the player stands right now; sent with every in-game event. */
export function gameContext(s: GameState): Props {
  const me = s.firms[s.playerId]
  return {
    quarter: s.quarter,
    difficulty: s.difficulty,
    level: firmLevel(me),
    cash: Math.round(me.cash),
    headcount: headcount(me),
    reputation: Math.round(me.reputation),
  }
}

/** Event name and properties for an action, read from the state *before* the action (ids still resolve). */
export function describeAction(action: Action, before: GameState): { event: string; props: Props } {
  const d = ACTION_EVENTS[action.type] as Describe<ActionType>
  let event = d.event
  // Starting a minigame is recorded as a zero-score attempt; it's a start, not a result.
  if (action.type === 'recordMinigame' && action.provisional) event = 'minigame_started'
  return { event, props: { action: action.type, ...d.props?.(action as never, before), ...gameContext(before) } }
}

/** Sliders dispatch on every step; these actions are sent once the player lets go. */
export function settleKey(action: Action): string | null {
  if (action.type === 'setBudgets') return `budgets:${Object.keys(action.budgets).sort().join(',')}`
  if (action.type === 'orderHires') return `hires:${action.discipline}`
  return null
}

/** Summary of the quarter that just ended, from the state after `endTurn`. */
export function quarterSummary(before: GameState, after: GameState, openTodos: number): Props {
  const me = after.firms[after.playerId]
  const report = me.history.at(-1)
  return {
    ...gameContext(after),
    quarter: before.quarter,
    revenue: report ? Math.round(report.revenue) : undefined,
    ebitda: report ? Math.round(report.ebitda) : undefined,
    utilization: report ? Math.round(report.utilization * 100) / 100 : undefined,
    hires: report?.hires,
    leavers: report?.leavers,
    fines: report ? Math.round(report.fines) : undefined,
    valuation: Math.round(valuation(me)),
    rank: playerRank(after),
    open_todos: openTodos,
    bids_open: before.tenders.filter((t) => !t.resolved && t.bids.some((b) => b.firmId === before.playerId)).length,
  }
}
