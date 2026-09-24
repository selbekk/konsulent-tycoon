import type { Customer, Discipline, MeetingStyle, PromiseId } from '../engine/types'

export interface CustomerDef {
  id: string
  sector: Customer['sector']
  budgetFactor: number
  meetingPreference: MeetingStyle
  priceWeight: number
  /** Disciplines this customer tends to ask for. */
  favours: Discipline[]
  /** Relative frequency of tenders. */
  weight: number
  /** What the customer wants to hear about the start; shown to the player as a need. */
  wants: PromiseId
}

export const CUSTOMERS: CustomerDef[] = [
  { id: 'navet', sector: 'public', budgetFactor: 1.4, meetingPreference: 'humble', priceWeight: 0.35, favours: ['backend', 'frontend', 'design', 'architecture'], weight: 3, wants: 'phased' },
  { id: 'skatteetatn', sector: 'public', budgetFactor: 1.3, meetingPreference: 'concrete', priceWeight: 0.4, favours: ['backend', 'data', 'architecture'], weight: 2.5, wants: 'discovery' },
  { id: 'veivesen', sector: 'public', budgetFactor: 1.0, meetingPreference: 'concrete', priceWeight: 0.5, favours: ['backend', 'cloud', 'pm'], weight: 2, wants: 'discovery' },
  { id: 'helsesov', sector: 'public', budgetFactor: 1.2, meetingPreference: 'humble', priceWeight: 0.4, favours: ['backend', 'architecture', 'data', 'pm'], weight: 2, wants: 'phased' },
  { id: 'kommunenorge', sector: 'public', budgetFactor: 0.7, meetingPreference: 'humble', priceWeight: 0.6, favours: ['frontend', 'design', 'pm'], weight: 2, wants: 'discovery' },
  { id: 'laanekassen', sector: 'public', budgetFactor: 0.9, meetingPreference: 'concrete', priceWeight: 0.45, favours: ['frontend', 'backend', 'design'], weight: 1.5, wants: 'phased' },
  { id: 'dnbank', sector: 'private', budgetFactor: 1.4, meetingPreference: 'visionary', priceWeight: 0.45, favours: ['backend', 'cloud', 'data', 'frontend'], weight: 2.5, wants: 'fullTeam' },
  { id: 'equinaer', sector: 'private', budgetFactor: 1.3, meetingPreference: 'concrete', priceWeight: 0.5, favours: ['data', 'cloud', 'architecture'], weight: 2, wants: 'fullTeam' },
  { id: 'postenbring', sector: 'private', budgetFactor: 0.9, meetingPreference: 'concrete', priceWeight: 0.55, favours: ['backend', 'frontend', 'cloud'], weight: 1.5, wants: 'fullTeam' },
  { id: 'kryptonitt', sector: 'private', budgetFactor: 0.6, meetingPreference: 'buzzword', priceWeight: 0.9, favours: ['frontend', 'backend', 'design'], weight: 1.5, wants: 'fullTeam' },
  { id: 'tipptopp', sector: 'private', budgetFactor: 1.0, meetingPreference: 'visionary', priceWeight: 0.45, favours: ['frontend', 'design', 'data'], weight: 1.5, wants: 'discovery' },
  { id: 'rutah', sector: 'public', budgetFactor: 0.9, meetingPreference: 'visionary', priceWeight: 0.5, favours: ['frontend', 'design', 'backend'], weight: 1.5, wants: 'discovery' },
  { id: 'telenorr', sector: 'private', budgetFactor: 1.2, meetingPreference: 'buzzword', priceWeight: 0.6, favours: ['cloud', 'backend', 'pm'], weight: 2, wants: 'fullTeam' },
  { id: 'sparebank123', sector: 'private', budgetFactor: 1.0, meetingPreference: 'humble', priceWeight: 0.5, favours: ['frontend', 'backend', 'data'], weight: 1.5, wants: 'phased' },
]
