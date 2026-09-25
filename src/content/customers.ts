import type { Customer, Discipline, MeetingStyle, PromiseId } from '../engine/types'

/**
 * A customer's personality, each 1–5. Static content, never copied into the save.
 * Some of them feed the customer's appeal to consultants (see `customerAppeal`); the rest is character.
 */
export interface CustomerProfile {
  /** How many consultants want to work there. */
  hype: number
  /** How exciting the tech is. */
  tech: number
  /** How good they are at being a customer: clear needs, decisions, a product owner who shows up. */
  maturity: number
  /** How much they care about years of experience on the CV. */
  seniority: number
  /** How nice the office is. */
  office: number
  /** How much the work matters to society. */
  impact: number
  /** How hard they push on deadlines. */
  pace: number
  /** Forms, steering groups and approval chains. */
  bureaucracy: number
  /** How relaxed they are about working from home. */
  remote: number
  /** How faithful they are to vendors they like. */
  loyalty: number
}

export const CUSTOMER_METRICS = [
  'hype',
  'tech',
  'maturity',
  'seniority',
  'office',
  'impact',
  'pace',
  'bureaucracy',
  'remote',
  'loyalty',
] as const satisfies readonly (keyof CustomerProfile)[]

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
  profile: CustomerProfile
}

const p = (
  hype: number,
  tech: number,
  maturity: number,
  seniority: number,
  office: number,
  impact: number,
  pace: number,
  bureaucracy: number,
  remote: number,
  loyalty: number,
): CustomerProfile => ({ hype, tech, maturity, seniority, office, impact, pace, bureaucracy, remote, loyalty })

// profile: p(hype, tech, maturity, seniority, office, impact, pace, bureaucracy, remote, loyalty)
export const CUSTOMERS: CustomerDef[] = [
  {
    id: 'navet',
    sector: 'public',
    budgetFactor: 1.4,
    meetingPreference: 'humble',
    priceWeight: 0.35,
    favours: ['backend', 'frontend', 'design', 'architecture'],
    weight: 3,
    wants: 'phased',
    profile: p(3, 4, 4, 3, 3, 5, 2, 4, 4, 4),
  },
  {
    id: 'skatteetatn',
    sector: 'public',
    budgetFactor: 1.3,
    meetingPreference: 'concrete',
    priceWeight: 0.4,
    favours: ['backend', 'data', 'architecture'],
    weight: 2.5,
    wants: 'discovery',
    profile: p(2, 3, 4, 4, 2, 4, 2, 4, 3, 5),
  },
  {
    id: 'veivesen',
    sector: 'public',
    budgetFactor: 1.0,
    meetingPreference: 'concrete',
    priceWeight: 0.5,
    favours: ['backend', 'cloud', 'pm'],
    weight: 2,
    wants: 'discovery',
    profile: p(2, 2, 2, 3, 2, 3, 2, 5, 3, 3),
  },
  {
    id: 'helsesov',
    sector: 'public',
    budgetFactor: 1.2,
    meetingPreference: 'humble',
    priceWeight: 0.4,
    favours: ['backend', 'architecture', 'data', 'pm'],
    weight: 2,
    wants: 'phased',
    profile: p(2, 1, 2, 4, 1, 5, 3, 5, 2, 3),
  },
  {
    id: 'kommunenorge',
    sector: 'public',
    budgetFactor: 0.7,
    meetingPreference: 'humble',
    priceWeight: 0.6,
    favours: ['frontend', 'design', 'pm'],
    weight: 2,
    wants: 'discovery',
    profile: p(1, 2, 1, 2, 2, 4, 1, 4, 3, 2),
  },
  {
    id: 'laanekassen',
    sector: 'public',
    budgetFactor: 0.9,
    meetingPreference: 'concrete',
    priceWeight: 0.45,
    favours: ['frontend', 'backend', 'design'],
    weight: 1.5,
    wants: 'phased',
    profile: p(3, 3, 3, 2, 3, 3, 2, 3, 4, 4),
  },
  {
    id: 'dnbank',
    sector: 'private',
    budgetFactor: 1.4,
    meetingPreference: 'visionary',
    priceWeight: 0.45,
    favours: ['backend', 'cloud', 'data', 'frontend'],
    weight: 2.5,
    wants: 'fullTeam',
    profile: p(3, 3, 3, 5, 5, 2, 4, 3, 2, 3),
  },
  {
    id: 'equinaer',
    sector: 'private',
    budgetFactor: 1.3,
    meetingPreference: 'concrete',
    priceWeight: 0.5,
    favours: ['data', 'cloud', 'architecture'],
    weight: 2,
    wants: 'fullTeam',
    profile: p(4, 4, 4, 4, 4, 3, 3, 3, 3, 4),
  },
  {
    id: 'postenbring',
    sector: 'private',
    budgetFactor: 0.9,
    meetingPreference: 'concrete',
    priceWeight: 0.55,
    favours: ['backend', 'frontend', 'cloud'],
    weight: 1.5,
    wants: 'fullTeam',
    profile: p(2, 3, 3, 2, 2, 3, 3, 2, 3, 3),
  },
  {
    id: 'kryptonitt',
    sector: 'private',
    budgetFactor: 0.6,
    meetingPreference: 'buzzword',
    priceWeight: 0.9,
    favours: ['frontend', 'backend', 'design'],
    weight: 1.5,
    wants: 'fullTeam',
    profile: p(5, 5, 1, 1, 4, 1, 5, 1, 5, 1),
  },
  {
    id: 'tipptopp',
    sector: 'private',
    budgetFactor: 1.0,
    meetingPreference: 'visionary',
    priceWeight: 0.45,
    favours: ['frontend', 'design', 'data'],
    weight: 1.5,
    wants: 'discovery',
    profile: p(3, 4, 4, 3, 3, 2, 2, 3, 3, 4),
  },
  {
    id: 'rutah',
    sector: 'public',
    budgetFactor: 0.9,
    meetingPreference: 'visionary',
    priceWeight: 0.5,
    favours: ['frontend', 'design', 'backend'],
    weight: 1.5,
    wants: 'discovery',
    profile: p(4, 4, 3, 2, 3, 4, 3, 2, 4, 3),
  },
  {
    id: 'telenorr',
    sector: 'private',
    budgetFactor: 1.2,
    meetingPreference: 'buzzword',
    priceWeight: 0.6,
    favours: ['cloud', 'backend', 'pm'],
    weight: 2,
    wants: 'fullTeam',
    profile: p(2, 3, 3, 3, 4, 2, 3, 4, 2, 2),
  },
  {
    id: 'sparebank123',
    sector: 'private',
    budgetFactor: 1.0,
    meetingPreference: 'humble',
    priceWeight: 0.5,
    favours: ['frontend', 'backend', 'data'],
    weight: 1.5,
    wants: 'phased',
    profile: p(2, 2, 3, 3, 3, 2, 2, 3, 3, 5),
  },
]

export const CUSTOMER_MAP: Record<string, CustomerDef> = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c]))
