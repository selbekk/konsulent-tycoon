import { DEPARTMENT_MAP, PARTNERSHIP_MAP } from '../content/strategy'
import type { DepartmentId } from '../content/strategy'
import {
  IPO_BEAT_REPUTATION,
  IPO_MISS_MORALE,
  IPO_MISS_REPUTATION,
  IPO_SHARE,
  ACADEMY_LEVEL_GAIN,
  ACADEMY_MAX_LEVEL,
  FREELANCER_MARKUP,
  LOBBY_COOLDOWN,
  NEARSHORE_FREELANCER_MARKUP,
  SALES_BID_BONUS,
  LOBBY_COST,
  LOBBY_RELATION,
  MAX_PARTNERSHIPS,
  PARTNER_BONUS,
  SPECIALTY_CHANGE_COST,
  SPECIALTY_DISCIPLINE_BONUS,
  SPECIALTY_DISCIPLINE_SHARE,
  SPECIALTY_SECTOR_BONUS,
  clamp,
} from './constants'
import { hasFeature } from './levels'
import { raiseLevel } from './roster'
import { valuation } from './score'
import { DISCIPLINES } from './types'
import type { ActionOf, Firm, GameState, Specialty, Tender } from './types'
import { addNews, seatTotal } from './util'

export const SPECIALTIES: Specialty[] = ['public', 'private', ...DISCIPLINES]

export function specialtyMatches(state: GameState, specialty: Specialty | undefined, tender: Tender): boolean {
  if (!specialty) return false
  if (specialty === 'public' || specialty === 'private') return state.customers[tender.customerId]?.sector === specialty
  return (tender.seats[specialty] ?? 0) >= seatTotal(tender.seats) * SPECIALTY_DISCIPLINE_SHARE
}

/** Extra bid quality from specialty and partnerships. Pure – safe for UI estimates. */
export function strategyBonus(state: GameState, firm: Firm, tender: Tender): number {
  let bonus = 0
  if (specialtyMatches(state, firm.specialty, tender))
    bonus += firm.specialty === 'public' || firm.specialty === 'private' ? SPECIALTY_SECTOR_BONUS : SPECIALTY_DISCIPLINE_BONUS
  if (hasDepartment(firm, 'sales')) bonus += SALES_BID_BONUS
  for (const id of firm.partnerships ?? []) {
    const p = PARTNERSHIP_MAP[id]
    if (p && (tender.seats[p.discipline] ?? 0) > 0) {
      bonus += PARTNER_BONUS
      break
    }
  }
  return bonus
}

export const hasDepartment = (firm: Firm, id: DepartmentId) => (firm.departments ?? []).includes(id)

export function departmentFee(id: DepartmentId, hc: number): number {
  const d = DEPARTMENT_MAP[id]
  return d.fee + d.feePerHead * hc
}

/** Quarterly fees for partnerships and departments. */
export function strategyCost(firm: Firm, hc: number): number {
  const partners = (firm.partnerships ?? []).reduce((s, id) => s + (PARTNERSHIP_MAP[id]?.fee ?? 0), 0)
  const departments = (firm.departments ?? []).reduce((s, id) => s + (Object.hasOwn(DEPARTMENT_MAP, id) ? departmentFee(id as DepartmentId, hc) : 0), 0)
  return partners + departments
}

/** Freelancers cost less with a nearshore centre of your own. */
export const freelancerMarkup = (firm: Firm) => (hasDepartment(firm, 'nearshore') ? NEARSHORE_FREELANCER_MARKUP : FREELANCER_MARKUP)

/** Runs once per quarter for each firm: the academy lifts everyone a little. */
export function runDepartments(firm: Firm) {
  if (!hasDepartment(firm, 'academy')) return
  for (const d of DISCIPLINES) {
    if (firm.pools[d].count) raiseLevel(firm, d, ACADEMY_LEVEL_GAIN, ACADEMY_MAX_LEVEL)
  }
}

export function handleSetDepartment(state: GameState, a: ActionOf<'setDepartment'>): string | undefined {
  const firm = state.firms[a.firmId]
  if (!firm || firm.bankrupt || !Object.hasOwn(DEPARTMENT_MAP, a.departmentId)) return 'errors.invalid'
  if (!hasFeature(firm, 'departments')) return 'errors.levelTooLow'
  const current = firm.departments ?? []
  if (!a.on) {
    firm.departments = current.filter((id) => id !== a.departmentId)
    return undefined
  }
  if (current.includes(a.departmentId)) return 'errors.alreadyDone'
  firm.departments = [...current, a.departmentId]
  return undefined
}

export const specialtyChangeCost = (firm: Firm) => (firm.specialty ? SPECIALTY_CHANGE_COST : 0)
export const lobbyReadyIn = (state: GameState, firm: Firm) =>
  firm.lastLobbyQuarter === undefined ? 0 : Math.max(0, firm.lastLobbyQuarter + LOBBY_COOLDOWN - state.quarter)

export function handleChooseSpecialty(state: GameState, a: ActionOf<'chooseSpecialty'>): string | undefined {
  const firm = state.firms[a.firmId]
  if (!firm || firm.bankrupt || !SPECIALTIES.includes(a.specialty)) return 'errors.invalid'
  if (!hasFeature(firm, 'strategy')) return 'errors.levelTooLow'
  if (firm.specialty === a.specialty) return 'errors.alreadyDone'
  const cost = specialtyChangeCost(firm)
  if (cost > firm.cash) return 'errors.notEnoughCash'
  firm.cash -= cost
  firm.specialty = a.specialty
  return undefined
}

export function handleSetPartnership(state: GameState, a: ActionOf<'setPartnership'>): string | undefined {
  const firm = state.firms[a.firmId]
  if (!firm || firm.bankrupt || !Object.hasOwn(PARTNERSHIP_MAP, a.partnershipId)) return 'errors.invalid'
  if (!hasFeature(firm, 'partnerships')) return 'errors.levelTooLow'
  const current = firm.partnerships ?? []
  if (!a.on) {
    firm.partnerships = current.filter((id) => id !== a.partnershipId)
    return undefined
  }
  if (current.includes(a.partnershipId)) return 'errors.alreadyDone'
  if (current.length >= MAX_PARTNERSHIPS) return 'errors.tooManyPartners'
  firm.partnerships = [...current, a.partnershipId]
  return undefined
}

export function handleLobby(state: GameState, a: ActionOf<'lobby'>): string | undefined {
  const firm = state.firms[a.firmId]
  if (!firm || firm.bankrupt) return 'errors.invalid'
  if (!hasFeature(firm, 'partnerships')) return 'errors.levelTooLow'
  if (lobbyReadyIn(state, firm) > 0) return 'errors.alreadyDone'
  if (firm.cash < LOBBY_COST) return 'errors.notEnoughCash'
  firm.cash -= LOBBY_COST
  firm.lastLobbyQuarter = state.quarter
  for (const c of Object.values(state.customers)) {
    if (c.sector === 'public') c.relationships[firm.id] = clamp((c.relationships[firm.id] ?? 20) + LOBBY_RELATION, 0, 100)
  }
  return undefined
}

/** Cash the firm would raise by listing now. Pure. */
export const ipoProceeds = (firm: Firm) => Math.round(valuation(firm) * IPO_SHARE)

export function handleIpo(state: GameState, a: ActionOf<'ipo'>): string | undefined {
  const firm = state.firms[a.firmId]
  if (!firm || firm.bankrupt) return 'errors.invalid'
  if (!hasFeature(firm, 'ipo')) return 'errors.levelTooLow'
  if (firm.listed) return 'errors.alreadyDone'
  firm.cash += ipoProceeds(firm)
  firm.listed = { quarter: state.quarter, share: IPO_SHARE }
  addNews(state, 'news.ipo.listed', { firm: firm.name }, 'good', { firmId: firm.id, personal: firm.isPlayer })
  return undefined
}

/** After each quarter's report: the market compares this quarter with the last. */
export function ipoPressure(state: GameState, firm: Firm) {
  if (!firm.listed || firm.history.length < 2) return
  const [prev, now] = firm.history.slice(-2)
  if (now.quarter <= firm.listed.quarter) return
  if (now.ebitda < prev.ebitda) {
    firm.reputation = clamp(firm.reputation - IPO_MISS_REPUTATION, 0, 100)
    for (const d of DISCIPLINES) firm.pools[d].morale = clamp(firm.pools[d].morale - IPO_MISS_MORALE, 0, 100)
    for (const s of firm.stars) s.morale = clamp(s.morale - IPO_MISS_MORALE, 0, 100)
    if (firm.isPlayer) addNews(state, 'news.ipo.miss', {}, 'bad', { firmId: firm.id, personal: true })
  } else {
    firm.reputation = clamp(firm.reputation + IPO_BEAT_REPUTATION, 0, 100)
    if (firm.isPlayer) addNews(state, 'news.ipo.beat', {}, 'good', { firmId: firm.id, personal: true })
  }
}
