import type { Discipline } from '../engine/types'

export interface PartnershipDef {
  id: string
  /** Bids on tenders with seats in this discipline get the partner bonus. */
  discipline: Discipline
  /** NOK per quarter while the partnership runs. */
  fee: number
}

/** Vendor partnerships: a steady fee for a better story in one kind of tender. */
export const PARTNERSHIPS: PartnershipDef[] = [
  { id: 'hyperscaler', discipline: 'cloud', fee: 150_000 },
  { id: 'ai_lab', discipline: 'data', fee: 150_000 },
  { id: 'design_guild', discipline: 'design', fee: 100_000 },
  { id: 'agile_institute', discipline: 'pm', fee: 100_000 },
  { id: 'framework_vendor', discipline: 'frontend', fee: 120_000 },
  { id: 'enterprise_vendor', discipline: 'backend', fee: 120_000 },
  { id: 'architecture_forum', discipline: 'architecture', fee: 100_000 },
]

export const PARTNERSHIP_MAP = Object.fromEntries(PARTNERSHIPS.map((p) => [p.id, p])) as Record<string, PartnershipDef>

export type DepartmentId = 'academy' | 'sales' | 'nearshore'

export interface DepartmentDef {
  id: DepartmentId
  /** NOK per quarter, plus `feePerHead` for every employee. */
  fee: number
  feePerHead: number
}

/** Departments of your own: a running cost for a lasting edge. Effects live in engine/strategy.ts. */
export const DEPARTMENTS: DepartmentDef[] = [
  { id: 'academy', fee: 150_000, feePerHead: 3_000 },
  { id: 'sales', fee: 250_000, feePerHead: 0 },
  { id: 'nearshore', fee: 300_000, feePerHead: 0 },
]

export const DEPARTMENT_MAP = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<DepartmentId, DepartmentDef>
