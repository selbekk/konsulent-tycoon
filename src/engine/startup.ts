import { cofounderDef } from '../content/cofounders'
import { CUSTOMERS, CUSTOMER_MAP } from '../content/customers'
import type { CustomerDef } from '../content/customers'
import {
  HIRE_COST,
  STARTUP_CANDIDATE_LEVEL,
  STARTUP_CANDIDATE_QUARTERS,
  STARTUP_COFFEE_INTEREST,
  STARTUP_DECLINE_INTEREST,
  STARTUP_DRINKS_COST,
  STARTUP_DRINKS_UNLIKED,
  STARTUP_FIRST_CANDIDATES,
  STARTUP_HOURS,
  STARTUP_INTEREST_BASE,
  STARTUP_INTEREST_DECAY,
  STARTUP_INTEREST_PER_APPEAL,
  STARTUP_INTEREST_PER_LEVEL,
  STARTUP_INTEREST_PER_REPUTATION,
  STARTUP_LEADS,
  STARTUP_LIKED_INTEREST,
  STARTUP_LINKEDIN_UNLIKED,
  STARTUP_MAX_CANDIDATES,
  STARTUP_NEW_CANDIDATES,
  STARTUP_OFFER_MAX,
  STARTUP_OFFER_MIN,
  STARTUP_RAMP_MIN_SATISFACTION,
  clamp,
} from './constants'
import { portfolioAppeal } from './customers'
import { activeContracts, isActive, spendable, staffFirm } from './economy'
import { chance, nextInt, noise, pick, weightedPick } from './rng'
import type { RngState } from './rng'
import { hireEmployee, newEmployee, rosterRng } from './roster'
import { newHireLevel } from './staff'
import { APPROACHES, DISCIPLINES } from './types'
import type { ActionOf, Candidate, Contract, Discipline, Firm, GameState, Lead, LeadKind, Seats } from './types'
import { addNews, nextId, seatTotal } from './util'

/*
 * The player's first quarters: two founders in a co-working space. Instead of the tender board, the firm is
 * offered a few leads each quarter and takes one; instead of hiring orders, it wins people over one by one
 * with evening hours. `Firm.startup` exists only during this phase and is removed at level 2 (levels.ts).
 *
 * Leads, candidates and offer answers are drawn from the roster RNG, never from state.rng, so the AI market
 * plays out the same whatever the player does here.
 */

/** Evening hours per quarter for this co-founder. Pure. */
export function startupHours(cofounder: string): number {
  return Math.max(1, STARTUP_HOURS + (cofounderDef(cofounder)?.perk.hours ?? 0))
}

/** The chance a candidate says yes to an offer right now. Pure. */
export function offerChance(c: Candidate): number {
  return clamp(c.interest / 100, STARTUP_OFFER_MIN, STARTUP_OFFER_MAX)
}

/** Why a recruiting move can't be made right now, or undefined. Pure: the UI uses it for the buttons. */
export function recruitBlock(firm: Firm, c: Candidate, move: string, quarter: number): string | undefined {
  const st = firm.startup
  if (!st) return 'errors.notStartup'
  if (st.hours < 1) return 'errors.noHours'
  if (move === 'offer') {
    if (c.declinedQuarter === quarter) return 'errors.offerDeclined'
    if (HIRE_COST > spendable(firm)) return 'errors.notEnoughCash'
    return undefined
  }
  if (!(APPROACHES as readonly string[]).includes(move)) return 'errors.invalid'
  if (c.tried.includes(move as Candidate['likes'])) return 'errors.alreadyTried'
  if (move === 'drinks' && STARTUP_DRINKS_COST > spendable(firm)) return 'errors.notEnoughCash'
  return undefined
}

/**
 * The seats a lead would have if taken now: everyone who is free this quarter, plus the lead's extra seats in the
 * customer's favourite discipline (at least one seat in all, so a lead never comes empty). Pure.
 */
export function leadSeats(state: GameState, firm: Firm, lead: Lead): Seats {
  const { idle } = staffFirm(state, firm)
  const seats: Seats = {}
  for (const d of DISCIPLINES) if (idle[d]) seats[d] = idle[d]
  const extra = lead.extraSeats + (seatTotal(seats) === 0 ? 1 : 0)
  if (extra > 0) {
    const d = lead.favours[0] ?? firm.stars[0]?.discipline ?? 'backend'
    seats[d] = (seats[d] ?? 0) + extra
  }
  return seats
}

/** Customers that suit each kind of lead. */
const LEAD_CUSTOMERS: Record<LeadKind, (c: CustomerDef) => boolean> = {
  steady: (c) => c.sector === 'public',
  growth: (c) => c.sector === 'private' && c.profile.hype >= 4,
  prestige: (c) => c.sector === 'private' && c.budgetFactor >= 1,
  insider: (c) => c.sector === 'private',
}

function makeLead(state: GameState, rng: RngState, kind: LeadKind, taken: Set<string>): Lead | undefined {
  const fits = CUSTOMERS.filter((c) => LEAD_CUSTOMERS[kind](c) && !taken.has(c.id))
  const def = weightedPick(rng, fits.length ? fits : CUSTOMERS, (c) => c.weight)
  if (!def) return undefined
  taken.add(def.id)
  const spec = STARTUP_LEADS[kind]
  return {
    id: nextId(state, 'l'),
    kind,
    customerId: def.id,
    extraSeats: spec.extraSeats,
    favours: [...def.favours],
    duration: nextInt(rng, spec.duration[0], spec.duration[1]),
    rate: spec.rate,
  }
}

function makeLeads(state: GameState, firm: Firm): Lead[] {
  const st = firm.startup!
  const rng = rosterRng(state, firm, 'leads')
  const kinds: LeadKind[] = ['steady', 'growth', 'prestige']
  if (cofounderDef(st.cofounder)?.perk.insiderLead) kinds.push('insider')
  const taken = new Set<string>()
  return kinds.map((k) => makeLead(state, rng, k, taken)).filter((l): l is Lead => !!l)
}

/** Disciplines the firm is short of: work it can't staff, growth customers about to ramp up, and what the leads want. */
function wantedDisciplines(state: GameState, firm: Firm): Set<Discipline> {
  const wanted = new Set<Discipline>()
  const next = staffFirm(state, firm, state.quarter + 1)
  for (const cs of next.contracts) for (const d of DISCIPLINES) if (cs.freelance[d] || cs.flex[d]) wanted.add(d)
  for (const c of activeContracts(state, firm.id))
    for (const d of Object.keys(c.ramp?.seats ?? {})) wanted.add(d as Discipline)
  for (const l of firm.startup?.leads ?? []) if (l.favours[0]) wanted.add(l.favours[0])
  return wanted
}

/** Adds up to `n` people to the network. `interestBonus` is for someone who came looking for you. */
export function addCandidates(state: GameState, firm: Firm, n: number, interestBonus = 0) {
  const st = firm.startup
  if (!st) return
  const wanted = wantedDisciplines(state, firm)
  const perk = cofounderDef(st.cofounder)?.perk.interest ?? 0
  const appeal = portfolioAppeal(state, firm)
  for (let i = 0; i < n && st.candidates.length < STARTUP_MAX_CANDIDATES; i++) {
    const rng = rosterRng(state, firm, 'network')
    const d = weightedPick(rng, DISCIPLINES, (x) => (wanted.has(x) ? 3 : 1))!
    const level = clamp(
      newHireLevel(state, firm) - 0.3 + noise(rng, 0.6),
      STARTUP_CANDIDATE_LEVEL.min,
      STARTUP_CANDIDATE_LEVEL.max,
    )
    const person = newEmployee(state, firm, d, level)
    const interest =
      STARTUP_INTEREST_BASE +
      perk +
      interestBonus +
      (firm.reputation - 40) * STARTUP_INTEREST_PER_REPUTATION +
      (appeal - 50) * STARTUP_INTEREST_PER_APPEAL -
      (person.level - 2.5) * STARTUP_INTEREST_PER_LEVEL
    st.candidates.push({
      person,
      interest: Math.round(clamp(interest, 5, 90)),
      likes: pick(rng, APPROACHES),
      tried: [],
      untilQuarter: state.quarter + STARTUP_CANDIDATE_QUARTERS,
    })
  }
}

/** Sets up the startup phase for a new player firm. Call after the customers exist. */
export function initStartup(state: GameState, firm: Firm, cofounder: string) {
  firm.startup = { cofounder, hours: startupHours(cofounder), leads: [], candidates: [] }
  firm.startup.leads = makeLeads(state, firm)
  addCandidates(state, firm, STARTUP_FIRST_CANDIDATES + (cofounderDef(cofounder)?.perk.candidates ?? 0))
}

/** A new quarter in the co-working space: fresh hours and leads, the network moves on. Runs after `state.quarter` moved. */
export function startupQuarter(state: GameState) {
  const firm = state.firms[state.playerId]
  const st = firm.startup
  if (!st || firm.bankrupt) return
  st.hours = startupHours(st.cofounder)
  delete st.takenLead
  st.candidates = st.candidates.filter((c) => c.untilQuarter > state.quarter)
  for (const c of st.candidates) c.interest = Math.max(0, c.interest - STARTUP_INTEREST_DECAY)
  st.leads = makeLeads(state, firm)
  addCandidates(state, firm, STARTUP_NEW_CANDIDATES + (cofounderDef(st.cofounder)?.perk.candidates ?? 0))
}

/** Growth customers who are happy enough add the seats they promised. Runs at the quarter change. */
export function applyRamps(state: GameState, quarter: number) {
  for (const c of state.contracts) {
    if (!c.ramp || c.ramp.quarter !== quarter) continue
    const seats = c.ramp.seats
    delete c.ramp
    if (!isActive(c, quarter) || c.satisfaction < STARTUP_RAMP_MIN_SATISFACTION) continue
    for (const d of DISCIPLINES) {
      const n = seats[d] ?? 0
      if (!n) continue
      c.baseSeats[d] = (c.baseSeats[d] ?? 0) + n
      c.activeSeats[d] = (c.activeSeats[d] ?? 0) + n
    }
    if (c.firmId === state.playerId)
      addNews(state, 'news.startup.rampUp', { customer: c.customerId, count: seatTotal(seats) }, 'good', {
        personal: true,
      })
  }
}

export function handleTakeLead(state: GameState, a: ActionOf<'takeLead'>): string | undefined {
  const firm = state.firms[a.firmId]
  const st = firm && !firm.bankrupt ? firm.startup : undefined
  if (!st) return 'errors.notStartup'
  if (st.takenLead) return 'errors.leadTaken'
  const lead = st.leads.find((l) => l.id === a.leadId)
  if (!lead || !Object.hasOwn(CUSTOMER_MAP, lead.customerId)) return 'errors.invalidLead'
  const spec = STARTUP_LEADS[lead.kind]
  const seats = leadSeats(state, firm, lead)
  const contract: Contract = {
    id: nextId(state, 'c'),
    tenderId: 'lead',
    firmId: firm.id,
    customerId: lead.customerId,
    kind: 'project',
    baseSeats: seats,
    activeSeats: { ...seats },
    rateMultiplier: lead.rate,
    share: 1,
    rank: 1,
    // Direct work: they need you on Monday, so it bills from this quarter.
    startQuarter: state.quarter,
    endQuarter: state.quarter + lead.duration,
    starIds: [],
    satisfaction: 70,
    outsourcedShare: 0,
    fraud: { cvPad: false, ghostCv: false, baitAndSwitch: false },
    terminated: false,
  }
  if ('rampSeats' in spec) {
    const d = lead.favours[0] ?? Object.keys(seats)[0]
    contract.ramp = { quarter: state.quarter + spec.rampAfter, seats: { [d]: spec.rampSeats } }
  }
  // Founders with nothing to do go along, so they show up on the contract.
  const running = new Set(activeContracts(state, firm.id).map((c) => c.id))
  const placed: Seats = {}
  for (const s of firm.stars) {
    if (s.assignedContractId && running.has(s.assignedContractId)) continue
    if ((placed[s.discipline] ?? 0) >= (seats[s.discipline] ?? 0)) continue
    placed[s.discipline] = (placed[s.discipline] ?? 0) + 1
    s.assignedContractId = contract.id
    contract.starIds.push(s.id)
  }
  state.contracts.push(contract)
  const cust = state.customers[lead.customerId]
  cust.relationships[firm.id] = clamp((cust.relationships[firm.id] ?? 20) + spec.relationship, 0, 100)
  firm.reputation = clamp(firm.reputation + spec.reputation, 0, 100)
  st.takenLead = lead.id
  const stats = (firm.stats ??= {})
  stats.leads = (stats.leads ?? 0) + 1
  addNews(state, 'news.startup.leadTaken', { customer: lead.customerId, count: seatTotal(seats) }, 'good', {
    firmId: firm.id,
    personal: true,
  })
  return undefined
}

export function handleRecruit(state: GameState, a: ActionOf<'recruit'>): string | undefined {
  const firm = state.firms[a.firmId]
  const st = firm && !firm.bankrupt ? firm.startup : undefined
  if (!st) return 'errors.notStartup'
  const c = st.candidates.find((x) => x.person.id === a.candidateId)
  if (!c) return 'errors.invalidCandidate'
  const blocked = recruitBlock(firm, c, a.move, state.quarter)
  if (blocked) return blocked
  st.hours -= 1
  if (a.move === 'offer') {
    if (chance(rosterRng(state, firm, 'offer'), offerChance(c))) {
      st.candidates = st.candidates.filter((x) => x !== c)
      firm.cash -= HIRE_COST
      hireEmployee(state, firm, c.person)
      firm.quarterHires += 1
      const stats = (firm.stats ??= {})
      stats.recruits = (stats.recruits ?? 0) + 1
      addNews(state, 'news.startup.recruited', { name: c.person.name, discipline: c.person.discipline }, 'good', {
        firmId: firm.id,
        personal: true,
      })
    } else {
      c.interest = Math.max(0, c.interest - STARTUP_DECLINE_INTEREST)
      c.declinedQuarter = state.quarter
      addNews(state, 'news.startup.declined', { name: c.person.name }, 'neutral', { firmId: firm.id, personal: true })
    }
    return undefined
  }
  const move = a.move
  c.tried.push(move)
  if (move === 'drinks') firm.cash -= STARTUP_DRINKS_COST
  if (move === 'coffee') c.likesKnown = true
  const gain =
    move === c.likes
      ? STARTUP_LIKED_INTEREST
      : move === 'coffee'
        ? STARTUP_COFFEE_INTEREST
        : move === 'drinks'
          ? STARTUP_DRINKS_UNLIKED
          : STARTUP_LINKEDIN_UNLIKED
  c.interest = Math.round(clamp(c.interest + gain, 0, 100))
  return undefined
}
