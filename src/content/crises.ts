import type { CrisisCategory, CrisisMinigame, CrisisOutcome, CrisisSeverity, Firm, GameState, Params } from '../engine/types'

/**
 * Crises: multi-quarter situations with hidden severity. Texts live in `game:crises.<id>.<stage>`.
 * Numbers per choice follow the events.ts convention (data, not tunables); the global
 * knobs (how often, how hard for AI, exposure risk) are in engine/constants.ts.
 */
export interface CrisisEffect {
  cash?: number
  /** Cash per head (negative = cost). Scales the sting with firm size. */
  cashPerHead?: number
  reputation?: number
  heat?: number
  fagmiljo?: number
  sosialt?: number
  /** Added to all pools and stars. */
  morale?: number
  brand?: number
  salaryPremium?: number
  /** Relationship with params.customer. */
  relationship?: number
  /** Satisfaction on params.contract. */
  satisfaction?: number
  /** Satisfaction on every running contract. */
  satisfactionAll?: number
  /** Loyalty of params.starId. */
  starLoyalty?: number
  /** Cut in params.contract's rate multiplier, e.g. 0.08. */
  rateCut?: number
  /** Share of params.contract's quarterly revenue added to cash (negative = lost). */
  contractRevenue?: number
  /** Share of headcount (at least one person) taken off billable work this quarter. */
  bench?: number
  /** params.starId off billable work this quarter. */
  benchStar?: boolean
  /** params.starId leaves the firm. */
  loseStar?: boolean
  /** People who quit, from params.discipline or the biggest pool. */
  leavers?: number
  /** People who join right away in params.discipline. */
  hires?: number
  /** params.contract ends now. */
  terminate?: boolean
  /** Morale penalty that fades over a few quarters, like after a scandal. */
  scandal?: number
}

export type SeverityEffect = CrisisEffect | { low?: CrisisEffect; high?: CrisisEffect }

export interface CrisisChoice {
  id: string
  effect?: CrisisEffect
  /** Extra effect when the hidden severity is low / high. */
  low?: CrisisEffect
  high?: CrisisEffect
  /** Next stage, opens next quarter. No `next` ends the crisis with `outcome`. */
  next?: string
  outcome?: CrisisOutcome | { low: CrisisOutcome; high: CrisisOutcome }
  /** Hushed up: the crisis may resurface as a scandal later. */
  bury?: boolean
  /** Picked when the stage is left unanswered. Exactly one per stage and severity; never has a cost or needs. */
  fallback?: boolean
  /** Only offered at this severity (in stages that reveal it). */
  only?: CrisisSeverity
  /** Choice needs this param to still be valid (star still here, contract still running…). */
  needs?: 'star' | 'contract' | 'customer'
  /** Plays a crisis talk first; the score adds `talkGood` (≥ CRISIS_TALK_GOOD) or `talkBad` (< CRISIS_TALK_BAD). */
  talk?: CrisisMinigame
  talkGood?: CrisisEffect
  talkBad?: CrisisEffect
}

export interface CrisisStage {
  id: string
  /** The stage text (and choices) differ by severity: this is where the player learns how bad it is. */
  reveals?: boolean
  /** Applied when the stage opens. */
  onEnter?: SeverityEffect
  /** Decided by the engine when the stage opens, no choice: params.contract's satisfaction vs. CRISIS_CLIENT_STAY. */
  route?: { pass: string; fail: string }
  choices: CrisisChoice[]
}

export interface CrisisCtx {
  state: GameState
  firm: Firm
}

export interface CrisisDef {
  id: string
  category: CrisisCategory
  minLevel: number
  weight: number
  /** Minimum quarters between two of these for the player. */
  cooldown: number
  /** Chance the hidden severity is high. */
  highChance: number
  /** market: hits every firm at once and starts `trend`. */
  scope?: 'firm' | 'market'
  trend?: string
  /** Extra params (customer, contract, star, discipline…). Return null to skip. */
  params?: (ctx: CrisisCtx, pick: <T>(xs: readonly T[]) => T) => Params | null
  /** First stage is stages[0]. */
  stages: CrisisStage[]
}

// ---- params helpers ----

/** A running contract with at least two quarters left, so the crisis can play out on it. */
const someContract: CrisisDef['params'] = ({ state, firm }, pick) => {
  const cs = state.contracts.filter(
    (c) => c.firmId === firm.id && !c.terminated && c.startQuarter <= state.quarter && state.quarter + 1 < c.endQuarter,
  )
  if (!cs.length) return null
  const c = pick(cs)
  return { contract: c.id, customer: c.customerId }
}

const privateContract: CrisisDef['params'] = (ctx, pick) => {
  const { state, firm } = ctx
  const cs = state.contracts.filter(
    (c) =>
      c.firmId === firm.id &&
      !c.terminated &&
      c.startQuarter <= state.quarter &&
      state.quarter + 1 < c.endQuarter &&
      state.customers[c.customerId]?.sector === 'private',
  )
  if (!cs.length) return null
  const c = pick(cs)
  const d = biggestDiscipline(firm)
  return { contract: c.id, customer: c.customerId, discipline: d }
}

const someStar: CrisisDef['params'] = ({ firm }, pick) => {
  const stars = firm.stars.filter((s) => !s.founder)
  if (!stars.length) return null
  const s = pick(stars)
  return { starId: s.id, name: s.name }
}

/** A contract plus the most senior person to send (founders first). */
const contractWithPartner: CrisisDef['params'] = (ctx, pick) => {
  const base = someContract(ctx, pick)
  if (!base) return null
  const partner = [...ctx.firm.stars].sort((a, b) => Number(!!b.founder) - Number(!!a.founder) || b.level - a.level)[0]
  return partner ? { ...base, starId: partner.id, name: partner.name } : base
}

function biggestDiscipline(firm: Firm): string {
  return Object.entries(firm.pools).sort((a, b) => b[1].count - a[1].count)[0][0]
}

const discipline: CrisisDef['params'] = ({ firm }) => {
  const pools = Object.entries(firm.pools).filter(([, p]) => p.count >= 3)
  if (!pools.length) return null
  return { discipline: pools.sort((a, b) => b[1].count - a[1].count)[0][0] }
}

const withCustomer: CrisisDef['params'] = (ctx, pick) => someContract(ctx, pick) ?? {}

// ---- the crises ----

export const CRISES: CrisisDef[] = [
  // HR
  {
    id: 'whistleblower',
    category: 'hr',
    minLevel: 2,
    weight: 1,
    cooldown: 16,
    highChance: 0.4,
    params: someStar,
    stages: [
      {
        id: 'report',
        choices: [
          { id: 'investigate', effect: { cashPerHead: -8_000, benchStar: true, fagmiljo: 2 }, needs: 'star', next: 'verdict' },
          { id: 'talk', effect: {}, needs: 'star', next: 'verdict' },
          { id: 'drawer', effect: {}, bury: true, outcome: 'ok', fallback: true },
        ],
      },
      {
        id: 'verdict',
        reveals: true,
        choices: [
          { id: 'clear', only: 'low', effect: { starLoyalty: 10, morale: 3 }, outcome: 'good', fallback: true },
          { id: 'mediate', only: 'low', effect: { cash: -60_000, sosialt: 5, morale: 2 }, outcome: 'good' },
          { id: 'let_go', only: 'high', effect: { loseStar: true, morale: 5, reputation: 2 }, needs: 'star', outcome: 'ok' },
          {
            id: 'townhall',
            only: 'high',
            effect: { starLoyalty: -10 },
            talk: 'townhall',
            talkGood: { morale: 3, sosialt: 2 },
            talkBad: { morale: -6, heat: 8 },
            outcome: 'ok',
          },
          { id: 'stand_by', only: 'high', effect: { morale: -8, heat: 12 }, bury: true, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },
  {
    id: 'team_feud',
    category: 'hr',
    minLevel: 1,
    weight: 1.2,
    cooldown: 12,
    highChance: 0.4,
    params: discipline,
    stages: [
      {
        id: 'feud',
        choices: [
          {
            id: 'townhall',
            talk: 'townhall',
            talkGood: { morale: 2, sosialt: 2 },
            talkBad: { morale: -4 },
            next: 'truce',
          },
          { id: 'split', effect: { bench: 0.05, fagmiljo: -2 }, next: 'truce' },
          { id: 'pick_side', effect: { morale: -4 }, low: { fagmiljo: 3 }, outcome: 'ok' },
          { id: 'wait', effect: {}, next: 'truce', fallback: true },
        ],
      },
      {
        id: 'truce',
        reveals: true,
        onEnter: { high: { leavers: 1 } },
        choices: [
          { id: 'celebrate', only: 'low', effect: { cash: -40_000, sosialt: 4 }, outcome: 'good' },
          { id: 'move_on', only: 'low', effect: {}, outcome: 'good', fallback: true },
          { id: 'counteroffer', only: 'high', effect: { cashPerHead: -6_000, morale: 3 }, outcome: 'ok' },
          { id: 'let_them_go', only: 'high', effect: { leavers: 2, morale: -3 }, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },

  // Customers
  {
    id: 'client_exit',
    category: 'client',
    minLevel: 1,
    weight: 1.3,
    cooldown: 8,
    highChance: 0.5,
    params: contractWithPartner,
    stages: [
      {
        id: 'warning',
        choices: [
          { id: 'send_partner', effect: { benchStar: true, satisfaction: 12, relationship: 3 }, needs: 'star', next: 'decision' },
          { id: 'discount', effect: { rateCut: 0.08, satisfaction: 15 }, needs: 'contract', next: 'decision' },
          {
            id: 'rescue_meeting',
            talk: 'client',
            needs: 'contract',
            talkGood: { satisfaction: 11, relationship: 2 },
            talkBad: { satisfaction: -6 },
            effect: { satisfaction: 6 },
            next: 'decision',
          },
          { id: 'graceful_exit', effect: { terminate: true, relationship: 12, reputation: 1 }, needs: 'contract', outcome: 'ok' },
          { id: 'do_nothing', effect: { satisfaction: -5 }, next: 'decision', fallback: true },
        ],
      },
      { id: 'decision', route: { pass: 'stayed', fail: 'left' }, choices: [] },
      {
        id: 'stayed',
        choices: [
          { id: 'thank', effect: { cash: -30_000, relationship: 6 }, outcome: 'good' },
          { id: 'move_on', effect: {}, outcome: 'good', fallback: true },
        ],
      },
      {
        id: 'left',
        onEnter: { terminate: true, relationship: -10 },
        choices: [
          { id: 'ask_feedback', effect: { relationship: 10, fagmiljo: 2 }, outcome: 'ok' },
          { id: 'badmouth', effect: { heat: 10, reputation: -2, sosialt: 2 }, outcome: 'bad' },
          { id: 'accept', effect: {}, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },
  {
    id: 'client_insolvent',
    category: 'client',
    minLevel: 2,
    weight: 0.8,
    cooldown: 16,
    highChance: 0.45,
    params: privateContract,
    stages: [
      {
        id: 'unpaid',
        choices: [
          { id: 'keep_working', effect: { relationship: 4 }, next: 'verdict', fallback: true },
          { id: 'stop_work', effect: { terminate: true, contractRevenue: -0.5, relationship: -10 }, needs: 'contract', outcome: 'ok' },
          { id: 'factoring', effect: { contractRevenue: -0.3, relationship: -3 }, needs: 'contract', outcome: 'ok' },
        ],
      },
      {
        id: 'verdict',
        reveals: true,
        onEnter: { low: { relationship: 8 }, high: { terminate: true, contractRevenue: -1 } },
        choices: [
          { id: 'thank', only: 'low', effect: { relationship: 4 }, outcome: 'good', fallback: true },
          { id: 'hire_team', only: 'high', effect: { hires: 2, cashPerHead: -2_000, reputation: 1 }, outcome: 'ok' },
          { id: 'claim', only: 'high', effect: { contractRevenue: 0.25, heat: 3 }, outcome: 'bad' },
          { id: 'write_off', only: 'high', effect: {}, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },

  // Macro (market-wide)
  {
    id: 'ai_act',
    category: 'macro',
    minLevel: 2,
    weight: 0.5,
    cooldown: 40,
    highChance: 0.5,
    scope: 'market',
    trend: 'ai_act_freeze',
    stages: [
      {
        id: 'ruling',
        choices: [
          { id: 'reskill', effect: { bench: 0.08, cashPerHead: -8_000, fagmiljo: 8, reputation: 2 }, outcome: 'good' },
          { id: 'layoff', effect: { leavers: 2, morale: -6, reputation: -2 }, outcome: 'ok' },
          { id: 'wait', effect: {}, next: 'second_wave', fallback: true },
        ],
      },
      {
        id: 'second_wave',
        reveals: true,
        onEnter: { high: { satisfactionAll: -6 } },
        choices: [
          { id: 'relax', only: 'low', effect: { morale: 2 }, outcome: 'good', fallback: true },
          { id: 'cut_prices', only: 'high', effect: { cashPerHead: -12_000, satisfactionAll: 6 }, outcome: 'ok' },
          { id: 'ride_it_out', only: 'high', effect: { morale: -5 }, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },
  {
    id: 'krone_crash',
    category: 'macro',
    minLevel: 3,
    weight: 0.5,
    cooldown: 40,
    highChance: 0.5,
    scope: 'market',
    trend: 'krone_crash',
    stages: [
      {
        id: 'crash',
        choices: [
          { id: 'hedge', effect: { cashPerHead: -10_000 }, outcome: 'good' },
          { id: 'pass_on', effect: { cashPerHead: 8_000, satisfactionAll: -7 }, outcome: 'ok' },
          { id: 'absorb', effect: {}, next: 'bill', fallback: true },
        ],
      },
      {
        id: 'bill',
        reveals: true,
        onEnter: { low: { cashPerHead: -6_000 }, high: { cashPerHead: -25_000 } },
        choices: [
          { id: 'cut_perks', effect: { cashPerHead: 8_000, sosialt: -6, morale: -2 }, outcome: { low: 'ok', high: 'bad' } },
          { id: 'swallow', effect: {}, outcome: { low: 'good', high: 'ok' }, fallback: true },
        ],
      },
    ],
  },

  // Disasters
  {
    id: 'basement_flood',
    category: 'disaster',
    minLevel: 1,
    weight: 1,
    cooldown: 20,
    highChance: 0.4,
    params: withCustomer,
    stages: [
      {
        id: 'flood',
        choices: [
          { id: 'rent_space', effect: { cashPerHead: -12_000 }, next: 'insurance' },
          { id: 'remote', effect: { sosialt: -6 }, next: 'insurance' },
          { id: 'client_office', effect: { relationship: 5, sosialt: -4, fagmiljo: -2 }, needs: 'customer', next: 'insurance' },
          { id: 'wing_it', effect: { bench: 0.1, morale: -4 }, next: 'insurance', fallback: true },
        ],
      },
      {
        id: 'insurance',
        reveals: true,
        onEnter: { high: { cashPerHead: -15_000 } },
        choices: [
          { id: 'paperwork', effect: { bench: 0.03 }, low: { cashPerHead: 8_000 }, high: { cashPerHead: 20_000 }, outcome: 'good' },
          { id: 'forget', effect: {}, outcome: { low: 'good', high: 'bad' }, fallback: true },
        ],
      },
    ],
  },
  {
    id: 'power_outage',
    category: 'disaster',
    minLevel: 1,
    weight: 1,
    cooldown: 16,
    highChance: 0.45,
    params: withCustomer,
    stages: [
      {
        id: 'dark',
        choices: [
          { id: 'generator', effect: { cashPerHead: -5_000 }, outcome: 'good' },
          { id: 'cabin', effect: { cashPerHead: -9_000, sosialt: 8, bench: 0.04 }, outcome: 'good' },
          { id: 'pause', effect: { bench: 0.08 }, next: 'deadline', fallback: true },
        ],
      },
      {
        id: 'deadline',
        reveals: true,
        choices: [
          { id: 'shrug', only: 'low', effect: {}, outcome: 'good', fallback: true },
          { id: 'weekend_push', only: 'high', effect: { morale: -5, satisfaction: 4 }, needs: 'contract', outcome: 'ok' },
          { id: 'cake', only: 'high', effect: { cash: -40_000, relationship: 3, satisfaction: -4 }, needs: 'contract', outcome: 'ok' },
          { id: 'miss_it', only: 'high', effect: { satisfaction: -12, relationship: -3 }, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },

  // Security
  {
    id: 'data_leak',
    category: 'security',
    minLevel: 2,
    weight: 1,
    cooldown: 16,
    highChance: 0.45,
    params: someContract,
    stages: [
      {
        id: 'discovery',
        choices: [
          { id: 'disclose', effect: { relationship: -5, reputation: -1 }, next: 'fallout' },
          { id: 'forensics', effect: { cashPerHead: -10_000, fagmiljo: 2 }, next: 'assessment' },
          { id: 'quiet_fix', effect: { bench: 0.03 }, bury: true, outcome: 'ok', fallback: true },
        ],
      },
      {
        id: 'assessment',
        reveals: true,
        choices: [
          { id: 'close_quietly', only: 'low', effect: {}, outcome: 'good', fallback: true },
          { id: 'disclose_anyway', only: 'low', effect: { relationship: 5, reputation: 2 }, outcome: 'good' },
          { id: 'disclose', only: 'high', effect: { relationship: -4 }, next: 'fallout' },
          { id: 'bury', only: 'high', effect: {}, bury: true, outcome: 'bad', fallback: true },
        ],
      },
      {
        id: 'fallout',
        reveals: true,
        onEnter: { low: { reputation: -1 }, high: { reputation: -5, relationship: -6 } },
        choices: [
          {
            id: 'press_conference',
            talk: 'press',
            talkGood: { reputation: 3, brand: 1 },
            talkBad: { reputation: -4, heat: 5 },
            outcome: 'ok',
          },
          { id: 'apology_tour', effect: { cashPerHead: -6_000, relationship: 8, satisfaction: 5 }, needs: 'customer', outcome: { low: 'good', high: 'ok' } },
          { id: 'lie_low', effect: {}, outcome: { low: 'ok', high: 'bad' }, fallback: true },
        ],
      },
    ],
  },
  {
    id: 'ransomware',
    category: 'security',
    minLevel: 3,
    weight: 0.8,
    cooldown: 20,
    highChance: 0.45,
    stages: [
      {
        id: 'locked',
        choices: [
          { id: 'pay_ransom', effect: { cashPerHead: -15_000, heat: 10 }, high: { bench: 0.04 }, bury: true, outcome: 'ok' },
          { id: 'rebuild', effect: { bench: 0.08, fagmiljo: 5 }, next: 'restore' },
          { id: 'spreadsheets', effect: { bench: 0.04, morale: -4 }, next: 'restore', fallback: true },
        ],
      },
      {
        id: 'restore',
        reveals: true,
        choices: [
          { id: 'celebrate', only: 'low', effect: { cash: -30_000, sosialt: 4 }, outcome: 'good' },
          { id: 'move_on', only: 'low', effect: {}, outcome: 'good', fallback: true },
          { id: 'estimate_cautious', only: 'high', effect: { cashPerHead: -12_000 }, outcome: 'ok' },
          {
            id: 'press_conference',
            only: 'high',
            talk: 'press',
            talkGood: { reputation: 2, brand: 1 },
            talkBad: { reputation: -4 },
            effect: { cashPerHead: -6_000 },
            outcome: 'ok',
          },
          { id: 'estimate_generous', only: 'high', effect: { satisfactionAll: -5 }, outcome: 'ok', fallback: true },
        ],
      },
    ],
  },

  // On the engagement
  {
    id: 'prod_outage',
    category: 'engagement',
    minLevel: 1,
    weight: 1.3,
    cooldown: 8,
    highChance: 0.5,
    params: someContract,
    stages: [
      {
        id: 'outage',
        choices: [
          { id: 'war_room', effect: { bench: 0.05, satisfaction: 6, morale: -3 }, needs: 'contract', next: 'postmortem' },
          { id: 'blameless', effect: { fagmiljo: 3 }, next: 'postmortem' },
          { id: 'blame_vendor', effect: { heat: 8, satisfaction: 3 }, bury: true, outcome: 'ok' },
          { id: 'wait_it_out', effect: { satisfaction: -12 }, next: 'postmortem', fallback: true },
        ],
      },
      {
        id: 'postmortem',
        reveals: true,
        choices: [
          { id: 'gracious', only: 'low', effect: { relationship: 6 }, outcome: 'good', fallback: true },
          { id: 'told_you', only: 'low', effect: { relationship: -3, fagmiljo: 3 }, outcome: 'good' },
          {
            id: 'own_it',
            only: 'high',
            talk: 'client',
            needs: 'contract',
            talkGood: { satisfaction: 6, relationship: 2 },
            talkBad: { satisfaction: -10 },
            outcome: 'ok',
          },
          { id: 'credit_note', only: 'high', effect: { contractRevenue: -0.25, satisfaction: 12 }, needs: 'contract', outcome: 'ok' },
          { id: 'move_on', only: 'high', effect: { satisfaction: -10 }, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },
  {
    id: 'slack_slip',
    category: 'engagement',
    minLevel: 1,
    weight: 1.2,
    cooldown: 12,
    highChance: 0.45,
    params: someContract,
    stages: [
      {
        id: 'message',
        choices: [
          { id: 'apologize', effect: { relationship: -2 }, next: 'reaction' },
          { id: 'swap_consultant', effect: { satisfaction: 4, morale: -4 }, needs: 'contract', next: 'reaction' },
          { id: 'gif', effect: {}, low: { relationship: 5, sosialt: 3 }, high: { relationship: -12, satisfaction: -8 }, outcome: { low: 'good', high: 'bad' } },
          { id: 'pretend', effect: { relationship: -5 }, next: 'reaction', fallback: true },
        ],
      },
      {
        id: 'reaction',
        reveals: true,
        choices: [
          { id: 'cake', only: 'low', effect: { cash: -20_000, relationship: 4 }, outcome: 'good' },
          { id: 'move_on', only: 'low', effect: {}, outcome: 'good', fallback: true },
          {
            id: 'exec_apology',
            only: 'high',
            talk: 'client',
            needs: 'contract',
            talkGood: { relationship: 5, satisfaction: 5 },
            talkBad: { relationship: -8 },
            outcome: 'ok',
          },
          { id: 'let_go', only: 'high', effect: { leavers: 1, morale: -6, relationship: 6 }, outcome: 'ok' },
          { id: 'stonewall', only: 'high', effect: { satisfaction: -15 }, outcome: 'bad', fallback: true },
        ],
      },
    ],
  },
]

export const CRISIS_MAP: Record<string, CrisisDef> = Object.fromEntries(CRISES.map((c) => [c.id, c]))

/**
 * A hushed-up crisis that resurfaces. Shared by all crises; the text names the crisis.
 * Not in CRISIS_MAP stages – the engine adds it (see crisisStage).
 */
export const EXPOSED_STAGE: CrisisStage = {
  id: 'exposed',
  // Clients read the papers too.
  onEnter: { reputation: -8, scandal: 8, heat: 15, satisfactionAll: -5 },
  choices: [
    { id: 'apologize', effect: { cashPerHead: -5_000, reputation: 2, morale: 3 }, outcome: 'bad' },
    {
      id: 'press_conference',
      talk: 'press',
      talkGood: { reputation: 2 },
      talkBad: { reputation: -3, heat: 8 },
      outcome: 'bad',
    },
    { id: 'deny', effect: { heat: 10 }, outcome: 'bad', fallback: true },
  ],
}
