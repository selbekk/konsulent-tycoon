/** All balance numbers live here. Tune with `npm run sim`. */

export const SAVE_VERSION = 1
export const MAX_QUARTERS = 40
export const START_YEAR = 2027

// Economy
export const BILLABLE_HOURS = 420
export const listRate = (level: number) => 900 + 200 * level
export const annualSalary = (level: number, premium: number) => (600_000 + 150_000 * level) * (1 + premium)
export const EMPLOYER_COST_FACTOR = 1.3
export const quarterlySalaryCost = (level: number, premium: number) =>
  (annualSalary(level, premium) * EMPLOYER_COST_FACTOR) / 4
export const OVERHEAD_PER_HEAD = 30_000
export const FIXED_OVERHEAD = 90_000
export const HIRE_COST = 50_000
export const FREELANCER_LEVEL = 3
/** Own people staffed outside their discipline are billed at this level. */
export const FLEX_LEVEL = 2.2
/** Share of free people in other disciplines customers count as available. */
export const FLEX_AVAILABILITY = 0
/** Freelancers cost this share of what they are billed at (FREELANCER_LEVEL × 1.0). */
export const FREELANCER_MARKUP = 1.05
export const OFFSHORE_COST_FACTOR = 0.3
export const OFFSHORE_SATISFACTION_HIT = 8
export const FREELANCE_SATISFACTION_HIT = 3
export const RATE_MIN = 0.7
export const RATE_MAX = 1.4
export const BANKRUPT_AFTER_QUARTERS = 2
/** Credit line (kassekreditt): you can go this far below zero before the bank gets nervous. */
export const CREDIT_MIN = 2_000_000
export const CREDIT_REVENUE_SHARE = 0.5
/** Interest per quarter on negative cash. */
export const CREDIT_INTEREST = 0.03
export const HISTORY_LENGTH = 12
export const NEWS_LENGTH = 200
export const SEVERANCE_QUARTERS = 1

// Culture
export const CULTURE_DECAY = 0.85
export const CULTURE_GAIN_PER_1000 = 0.5
export const BUDGET_MAX_PER_HEAD = 40_000
export const PREMIUM_MIN = -0.1
export const PREMIUM_MAX = 0.3

// Morale & turnover
export const MORALE_BASE = 50
export const MORALE_CULTURE_WEIGHT = 0.2
export const MORALE_ADJUST_RATE = 0.3
export const TURNOVER_BASE = 0.02
export const TURNOVER_MORALE_PIVOT = 60
export const TURNOVER_MORALE_DIVISOR = 400
export const FIRE_MORALE_HIT = 3
export const SCANDAL_PENALTY_DECAY = 0.5

// Recruitment
export const HIRE_BASE_ACCEPT = 0.3
export const MAX_HIRE_ORDER = 30

// Tenders
export const EFFORT_COST = 30_000
export const FRAMEWORK_SHARES = [0.6, 0.3, 0.1]
export const RELATION_WIN = 5
export const RELATION_LOSS = -2
export const BID_NOISE = 5
/** Max quality penalty when none of the offered seats can be staffed with free people. */
export const CAPACITY_PENALTY = 30
/** Customers turn down bids below this quality, even when it is the only bid. Stops free copy-paste bids on everything. */
export const MIN_AWARD_QUALITY = 35
export const PRIORITY_BONUS = 8
/** Key tenders (frameworks and bigger projects) get a customer meeting and a promise. The rest are routine. */
export const KEY_TENDER_MIN_SEATS = 6
/** Meeting score counted on routine tenders, where nobody meets the customer. Roughly an average meeting. */
export const ROUTINE_MEETING_SCORE = 50
/** One-click offer on routine tenders: rate, and a lower one when the customer is price-driven (priceWeight > 0.6). */
export const QUICK_BID_RATE = 0.97
export const QUICK_BID_PRICE_RATE = 0.9
export const AI_MAX_OPEN_BIDS = 8
/** Happy clients often extend instead of re-tendering. */
export const RENEWAL_MIN_SATISFACTION = 60
export const RENEWAL_CHANCE = 0.5
/** Small gigs published every quarter regardless of market demand. */
export const SMALL_TENDERS_MIN = 3
export const SMALL_TENDERS_MAX = 5
export const SMALL_TENDER_MAX_SEATS = 2
export const TARGET_DEMAND_RATIO = 0.85
/** Market demand grows slowly and does not follow surviving capacity. */
export const DEMAND_GROWTH_PER_YEAR = 0.05

// Promises on key tenders
/** Bid quality for promising the whole team from day one. */
export const PROMISE_FULL_TEAM_QUALITY = 4
/** A phased start looks less keen, but customers accept that not everyone is free yet. */
export const PROMISE_PHASED_QUALITY = -2
/** Share of the capacity penalty a phased start still takes. */
export const PROMISE_PHASED_CAPACITY = 0.4
/** Bid quality when the promise is what the customer asked for (CustomerDef.wants). */
export const PROMISE_MATCH_QUALITY = 4
/** A full-team promise is kept when at most this share of seats needs freelancers, flex or offshore in the first quarter. */
export const PROMISE_FULL_TEAM_MAX_GAP = 0.1
export const PROMISE_PHASED_MAX_GAP = 0.5
export const PROMISE_KEPT_SATISFACTION = 8
export const PROMISE_BROKEN_SATISFACTION = 20
export const PROMISE_KEPT_RELATION = 3
export const PROMISE_BROKEN_RELATION = 8
/** Discovery: the first quarter bills at this share of the rate, and renewal is likelier afterwards. */
export const DISCOVERY_RATE_SHARE = 0.5
export const DISCOVERY_RENEWAL_FACTOR = 1.3
/** Customer needs: how they like to be talked to shows once the relationship is at least this good. */
export const NEEDS_STYLE_RELATION = 40
/** Explaining results: a strength is mentioned when it was worth at least this many score points. */
export const FEEDBACK_MIN_STRENGTH = 1.5

// Contract actions (cancelling and customer care are open from level 1)
/** Renegotiating the rate: once per contract, after at least one quarter of delivery. */
export const RENEGOTIATE_BASE = 0.5
/** Chance per satisfaction point above/below 60. Clamped to 0–1, so very happy clients always say yes. */
export const RENEGOTIATE_PER_SATISFACTION = 0.02
export const RENEGOTIATE_PER_RELATION = 0.004
/** Price-sensitive customers resist: chance falls by this times (priceWeight − 0.5). */
export const RENEGOTIATE_PRICE_WEIGHT = 0.6
export const RENEGOTIATE_RATE_GAIN = 0.08
/** Even a yes stings a little. */
export const RENEGOTIATE_WIN_SATISFACTION = 5
export const RENEGOTIATE_FAIL_SATISFACTION = 12
export const RENEGOTIATE_FAIL_RELATION = 6
/** Walking away early: pay this many quarters of the contract's revenue. */
export const CANCEL_FEE_QUARTERS = 1
export const CANCEL_RELATION_HIT = 25
export const CANCEL_REPUTATION_HIT = 2
/** Upsell: offer more people on a running project. Seats bill from this quarter. */
export const UPSELL_BASE = 0.4
export const UPSELL_PER_SATISFACTION = 0.02
/** Each seat beyond the first makes a yes less likely. */
export const UPSELL_PER_EXTRA_SEAT = 0.12
export const UPSELL_MAX_SEATS = 3
export const UPSELL_COOLDOWN = 4
export const UPSELL_FAIL_SATISFACTION = 5
/** Customer care: a rescue tool, so it only lifts satisfaction up to a cap. */
export const NURTURE_COST_MIN = 50_000
export const NURTURE_COST_SHARE = 0.04
export const NURTURE_SATISFACTION = 10
export const NURTURE_RELATION = 3
export const NURTURE_MAX_SATISFACTION = 75
export const NURTURE_COOLDOWN = 2
/** The to-do list flags contracts below this satisfaction (termination risk starts at 30). */
export const NURTURE_TODO_BELOW = 40

// Quarter to-do list
/** Idle people next quarter (share of headcount) before "bid on tenders" is flagged. */
export const TODO_IDLE_SHARE = 0.2
export const TODO_IDLE_MIN = 2
/** Only suggest hiring when cash plus half the credit line covers this many quarters of costs. */
export const TODO_HIRE_MIN_RUNWAY = 1

// Firm levels
/**
 * A firm reaches a level by meeting any one of its goals: headcount, revenue last quarter,
 * or tenders won in total. Levels never go down. `maxSeats` caps the tenders it may bid on.
 * Level 1 is the start; its goals are unused.
 */
export const LEVELS = [
  { headcount: 0, revenue: 0, tendersWon: 0, maxSeats: 6 },
  { headcount: 9, revenue: 5_500_000, tendersWon: 3, maxSeats: 12 },
  { headcount: 16, revenue: 9_000_000, tendersWon: 8, maxSeats: 20 },
  { headcount: 26, revenue: 14_000_000, tendersWon: 15, maxSeats: Infinity },
  { headcount: 40, revenue: 22_000_000, tendersWon: 25, maxSeats: Infinity },
] as const
export const MAX_LEVEL = LEVELS.length
/** Level at which each feature opens. Backroom tricks have their own `minLevel` in SHADY_CATALOG. */
export const FEATURE_LEVEL = {
  kpis: 2,
  culture: 2,
  stars: 2,
  // Level 3 made the early game clearly harder for the sim bot (see docs/balance-log.md).
  framework: 2,
  renegotiate: 2,
  bingo: 3,
  upsell: 3,
  backroom: 3,
  strategy: 3,
  partnerships: 4,
  departments: 4,
  acquisitions: 5,
  ipo: 5,
} as const
/** Every level-up is a move to a bigger office: a one-off lift for social culture and employer brand. */
export const OFFICE_MOVE_SOSIALT = 5
export const OFFICE_MOVE_BRAND = 3
/** The player can't touch culture budgets at level 1, so start from what a sensible player picks. */
export const PLAYER_START_BUDGETS = { fagmiljoPerHead: 15_000, sosialtPerHead: 12_000, salaryPremium: 0.02 }

// Strategy
/** Bid quality bonus when a tender matches the firm's specialty. Sector specialties match about half the tenders. */
export const SPECIALTY_SECTOR_BONUS = 4
export const SPECIALTY_DISCIPLINE_BONUS = 8
/** A discipline specialty matches tenders where it is at least this share of the seats. */
export const SPECIALTY_DISCIPLINE_SHARE = 0.5
/** Picking the first specialty is free; changing it later costs this. */
export const SPECIALTY_CHANGE_COST = 1_000_000
export const PARTNER_BONUS = 3
export const MAX_PARTNERSHIPS = 2
/** Lobbying: a round of lunches with every public-sector customer. */
export const LOBBY_COST = 600_000
export const LOBBY_RELATION = 4
export const LOBBY_COOLDOWN = 4
/** Academy: pool levels grow this much per quarter, up to the cap. */
export const ACADEMY_LEVEL_GAIN = 0.04
export const ACADEMY_MAX_LEVEL = 4.2
/** Sales department: bid quality on every bid. */
export const SALES_BID_BONUS = 3
/** Nearshore centre: freelancers cost this share of what they bill, instead of FREELANCER_MARKUP. */
export const NEARSHORE_FREELANCER_MARKUP = 0.85
/** Acquisitions: the price floor per head (the acquire_agency event pays 500k per head too). */
export const ACQUIRE_PRICE_PER_HEAD = 500_000
/** Premium over what the business is worth without its cash. */
export const ACQUIRE_PREMIUM = 1.2
/** The target can be at most this share of the buyer's headcount. */
export const ACQUIRE_MAX_SIZE_RATIO = 0.5
export const ACQUIRE_MORALE_HIT = 10
export const ACQUIRE_STAR_LOYALTY_HIT = 15
/**
 * IPO: sell this share of the firm for cash. Afterwards the valuation counts only the owners' share,
 * with a small listing premium on the multiple, so listing is roughly neutral on the day and pays off
 * only if the cash is put to work.
 */
export const IPO_SHARE = 0.25
export const IPO_MULTIPLE_BONUS = 0.5
/** Quarterly pressure: a quarter worse than the last costs reputation and morale; a better one earns a little. */
export const IPO_MISS_REPUTATION = 2
export const IPO_MISS_MORALE = 3
export const IPO_BEAT_REPUTATION = 1

// Crises (content/crises.ts, engine/crises.ts)
/** No crises before this quarter. */
export const CRISIS_MIN_QUARTER = 3
/** Chance per quarter that the player gets a new crisis, once CRISIS_GAP quarters have passed since the last. ~One per 3–4 quarters. */
export const CRISIS_CHANCE = 0.45
export const CRISIS_GAP = 2
export const CRISIS_MAX_OPEN = 2
/** AI firms: chance per quarter of their own crisis, and how hard crises hit them (they get gossip, not ruin). */
export const CRISIS_AI_CHANCE = 0.07
export const CRISIS_AI_IMPACT = 0.5
/**
 * How keen an AI firm is to hush a crisis up (0–1): a base, plus its shadiness and how little it cares about
 * quality. Above ~0.4 burying starts to look attractive to the planner: the bulk and giant firms do, the boutiques don't.
 */
export const CRISIS_AI_HUSH = { base: 0.2, perShadiness: 3, perCarelessness: 0.6 } as const
/** Crisis talk (minigame) score thresholds for the good and bad extra effects. AI and sim bots use their skill instead. */
export const CRISIS_TALK_GOOD = 67
export const CRISIS_TALK_BAD = 34
/** Client wants out: they stay if the contract's satisfaction is at least this when they decide. */
export const CRISIS_CLIENT_STAY = { low: 45, high: 65 } as const
/** Hushed-up crises may resurface for this many quarters, with this chance per quarter. */
export const CRISIS_BURY_QUARTERS = 8
export const CRISIS_EXPOSE_CHANCE = { low: 0.06, high: 0.14 } as const
/** The press loves a big name: AI firms' hushed-up crises come out this much more often. */
export const CRISIS_AI_EXPOSE_FACTOR = 2
/** Ended crises stay on the dashboard this long. */
export const CRISIS_KEEP_QUARTERS = 4

// Shady
export const HEAT_DECAY = 10
export const SCANDAL_MORALE_HIT = 5
export const BRAND_MOD_DECAY = 0.7

// Stars
export const STAR_SIGNING_QUARTERS = 1
export const STAR_MARKET_MAX = 4

export const MAX_STAR_LEVEL = 5
export const MAX_POOL_LEVEL = 5

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
