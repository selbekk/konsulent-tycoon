import { CUSTOMERS } from '../content/customers'
import { FIRMS } from '../content/firms'
import type { FirmDef } from '../content/firms'
import { TRENDS } from '../content/trends'
import { personalityFor, salaryPremiumFor } from './ai/personalities'
import { MAX_QUARTERS, SAVE_VERSION, TARGET_DEMAND_RATIO, clamp } from './constants'
import { cultureEquilibrium } from './culture'
import { pickAnnouncement } from './flavor'
import { createRng, nextInt, noise, pick, range, weightedPick } from './rng'
import { generateStar } from './stars'
import { marketCapacity, publishTenders } from './tenders'
import { DISCIPLINES } from './types'
import type { Contract, Customer, Difficulty, Discipline, Firm, GameState, Seats } from './types'
import { addNews, emptyPools, nextId, seatTotal } from './util'

export interface NewGameOptions {
  seed: number
  firmName: string
  founderDisciplines: [Discipline, Discipline]
  difficulty: Difficulty
}

export const PLAYER_ID = 'player'

const START_CASH: Record<Difficulty, number> = { easy: 5_000_000, normal: 3_000_000, hard: 1_500_000 }
const AI_CASH_FACTOR: Record<Difficulty, number> = { easy: 0.8, normal: 1, hard: 1.3 }

function baseFirm(id: string, name: string, isPlayer: boolean, personalityId: string, country: string): Firm {
  return {
    id,
    name,
    isPlayer,
    personalityId,
    country,
    cash: 0,
    reputation: 30,
    heat: 0,
    fagmiljo: 20,
    sosialt: 20,
    brandMod: 0,
    budgets: { fagmiljoPerHead: 10_000, sosialtPerHead: 8_000, salaryPremium: 0 },
    pools: emptyPools(),
    stars: [],
    hiringOrders: {},
    pendingHires: {},
    negativeCashQuarters: 0,
    bankrupt: false,
    history: [],
    valuationHistory: [],
    intel: [],
    shadyLog: [],
    scandalPenalty: 0,
    quarterFines: 0,
    quarterLeavers: 0,
    quarterHires: 0,
  }
}

function createAiFirm(state: GameState, def: FirmDef): Firm {
  const p = personalityFor(def.personalityId)
  const firm = baseFirm(def.id, def.name, false, def.personalityId, def.country)
  const hc = Math.max(8, Math.round(def.startHeadcount * range(state.rng, 0.9, 1.1)))
  const mixTotal = DISCIPLINES.reduce((s, d) => s + (p.mix[d] ?? 0), 0)
  let placed = 0
  for (const d of DISCIPLINES) {
    const n = Math.floor((hc * (p.mix[d] ?? 0)) / mixTotal)
    firm.pools[d] = { count: n, level: clamp(p.startLevel + noise(state.rng, 0.25), 1.5, 4.5), morale: nextInt(state.rng, 58, 70) }
    placed += n
  }
  while (placed < hc) {
    const d = weightedPick(state.rng, DISCIPLINES, (x) => p.mix[x] ?? 0)!
    firm.pools[d].count++
    placed++
  }
  // Promote a few to named stars.
  const starCount = clamp(Math.round(hc / 15), 1, 6)
  for (let i = 0; i < starCount; i++) {
    const d = weightedPick(state.rng, DISCIPLINES, (x) => firm.pools[x].count)!
    firm.pools[d].count--
    const star = generateStar(state, d, 3, 5)
    star.loyalty = nextInt(state.rng, 45, 75)
    firm.stars.push(star)
  }
  firm.budgets = {
    fagmiljoPerHead: Math.round((4_000 + 22_000 * p.qualityFocus) / 1000) * 1000,
    sosialtPerHead: Math.round((5_000 + 12_000 * p.qualityFocus) / 1000) * 1000,
    salaryPremium: salaryPremiumFor(p),
  }
  firm.fagmiljo = cultureEquilibrium(firm.budgets.fagmiljoPerHead)
  firm.sosialt = cultureEquilibrium(firm.budgets.sosialtPerHead)
  firm.reputation = clamp(def.startReputation + noise(state.rng, 4), 0, 100)
  firm.cash = Math.round(hc * 650_000 * AI_CASH_FACTOR[state.difficulty])
  return firm
}

function starterContract(
  state: GameState,
  firm: Firm,
  customerId: string,
  seats: Seats,
  rate: number,
  endQuarter: number,
): Contract {
  const c: Contract = {
    id: nextId(state, 'c'),
    tenderId: 'starter',
    firmId: firm.id,
    customerId,
    kind: 'project',
    baseSeats: seats,
    activeSeats: { ...seats },
    rateMultiplier: rate,
    share: 1,
    rank: 1,
    startQuarter: 0,
    endQuarter,
    starIds: [],
    satisfaction: 70,
    outsourcedShare: 0,
    fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
    terminated: false,
  }
  state.contracts.push(c)
  return c
}

/** Existing AI clients at 70–80 % utilisation, so nobody starts the game on the bench. */
function createBacklog(state: GameState, firm: Firm) {
  const p = personalityFor(firm.personalityId)
  const hc = DISCIPLINES.reduce((s, d) => s + firm.pools[d].count, 0) + firm.stars.length
  const k = clamp(Math.round(hc / 12), 1, 8)
  const buckets: Seats[] = Array.from({ length: k }, () => ({}))
  for (const d of DISCIPLINES) {
    const supply = firm.pools[d].count + firm.stars.filter((s) => s.discipline === d).length
    const seats = Math.round(supply * range(state.rng, 0.7, 0.8))
    for (let i = 0; i < seats; i++) {
      const b = buckets[nextInt(state.rng, 0, k - 1)]
      b[d] = (b[d] ?? 0) + 1
    }
  }
  const contracts = buckets
    .filter((b) => seatTotal(b) > 0)
    .map((seats) =>
      starterContract(
        state,
        firm,
        pick(state.rng, CUSTOMERS).id,
        seats,
        clamp(p.priceBias + noise(state.rng, 0.05), 0.7, 1.4),
        nextInt(state.rng, 2, 10),
      ),
    )
  for (const star of firm.stars) {
    const c = contracts.find((x) => (x.activeSeats[star.discipline] ?? 0) > 0)
    if (c) {
      star.assignedContractId = c.id
      c.starIds.push(star.id)
    }
  }
}

export function createNewGame(opts: NewGameOptions): GameState {
  const state: GameState = {
    saveVersion: SAVE_VERSION,
    seed: opts.seed,
    rng: createRng(opts.seed),
    difficulty: opts.difficulty,
    quarter: 0,
    maxQuarters: MAX_QUARTERS,
    playerId: PLAYER_ID,
    firms: {},
    firmOrder: [],
    customers: {},
    tenders: [],
    contracts: [],
    trends: [],
    pendingEvents: [],
    news: [],
    starMarket: [],
    lastAwards: [],
    eventHistory: {},
    status: 'playing',
    idCounter: 0,
  }

  // Player
  const me = baseFirm(PLAYER_ID, opts.firmName.trim() || 'Konsulent & Konsulent AS', true, 'player', 'NO')
  me.cash = START_CASH[opts.difficulty]
  const [d1, d2] = opts.founderDisciplines
  for (const d of opts.founderDisciplines) {
    const founder = generateStar(state, d, 4, 4)
    founder.founder = true
    founder.loyalty = 95
    founder.morale = 85
    founder.salaryPremium = 0
    founder.traits = founder.traits.slice(0, 1)
    me.stars.push(founder)
  }
  const poolDisciplines: Discipline[] = [d1, d2, 'backend', 'frontend']
  for (const d of poolDisciplines) {
    me.pools[d].count += 1
    me.pools[d].level = 2.5
    me.pools[d].morale = 72
  }
  state.firms[me.id] = me
  state.firmOrder.push(me.id)

  // Rivals
  for (const def of FIRMS) {
    const f = createAiFirm(state, def)
    state.firms[f.id] = f
    state.firmOrder.push(f.id)
  }

  // Customers
  for (const def of CUSTOMERS) {
    const relationships: Customer['relationships'] = {}
    for (const id of state.firmOrder) relationships[id] = id === PLAYER_ID ? 15 : nextInt(state.rng, 10, 50)
    state.customers[def.id] = {
      id: def.id,
      sector: def.sector,
      budgetFactor: def.budgetFactor,
      meetingPreference: def.meetingPreference,
      priceWeight: def.priceWeight,
      relationships,
    }
  }
  state.customers.kryptonitt.relationships[PLAYER_ID] = 45

  // Starter work
  // Founders plus two of the four – the other two are free to staff your first real tender.
  const starterSeats: Seats = {}
  for (const d of [d1, d2, d1, d2]) starterSeats[d] = (starterSeats[d] ?? 0) + 1
  const starter = starterContract(state, me, 'kryptonitt', starterSeats, 1.0, 6)
  for (const s of me.stars) {
    s.assignedContractId = starter.id
    starter.starIds.push(s.id)
  }
  for (const id of state.firmOrder) if (id !== PLAYER_ID) createBacklog(state, state.firms[id])

  const firstTrend = pick(state.rng, TRENDS.filter((t) => !t.volume || t.volume > 1))
  state.trends.push({ id: firstTrend.id, untilQuarter: nextInt(state.rng, firstTrend.minDuration, firstTrend.maxDuration) })

  state.baseDemand = marketCapacity(state) * TARGET_DEMAND_RATIO
  publishTenders(state, 0)
  for (let i = 0; i < 2; i++) state.starMarket.push(generateStar(state))
  addNews(state, 'news.game.welcome', { firm: me.name }, 'good', { personal: true })
  pickAnnouncement(state)
  return state
}
