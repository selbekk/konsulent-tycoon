import { ANNOUNCEMENTS } from '../content/announcements'
import { eventCtx } from './events'
import { chance, pick, weightedPick } from './rng'
import type { GameState, Params } from './types'
import { activeFirms, seatTotal } from './util'

/** Theme Hospital-style PA announcement for the new quarter (at most one). */
export function pickAnnouncement(state: GameState) {
  state.announcement = undefined
  const firm = state.firms[state.playerId]
  if (firm.bankrupt || !chance(state.rng, 0.7)) return
  const ctx = eventCtx(state, firm)
  const candidates = ANNOUNCEMENTS.filter(
    (a) => (!a.condition || a.condition(ctx)) && (!a.needsStar || firm.stars.length > 0),
  )
  const def = weightedPick(state.rng, candidates, (a) => a.weight)
  if (!def) return
  const params: Params = {}
  if (def.needsStar) params.name = pick(state.rng, firm.stars).name.split(' ')[0]
  state.announcement = { key: `announcements.${def.id}`, params }
}

export interface Thought {
  key: string
  params: Params
  mood: 'good' | 'bad' | 'neutral'
}

/** RollerCoaster Tycoon-style employee thoughts. Deterministic from state – safe in UI. */
export function employeeThoughts(state: GameState, firmId: string): Thought[] {
  const firm = state.firms[firmId]
  const ctx = eventCtx(state, firm)
  const out: Thought[] = []
  const add = (key: string, mood: Thought['mood'], params: Params = {}) => out.push({ key: `thoughts.${key}`, mood, params })

  if (ctx.headcount === 0) return []
  if (ctx.utilization > 0.95) add('overworked', 'bad')
  else if (ctx.utilization < 0.5) add('bench_bored', 'bad')
  else if (ctx.utilization >= 0.75) add('good_flow', 'good')

  if (firm.scandalPenalty > 0) add('embarrassed', 'bad')
  if (firm.heat > 40) add('suspicious', 'neutral')

  const restless = firm.stars.find((s) => !s.founder && s.loyalty < 35)
  if (restless) add('star_restless', 'bad', { name: restless.name.split(' ')[0] })

  if (firm.budgets.salaryPremium < 0) add('underpaid', 'bad')
  else if (firm.budgets.salaryPremium >= 0.1) add('good_pay', 'good')

  if (firm.fagmiljo < 25) add('no_learning', 'bad')
  else if (firm.fagmiljo >= 60) add('fagdag_good', 'good')

  if (firm.sosialt < 25) add('lonely', 'bad')
  else if (firm.sosialt >= 60) add('great_colleagues', 'good')

  const own = firm.fagmiljo + firm.sosialt
  const rival = activeFirms(state)
    .filter((f) => f.id !== firm.id)
    .sort((a, b) => b.fagmiljo + b.sosialt - (a.fagmiljo + a.sosialt) || a.id.localeCompare(b.id))[0]
  if (rival && rival.fagmiljo + rival.sosialt > own + 30) add('rival_sushi', 'bad', { firm: rival.name })

  const freelancers = state.contracts
    .filter((c) => c.firmId === firmId && c.lastFreelance)
    .reduce((s, c) => s + seatTotal(c.lastFreelance!), 0)
  if (freelancers > 0) add('who_are_freelancers', 'neutral')

  if (ctx.headcount < 8) add('startup_vibes', 'good')
  if (!out.length) add('all_quiet', 'neutral')
  return out.slice(0, 5)
}
