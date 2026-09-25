import type { RngState } from './rng'

export const DISCIPLINES = ['frontend', 'backend', 'cloud', 'data', 'design', 'architecture', 'pm'] as const
export type Discipline = (typeof DISCIPLINES)[number]
export type FirmId = string
export type Seats = Partial<Record<Discipline, number>>
export type Params = Record<string, string | number>

export interface Pool {
  count: number
  /** Average skill level, 1–5 (fractional). */
  level: number
  /** 0–100 */
  morale: number
}

export type Ambition = 'salary' | 'growth' | 'leadership' | 'remote'

export type Gender = 'female' | 'male' | 'nonbinary'

/**
 * Who someone is outside the CV, for the people statistics. Optional: people from early saves
 * get a hash-derived fallback (engine/profile.ts). Stored as anchors, so age and experience grow by themselves.
 */
export interface Profile {
  gender?: Gender
  /** Quarter index they were born (negative: before the game started). */
  bornQuarter?: number
  /** Quarter index they started working in the industry. */
  careerStartQuarter?: number
}

export interface Star extends Profile {
  id: string
  name: string
  discipline: Discipline
  /** 3–5 */
  level: number
  traits: string[]
  ambition: Ambition
  morale: number
  loyalty: number
  salaryPremium: number
  founder?: boolean
  remoteGranted?: boolean
  assignedContractId?: string
  /** Promoted from the firm's own roster. */
  homegrown?: boolean
  /** Quarter the star joined this firm. Missing in early saves and for AI stars from the start. */
  joinedQuarter?: number
}

/**
 * One of the player's people. Only the player's firm has a roster; for it, `pools[d].count` and
 * `.level` are derived from these (see engine/roster.ts). Morale stays per pool.
 */
export interface Employee extends Profile {
  id: string
  name: string
  discipline: Discipline
  /** 1–5, fractional. */
  level: number
  /** 0–1, hidden until revealed by development or tenure. */
  potential: number
  potentialRevealed?: boolean
  /** Ids from content/quirks.ts. */
  quirks: string[]
  joinedQuarter: number
  /** On a course that finishes at the end of quarter `untilQuarter - 1`. */
  course?: { untilQuarter: number }
  mentorStarId?: string
  /** On a contract above their level. */
  stretchContractId?: string
  /** Career talk: promised to grow them by `dueQuarter`. */
  promise?: { dueQuarter: number; levelAtTalk: number }
}

export interface Budgets {
  /** NOK per head per quarter */
  fagmiljoPerHead: number
  sosialtPerHead: number
  /** Salary premium vs. market, -0.1–0.3 */
  salaryPremium: number
}

export type Archetype =
  | 'boutique_nerd'
  | 'boutique_design'
  | 'mid_generalist'
  | 'nordic_giant'
  | 'budget_bulk'
  | 'specialist_cloud'
  | 'specialist_data'

export interface IntelEntry {
  targetFirmId: FirmId
  kind: 'bids' | 'salaries' | 'mole'
  tenderId?: string
  untilQuarter: number
}

export interface ShadyLogEntry {
  id: string
  actionId: ShadyActionId
  quarter: number
  targetFirmId?: FirmId
  tenderId?: string
  contractId?: string
  detected: boolean
  /** Ongoing actions are re-rolled every quarter while active. */
  ongoing: boolean
  active: boolean
}

export interface QuarterReport {
  quarter: number
  revenue: number
  costs: number
  ebitda: number
  headcount: number
  utilization: number
  hires: number
  leavers: number
  fines: number
  /** People let go by the firm (not counted in leavers). Optional in early saves. */
  fired?: number
  /** Own people billing this quarter. Optional in early saves. */
  billed?: number
  /** Revenue from own people, for achieved hourly rate. Optional in early saves. */
  ownRevenue?: number
  /** Cash at the very end of the quarter (after fines and the bank's check). Optional in early saves. */
  cash?: number
}

export interface Firm {
  id: FirmId
  name: string
  isPlayer: boolean
  personalityId: string
  country: string
  cash: number
  /** 0–100 */
  reputation: number
  /** 0–100 */
  heat: number
  fagmiljo: number
  sosialt: number
  /** Temporary brand buff/debuff from PR actions, decays. */
  brandMod: number
  budgets: Budgets
  pools: Record<Discipline, Pool>
  stars: Star[]
  hiringOrders: Seats
  pendingHires: Seats
  negativeCashQuarters: number
  /** Out of the game: bust, or bought (then `acquiredBy` is set). */
  bankrupt: boolean
  acquiredBy?: FirmId
  /** Last 12 quarters. */
  history: QuarterReport[]
  valuationHistory: number[]
  intel: IntelEntry[]
  shadyLog: ShadyLogEntry[]
  /** Morale penalty from recent scandals, decays. */
  scandalPenalty: number
  /** Accumulated this quarter, reported in QuarterReport. */
  quarterFines: number
  quarterLeavers: number
  quarterHires: number
  quarterFired?: number
  /** `budgets.salaryPremium` when the quarter started; see `pricingPremium`. Missing in early saves. */
  quarterStartPremium?: number
  /** 1–MAX_LEVEL, only goes up; see levels.ts. Missing in early saves (derived from stats). */
  level?: number
  /** Quarter the player last levelled up, so the report can celebrate it. */
  levelUpQuarter?: number
  /** Tenders won in total (framework ranks count). */
  tendersWon?: number
  /** Running totals for missions. */
  stats?: {
    publicWins?: number
    frameworkWins?: number
    biggestWin?: number
    awards?: number
    acquisitions?: number
    /** Projects extended by a happy customer. */
    renewals?: number
    /** Best quarterly revenue so far, for the record stamp in the report. */
    bestRevenue?: number
  }
  /** Crises ended so far, by outcome (hushed-up ones count once they are over). */
  crisisOutcomes?: Partial<Record<CrisisOutcome, number>>
  /** Mission ids completed (see content/missions.ts). */
  missionsDone?: string[]
  /** Milestone ids reached, for the trophy wall (see content/milestones.ts). Player only. */
  milestones?: string[]
  specialty?: Specialty
  /** Partnership ids (content/strategy.ts) running this quarter. */
  partnerships?: string[]
  lastLobbyQuarter?: number
  /** Department ids (content/strategy.ts) running this quarter. */
  departments?: string[]
  /** Set once the firm is listed on the stock exchange. */
  listed?: { quarter: number; share: number }
  /** People taken off billable work by a crisis choice, for one quarter only. */
  benched?: { quarter: number; seats: Seats; starIds: string[] }
  /** The player's people as individuals. Missing for AI firms. */
  roster?: Employee[]
  /** Counter for roster ids and roster draws. */
  rosterSeq?: number
  lastPromotionQuarter?: number
}

export type Specialty = 'public' | 'private' | Discipline

export type MeetingStyle = 'concrete' | 'visionary' | 'humble' | 'buzzword'

export interface Customer {
  id: string
  sector: 'public' | 'private'
  budgetFactor: number
  meetingPreference: MeetingStyle
  /** Default price weight 0–1 (quality = 1 - price). */
  priceWeight: number
  relationships: Record<FirmId, number>
}

export type ContractKind = 'project' | 'framework'

export interface Bid {
  firmId: FirmId
  rateMultiplier: number
  starIds: string[]
  effort: 0 | 1 | 2 | 3
  cvPad: boolean
  ghostCv: boolean
  /** Binding promise about the start, only on key tenders. Follows the contract. */
  promise?: PromiseId
}

/** fullTeam: everyone from day one. phased: some now, the rest next quarter. discovery: a paid survey first. */
export type PromiseId = 'fullTeam' | 'phased' | 'discovery'
export const PROMISES = ['fullTeam', 'phased', 'discovery'] as const satisfies readonly PromiseId[]

/** Parts of a bid's score, used to explain why a tender was won or lost. */
export type BidFactor =
  | 'price'
  | 'cv'
  | 'fagmiljo'
  | 'meeting'
  | 'effort'
  | 'reputation'
  | 'extras'
  | 'capacity'
  | 'promise'
  | 'relationship'
  | 'priority'

export type MinigameKind = 'meeting' | 'bingo'

export interface Tender {
  id: string
  customerId: string
  kind: ContractKind
  seats: Seats
  duration: number
  priceWeight: number
  qualityWeight: number
  publishedQuarter: number
  dueQuarter: number
  buzzwords: string[]
  bids: Bid[]
  /** provisional = started but not finished; may be replaced once by the final score. */
  minigameResults: Record<FirmId, { kind: MinigameKind; score: number; provisional?: boolean }>
  resolved: boolean
  winnerIds: FirmId[]
  /** Starter contracts are pre-awarded and never shown on the board. */
  hidden?: boolean
}

export interface Contract {
  id: string
  tenderId: string
  firmId: FirmId
  customerId: string
  kind: ContractKind
  baseSeats: Seats
  activeSeats: Seats
  rateMultiplier: number
  /** Framework share (0.6/0.3/0.1), 1 for projects. */
  share: number
  rank: number
  startQuarter: number
  endQuarter: number
  starIds: string[]
  satisfaction: number
  outsourcedShare: number
  fraud: { cvPad: boolean; ghostCv: boolean; baitAndSwitch: boolean }
  terminated: boolean
  /** Seats staffed by own people / freelancers last quarter (for UI). */
  lastStaffed?: Seats
  lastFreelance?: Seats
  /** Outcome of the one rate renegotiation allowed per contract. */
  renegotiated?: 'won' | 'lost'
  /** Last upsell attempt. */
  upsell?: { quarter: number; won: boolean; seats: number }
  /** Quarter of the last customer-care push. */
  nurtureQuarter?: number
  /** Ended early by the firm itself (not the customer). */
  cancelled?: boolean
  /** Promise made in the bid, checked after the first quarter of delivery. */
  promise?: PromiseId
  promiseKept?: boolean
  /** Discovery: the agreed rate, billed once the first (reduced) quarter is delivered. */
  fullRate?: number
}

export interface ActiveTrend {
  id: string
  untilQuarter: number
}

export interface PendingEvent {
  id: string
  eventId: string
  firmId: FirmId
  params: Params
}

export type CrisisCategory = 'hr' | 'client' | 'macro' | 'disaster' | 'security' | 'engagement'
export type CrisisSeverity = 'low' | 'high'
export type CrisisOutcome = 'good' | 'ok' | 'bad'
export type CrisisMinigame = 'press' | 'townhall' | 'client'

/** A running (or recently ended) crisis for one firm. See content/crises.ts and engine/crises.ts. */
export interface Crisis {
  id: string
  defId: string
  firmId: FirmId
  /** Current stage id. */
  stage: string
  /** Rolled when the crisis starts. Hidden from the player until a stage reveals it. */
  severity: CrisisSeverity
  startQuarter: number
  /** Quarter the current stage opened. */
  stageQuarter: number
  params: Params
  /** active: a decision is open this quarter. waiting: answered, the next stage opens next quarter.
   *  buried: hushed up and may resurface. over: done (kept a while for the dashboard). */
  status: 'active' | 'waiting' | 'buried' | 'over'
  nextStage?: string
  /** Decisions so far, oldest first. */
  log: { stage: string; choiceId: string; quarter: number; auto?: boolean; score?: number }[]
  /** Set once a stage has shown the true severity. */
  revealed?: boolean
  outcome?: CrisisOutcome
  endQuarter?: number
  /** Buried: may resurface until this quarter. */
  buriedUntil?: number
  /** A crisis talk was started for this choice; reloading can't give a second try. */
  minigameStarted?: string
}

export type NewsTone = 'good' | 'bad' | 'neutral' | 'sassy'

export interface NewsItem {
  id: string
  quarter: number
  key: string
  params: Params
  tone: NewsTone
  firmId?: FirmId
  /** Only relevant for the player (quarter report), vs. market-wide news. */
  personal?: boolean
}

export interface Award {
  awardId: string
  firmId: FirmId
  year: number
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface GameState {
  saveVersion: number
  seed: number
  rng: RngState
  difficulty: Difficulty
  quarter: number
  maxQuarters: number
  playerId: FirmId
  firms: Record<FirmId, Firm>
  firmOrder: FirmId[]
  customers: Record<string, Customer>
  tenders: Tender[]
  contracts: Contract[]
  trends: ActiveTrend[]
  pendingEvents: PendingEvent[]
  news: NewsItem[]
  starMarket: Star[]
  announcement?: { key: string; params: Params }
  lastAwards: Award[]
  /** Seats customers want at game start; see marketDemand(). Optional for early saves. */
  baseDemand?: number
  /** Event id → last quarter it fired. Crisis ids are kept here too. */
  eventHistory: Record<string, number>
  /** Running and recently ended crises for all firms. Optional in early saves. */
  crises?: Crisis[]
  /** Random id for this playthrough, set by the store for analytics. The engine never reads it. Optional for early saves. */
  gameId?: string
  /**
   * Set when this is the weekly challenge (weekly.ts): everyone plays the week's seed and it can go on the
   * leaderboard. `week` is the ISO week (`'2026-W39'`); `founders` are what the game started with, for the replay.
   */
  weekly?: { week: string; founders: [Discipline, Discipline] }
  status: 'playing' | 'lost' | 'finished'
  idCounter: number
}

export type ShadyActionId =
  | 'spy_bids'
  | 'spy_salaries'
  | 'plant_mole'
  | 'afterwork_poach'
  | 'silent_outsource'
  | 'cv_pad'
  | 'ghost_cv'
  | 'bait_and_switch'
  | 'rumor'
  | 'dn_leak'
  | 'linkedin_post'

export type Action =
  | { type: 'setBudgets'; firmId: FirmId; budgets: Partial<Budgets> }
  | { type: 'orderHires'; firmId: FirmId; discipline: Discipline; count: number }
  /** With a roster, `employeeId` picks who goes; otherwise the lowest level go first. */
  | { type: 'fire'; firmId: FirmId; discipline: Discipline; count: number; employeeId?: string }
  /** Without a roster (AI), the course lifts the pool average instead of one person. */
  | { type: 'trainEmployee'; firmId: FirmId; discipline: Discipline; employeeId?: string }
  | { type: 'promoteEmployee'; firmId: FirmId; employeeId: string }
  /** No `starId` ends the mentorship. */
  | { type: 'setMentor'; firmId: FirmId; employeeId: string; starId?: string }
  /** No `contractId` ends the stretch assignment. */
  | { type: 'setStretch'; firmId: FirmId; employeeId: string; contractId?: string }
  | { type: 'careerTalk'; firmId: FirmId; employeeId: string }
  | { type: 'hireStar'; firmId: FirmId; starId: string }
  | { type: 'giveRaise'; firmId: FirmId; starId: string; amount: number }
  | { type: 'placeBid'; tenderId: string; bid: Bid }
  | { type: 'withdrawBid'; firmId: FirmId; tenderId: string }
  | { type: 'recordMinigame'; firmId: FirmId; tenderId: string; kind: MinigameKind; score: number; provisional?: boolean }
  | { type: 'resolveEvent'; pendingEventId: string; choiceId: string }
  /** `score` (0–100) only for choices with a crisis talk; see startCrisisTalk. */
  | { type: 'resolveCrisis'; firmId: FirmId; crisisId: string; choiceId: string; score?: number }
  | { type: 'startCrisisTalk'; firmId: FirmId; crisisId: string; choiceId: string }
  | { type: 'chooseSpecialty'; firmId: FirmId; specialty: Specialty }
  | { type: 'setPartnership'; firmId: FirmId; partnershipId: string; on: boolean }
  | { type: 'lobby'; firmId: FirmId }
  | { type: 'setDepartment'; firmId: FirmId; departmentId: string; on: boolean }
  | { type: 'acquireFirm'; firmId: FirmId; targetFirmId: FirmId }
  | { type: 'ipo'; firmId: FirmId }
  | { type: 'renegotiateContract'; firmId: FirmId; contractId: string }
  | { type: 'cancelContract'; firmId: FirmId; contractId: string }
  | { type: 'upsellContract'; firmId: FirmId; contractId: string; discipline: Discipline; count: number }
  | { type: 'nurtureContract'; firmId: FirmId; contractId: string }
  | {
      type: 'shady'
      firmId: FirmId
      actionId: ShadyActionId
      targetFirmId?: FirmId
      tenderId?: string
      contractId?: string
      starId?: string
      share?: number
    }

export type ActionType = Action['type']
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>

export interface ActionResult {
  state: GameState
  error?: string
}
