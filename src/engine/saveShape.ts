import type { RngState } from './rng'
import { DISCIPLINES } from './types'
import type {
  ActiveTrend,
  Award,
  Bid,
  Budgets,
  Contract,
  Crisis,
  Customer,
  Firm,
  GameState,
  IntelEntry,
  NewsItem,
  PendingEvent,
  Pool,
  QuarterReport,
  ShadyLogEntry,
  Star,
  Tender,
} from './types'

/** Keys of T that are not optional. */
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]

/**
 * Lists every required key of T, and only those. Adding a required field to a type without
 * listing it here (or listing an optional one) fails the typecheck, so the lists can't drift.
 */
const required =
  <T>() =>
  <const A extends readonly (RequiredKeys<T> & string)[]>(keys: A & ([RequiredKeys<T>] extends [A[number]] ? unknown : never)): readonly string[] =>
    keys

const GAME = required<GameState>()(['saveVersion', 'seed', 'rng', 'difficulty', 'quarter', 'maxQuarters', 'playerId', 'firms', 'firmOrder', 'customers', 'tenders', 'contracts', 'trends', 'pendingEvents', 'news', 'starMarket', 'lastAwards', 'eventHistory', 'status', 'idCounter'])
const RNG = required<RngState>()(['s'])
const FIRM = required<Firm>()(['id', 'name', 'isPlayer', 'personalityId', 'country', 'cash', 'reputation', 'heat', 'fagmiljo', 'sosialt', 'brandMod', 'budgets', 'pools', 'stars', 'hiringOrders', 'pendingHires', 'negativeCashQuarters', 'bankrupt', 'history', 'valuationHistory', 'intel', 'shadyLog', 'scandalPenalty', 'quarterFines', 'quarterLeavers', 'quarterHires'])
const BUDGETS = required<Budgets>()(['fagmiljoPerHead', 'sosialtPerHead', 'salaryPremium'])
const POOL = required<Pool>()(['count', 'level', 'morale'])
const STAR = required<Star>()(['id', 'name', 'discipline', 'level', 'traits', 'ambition', 'morale', 'loyalty', 'salaryPremium'])
const REPORT = required<QuarterReport>()(['quarter', 'revenue', 'costs', 'ebitda', 'headcount', 'utilization', 'hires', 'leavers', 'fines'])
const INTEL = required<IntelEntry>()(['targetFirmId', 'kind', 'untilQuarter'])
const SHADY = required<ShadyLogEntry>()(['id', 'actionId', 'quarter', 'detected', 'ongoing', 'active'])
const CUSTOMER = required<Customer>()(['id', 'sector', 'budgetFactor', 'meetingPreference', 'priceWeight', 'relationships'])
const TENDER = required<Tender>()(['id', 'customerId', 'kind', 'seats', 'duration', 'priceWeight', 'qualityWeight', 'publishedQuarter', 'dueQuarter', 'buzzwords', 'bids', 'minigameResults', 'resolved', 'winnerIds'])
const BID = required<Bid>()(['firmId', 'rateMultiplier', 'starIds', 'effort', 'cvPad', 'ghostCv'])
const CONTRACT = required<Contract>()(['id', 'tenderId', 'firmId', 'customerId', 'kind', 'baseSeats', 'activeSeats', 'rateMultiplier', 'share', 'rank', 'startQuarter', 'endQuarter', 'starIds', 'satisfaction', 'outsourcedShare', 'fraud', 'terminated'])
const FRAUD = required<Contract['fraud']>()(['cvPad', 'ghostCv', 'baitAndSwitch'])
const TREND = required<ActiveTrend>()(['id', 'untilQuarter'])
const PENDING = required<PendingEvent>()(['id', 'eventId', 'firmId', 'params'])
const NEWS = required<NewsItem>()(['id', 'quarter', 'key', 'params', 'tone'])
const AWARD = required<Award>()(['awardId', 'firmId', 'year'])
const CRISIS = required<Crisis>()(['id', 'defId', 'firmId', 'stage', 'severity', 'startQuarter', 'stageQuarter', 'params', 'status', 'log'])

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function hasKeys(v: unknown, keys: readonly string[]): v is Obj {
  return isObj(v) && keys.every((k) => v[k] !== undefined)
}

const all = (v: unknown, ok: (x: unknown) => boolean) => Array.isArray(v) && v.every(ok)
const values = (v: unknown, ok: (x: unknown) => boolean) => isObj(v) && Object.values(v).every(ok)

function firmOk(f: unknown): boolean {
  return (
    hasKeys(f, FIRM) &&
    hasKeys(f.budgets, BUDGETS) &&
    isObj(f.pools) &&
    DISCIPLINES.every((d) => hasKeys((f.pools as Obj)[d], POOL)) &&
    all(f.stars, (s) => hasKeys(s, STAR)) &&
    isObj(f.hiringOrders) &&
    isObj(f.pendingHires) &&
    all(f.history, (r) => hasKeys(r, REPORT)) &&
    Array.isArray(f.valuationHistory) &&
    all(f.intel, (i) => hasKeys(i, INTEL)) &&
    all(f.shadyLog, (e) => hasKeys(e, SHADY))
  )
}

const tenderOk = (t: unknown) => hasKeys(t, TENDER) && isObj(t.seats) && all(t.bids, (b) => hasKeys(b, BID)) && isObj(t.minigameResults)
const contractOk = (c: unknown) => hasKeys(c, CONTRACT) && isObj(c.baseSeats) && isObj(c.activeSeats) && hasKeys(c.fraud, FRAUD)

/**
 * Whether a (migrated) save still has the shape the current engine expects. Checks presence of
 * every required field, not their types – enough to catch saves from before a shape change.
 */
export function hasValidShape(s: unknown): s is GameState {
  if (!hasKeys(s, GAME) || !hasKeys(s.rng, RNG)) return false
  const firms = s.firms
  return (
    values(firms, firmOk) &&
    isObj(firms) &&
    typeof s.playerId === 'string' &&
    firms[s.playerId] !== undefined &&
    all(s.firmOrder, (id) => typeof id === 'string' && firms[id] !== undefined) &&
    values(s.customers, (c) => hasKeys(c, CUSTOMER) && isObj(c.relationships)) &&
    all(s.tenders, tenderOk) &&
    all(s.contracts, contractOk) &&
    all(s.trends, (t) => hasKeys(t, TREND)) &&
    all(s.pendingEvents, (e) => hasKeys(e, PENDING)) &&
    all(s.news, (n) => hasKeys(n, NEWS)) &&
    all(s.starMarket, (x) => hasKeys(x, STAR)) &&
    all(s.lastAwards, (a) => hasKeys(a, AWARD)) &&
    isObj(s.eventHistory) &&
    (s.crises === undefined || all(s.crises, (c) => hasKeys(c, CRISIS) && isObj(c.params) && Array.isArray(c.log)))
  )
}
