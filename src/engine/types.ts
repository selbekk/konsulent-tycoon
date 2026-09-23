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

export interface Star {
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
  /** 1–MAX_LEVEL, only goes up; see levels.ts. Missing in early saves (derived from stats). */
  level?: number
  /** Quarter the player last levelled up, so the report can celebrate it. */
  levelUpQuarter?: number
  /** Tenders won in total (framework ranks count). */
  tendersWon?: number
  /** Running totals for missions. */
  stats?: { publicWins?: number; frameworkWins?: number; biggestWin?: number; awards?: number; acquisitions?: number }
  /** Mission ids completed (see content/missions.ts). */
  missionsDone?: string[]
  specialty?: Specialty
  /** Partnership ids (content/strategy.ts) running this quarter. */
  partnerships?: string[]
  lastLobbyQuarter?: number
  /** Department ids (content/strategy.ts) running this quarter. */
  departments?: string[]
  /** Set once the firm is listed on the stock exchange. */
  listed?: { quarter: number; share: number }
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
}

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
  /** Event id → last quarter it fired. */
  eventHistory: Record<string, number>
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
  | { type: 'fire'; firmId: FirmId; discipline: Discipline; count: number }
  | { type: 'hireStar'; firmId: FirmId; starId: string }
  | { type: 'giveRaise'; firmId: FirmId; starId: string; amount: number }
  | { type: 'placeBid'; tenderId: string; bid: Bid }
  | { type: 'withdrawBid'; firmId: FirmId; tenderId: string }
  | { type: 'recordMinigame'; firmId: FirmId; tenderId: string; kind: MinigameKind; score: number; provisional?: boolean }
  | { type: 'resolveEvent'; pendingEventId: string; choiceId: string }
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
