import type { Firm, GameState, Params } from '../engine/types'

export interface Effect {
  cash?: number
  /** Cash per head (negative = cost). */
  cashPerHead?: number
  reputation?: number
  heat?: number
  fagmiljo?: number
  sosialt?: number
  /** Added to all pools and stars. */
  morale?: number
  brand?: number
  salaryPremium?: number
  /** Relationship change with params.customer */
  relationship?: number
  /** Loyalty change for params.starId */
  starLoyalty?: number
  starPremium?: number
  /** Special handlers in engine/events.ts */
  special?: 'grant_remote' | 'acquire_agency' | 'hire_interns' | 'poach_match' | 'poach_let_go' | 'poach_podcast'
}

export interface EventChoice {
  id: string
  effect: Effect
  /** Choice disabled if the firm can't afford this. */
  minCash?: number
}

export interface EventCtx {
  state: GameState
  firm: Firm
  headcount: number
  utilization: number
  morale: number
}

export interface EventDef {
  id: string
  weight: number
  /** Minimum quarters between two occurrences. Infinity = one-shot. */
  cooldown: number
  minQuarter?: number
  condition?: (ctx: EventCtx) => boolean
  /** Extra params for texts and effects (star, customer…). Return null to skip the event. */
  params?: (ctx: EventCtx, pick: <T>(xs: readonly T[]) => T) => Params | null
  choices: EventChoice[]
  /** Not drawn randomly – created by the engine. */
  special?: boolean
}

const activeCustomer: EventDef['params'] = ({ state, firm }, pick) => {
  const ids = state.contracts
    .filter((c) => c.firmId === firm.id && !c.terminated && c.startQuarter <= state.quarter && state.quarter < c.endQuarter)
    .map((c) => c.customerId)
  return ids.length ? { customer: pick(ids) } : null
}

const someStar: EventDef['params'] = ({ firm }, pick) => {
  const stars = firm.stars.filter((s) => !s.founder)
  if (!stars.length) return null
  const s = pick(stars)
  return { starId: s.id, name: s.name }
}

const someRival: EventDef['params'] = ({ state, firm }, pick) => {
  const rivals = state.firmOrder.filter((id) => id !== firm.id && !state.firms[id].bankrupt)
  const id = pick(rivals)
  return { firm: state.firms[id].name }
}

export const EVENTS: EventDef[] = [
  { id: 'ebike_scheme', weight: 1, cooldown: Infinity, minQuarter: 2, choices: [
    { id: 'yes', effect: { cash: -150_000, sosialt: 5, morale: 3 } },
    { id: 'no', effect: { morale: -3 } },
  ] },
  { id: 'friday_1655', weight: 1.5, cooldown: 4, params: activeCustomer, choices: [
    { id: 'hero', effect: { relationship: 6, morale: -2 } },
    { id: 'ignore', effect: { relationship: -8 } },
  ] },
  { id: 'genai_pivot', weight: 1, cooldown: Infinity, minQuarter: 3, choices: [
    { id: 'rebrand', effect: { cash: -100_000, reputation: 4, fagmiljo: -5 } },
    { id: 'refuse', effect: {} },
  ] },
  { id: 'kickoff', weight: 1, cooldown: 4, condition: ({ state }) => state.quarter % 4 === 0, choices: [
    { id: 'lisbon', effect: { cashPerHead: -15_000, sosialt: 15, morale: 4 } },
    { id: 'lillestrom', effect: { cashPerHead: -3_000, sosialt: 4 } },
    { id: 'skip', effect: { morale: -4 } },
  ] },
  { id: 'competitor_cake', weight: 1, cooldown: 6, params: someRival, choices: [
    { id: 'bigger_cake', effect: { cash: -25_000, reputation: 1 } },
    { id: 'ignore', effect: {} },
  ] },
  { id: 'leaked_salary_sheet', weight: 0.8, cooldown: Infinity, minQuarter: 4, condition: ({ headcount }) => headcount >= 10, choices: [
    { id: 'raise_all', effect: { salaryPremium: 0.03, morale: 5 } },
    { id: 'deny', effect: { morale: -6, reputation: -2 } },
  ] },
  { id: 'kofa_complaint', weight: 1, cooldown: 8, params: someRival, condition: ({ state, firm }) =>
      state.contracts.some((c) => c.firmId === firm.id && c.startQuarter === state.quarter && state.customers[c.customerId]?.sector === 'public'),
    choices: [
      { id: 'lawyer', effect: { cash: -200_000 } },
      { id: 'shrug', effect: { reputation: -4 } },
    ] },
  { id: 'hackathon', weight: 1, cooldown: 4, choices: [
    { id: 'host', effect: { cash: -80_000, fagmiljo: 8, reputation: 2 } },
    { id: 'skip', effect: {} },
  ] },
  { id: 'conference_talk', weight: 1, cooldown: 3, condition: ({ firm }) => firm.stars.length > 0, choices: [
    { id: 'send', effect: { cash: -40_000, reputation: 3, fagmiljo: 2 } },
    { id: 'skip', effect: {} },
  ] },
  { id: 'burnout_wave', weight: 3, cooldown: 3, condition: ({ utilization }) => utilization > 0.95, choices: [
    { id: 'relief', effect: { cash: -300_000, morale: 8 } },
    { id: 'push', effect: { morale: -10 } },
  ] },
  { id: 'star_wants_remote', weight: 2, cooldown: 2, params: ({ firm }, pick) => {
      const stars = firm.stars.filter((s) => !s.remoteGranted && (s.ambition === 'remote' || s.traits.includes('remote_hardliner')))
      if (!stars.length) return null
      const s = pick(stars)
      return { starId: s.id, name: s.name }
    }, choices: [
      { id: 'grant', effect: { special: 'grant_remote', sosialt: -1 } },
      { id: 'deny', effect: { starLoyalty: -15 } },
    ] },
  { id: 'acquisition_offer', weight: 1, cooldown: 8, minQuarter: 8, condition: ({ firm }) => firm.cash > 8_000_000, choices: [
    { id: 'acquire', effect: { cash: -4_000_000, special: 'acquire_agency' }, minCash: 4_000_000 },
    { id: 'decline', effect: {} },
  ] },
  { id: 'influencer_post_viral', weight: 0.7, cooldown: 6, choices: [{ id: 'nice', effect: { brand: 8, reputation: 2 } }] },
  { id: 'office_ping_pong', weight: 0.8, cooldown: Infinity, choices: [
    { id: 'buy', effect: { cash: -30_000, sosialt: 4 } },
    { id: 'no', effect: {} },
  ] },
  { id: 'javazone_booth', weight: 1, cooldown: 4, condition: ({ state }) => state.quarter % 4 === 2, choices: [
    { id: 'booth', effect: { cash: -250_000, brand: 6, reputation: 2 } },
    { id: 'skip', effect: {} },
  ] },
  { id: 'tax_audit', weight: 3, cooldown: 6, condition: ({ firm }) => firm.heat > 50, choices: [
    { id: 'cooperate', effect: { cash: -300_000, heat: -20 } },
    { id: 'stall', effect: { heat: 10, reputation: -3 } },
  ] },
  { id: 'glassdoor_review', weight: 2, cooldown: 4, condition: ({ morale }) => morale < 50, choices: [
    { id: 'respond', effect: { reputation: 1 } },
    { id: 'ignore', effect: { reputation: -3 } },
  ] },
  { id: 'client_wants_chatbot', weight: 1, cooldown: 4, params: activeCustomer, choices: [
    { id: 'yes', effect: { relationship: 5, fagmiljo: -3 } },
    { id: 'no', effect: { relationship: -3 } },
  ] },
  { id: 'pizza_budget_cut', weight: 0.8, cooldown: 6, choices: [
    { id: 'cut', effect: { cash: 20_000, sosialt: -4 } },
    { id: 'keep', effect: {} },
  ] },
  { id: 'christmas_party', weight: 5, cooldown: 4, condition: ({ state }) => state.quarter % 4 === 3, choices: [
    { id: 'fancy', effect: { cashPerHead: -6_000, sosialt: 10 } },
    { id: 'potluck', effect: { sosialt: 2 } },
    { id: 'cancel', effect: { sosialt: -8, morale: -5 } },
  ] },
  { id: 'intern_program', weight: 2, cooldown: 4, condition: ({ state }) => state.quarter % 4 === 1, choices: [
    { id: 'start', effect: { cash: -150_000, special: 'hire_interns', fagmiljo: 2 } },
    { id: 'skip', effect: {} },
  ] },
  { id: 'open_source_fame', weight: 0.6, cooldown: 8, condition: ({ firm }) => firm.fagmiljo > 50, choices: [
    { id: 'nice', effect: { reputation: 4, brand: 4 } },
  ] },
  { id: 'cloud_credit_windfall', weight: 0.5, cooldown: 8, choices: [{ id: 'nice', effect: { cash: 200_000 } }] },
  { id: 'unionization', weight: 2, cooldown: 8, condition: ({ morale, headcount }) => morale < 45 && headcount >= 15, choices: [
    { id: 'negotiate', effect: { salaryPremium: 0.05, morale: 10 } },
    { id: 'resist', effect: { morale: -10, reputation: -4 } },
  ] },
  { id: 'fagdag_vs_billable', weight: 1.2, cooldown: 4, choices: [
    { id: 'fagdag', effect: { cashPerHead: -10_000, fagmiljo: 8 } },
    { id: 'bill', effect: { cashPerHead: 8_000, fagmiljo: -4 } },
  ] },
  { id: 'ceo_podcast', weight: 0.8, cooldown: 6, choices: [
    { id: 'record', effect: { cash: -10_000, reputation: 2 } },
    { id: 'skip', effect: {} },
  ] },
  { id: 'rebranding_agency', weight: 0.6, cooldown: Infinity, minQuarter: 6, choices: [
    { id: 'rebrand', effect: { cash: -500_000, brand: 10, reputation: 3 }, minCash: 500_000 },
    { id: 'no', effect: {} },
  ] },
  { id: 'wrong_reply_all', weight: 0.8, cooldown: 8, choices: [
    { id: 'apologize', effect: { reputation: -1 } },
    { id: 'blame_it', effect: { morale: -3 } },
  ] },
  { id: 'coffee_machine_broke', weight: 1, cooldown: 6, choices: [
    { id: 'premium', effect: { cash: -60_000, sosialt: 5, morale: 2 } },
    { id: 'cheap', effect: { sosialt: -2 } },
  ] },
  { id: 'headhunter_calls', weight: 1.5, cooldown: 3, params: someStar, choices: [
    { id: 'counter', effect: { starLoyalty: 15, starPremium: 0.05 } },
    { id: 'ignore', effect: { starLoyalty: -10 } },
  ] },
  { id: 'remote_debate', weight: 1, cooldown: 6, choices: [
    { id: 'office', effect: { sosialt: 4, morale: -2 } },
    { id: 'hybrid', effect: { morale: 3 } },
  ] },
  { id: 'security_incident', weight: 0.8, cooldown: 8, minQuarter: 4, choices: [
    { id: 'pay', effect: { cash: -400_000 } },
    { id: 'downplay', effect: { reputation: -6 } },
  ] },
  { id: 'poach_attempt', weight: 0, cooldown: 0, special: true, choices: [
    { id: 'match', effect: { special: 'poach_match' } },
    { id: 'let_go', effect: { special: 'poach_let_go' } },
    { id: 'podcast', effect: { special: 'poach_podcast' } },
  ] },
]

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]))
