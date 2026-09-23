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
export const PRIORITY_BONUS = 8
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
  culture: 2,
  stars: 2,
  // Level 3 made the early game clearly harder for the sim bot (see docs/balance-log.md).
  framework: 2,
  bingo: 3,
  backroom: 3,
} as const
/** The player can't touch culture budgets at level 1, so start from what a sensible player picks. */
export const PLAYER_START_BUDGETS = { fagmiljoPerHead: 15_000, sosialtPerHead: 12_000, salaryPremium: 0.02 }

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
