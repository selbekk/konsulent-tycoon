import { PARTNERSHIP_MAP } from '../content/strategy'
import {
  LOBBY_COOLDOWN,
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
import { DISCIPLINES } from './types'
import type { ActionOf, Firm, GameState, Specialty, Tender } from './types'
import { seatTotal } from './util'

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
  for (const id of firm.partnerships ?? []) {
    const p = PARTNERSHIP_MAP[id]
    if (p && (tender.seats[p.discipline] ?? 0) > 0) {
      bonus += PARTNER_BONUS
      break
    }
  }
  return bonus
}

/** Quarterly fees for partnerships. */
export function strategyCost(firm: Firm): number {
  return (firm.partnerships ?? []).reduce((s, id) => s + (PARTNERSHIP_MAP[id]?.fee ?? 0), 0)
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
  if (!firm || firm.bankrupt || !PARTNERSHIP_MAP[a.partnershipId]) return 'errors.invalid'
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
