import { ANNOUNCEMENTS } from '../content/announcements'
import { THOUGHT_BY_ID } from '../content/thoughts'
import type { ThoughtId, ThoughtMood } from '../content/thoughts'
import { openCrises } from './crises'
import { eventCtx } from './events'
import { chance, hashString, pick, weightedPick } from './rng'
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
  mood: ThoughtMood
}

/** RollerCoaster Tycoon-style employee thoughts. Deterministic from state – safe in UI. */
export function employeeThoughts(state: GameState, firmId: string): Thought[] {
  const firm = state.firms[firmId]
  const ctx = eventCtx(state, firm)
  const out: Thought[] = []
  // The variant is a hash of firm, quarter and trigger, so the feed changes each quarter without touching state.rng.
  const add = (id: ThoughtId, params: Params = {}) => {
    const def = THOUGHT_BY_ID[id]
    const variant = (hashString(`${firmId}:${state.quarter}:${id}`) % def.variants) + 1
    out.push({ key: `thoughts.${id}.${variant}`, mood: def.mood, params })
  }

  if (ctx.headcount === 0) return []
  if (ctx.utilization > 0.95) add('overworked')
  else if (ctx.utilization < 0.5) add('bench_bored')
  else if (ctx.utilization >= 0.75) add('good_flow')

  if (firm.cash < 0) add('cash_tight')
  if (openCrises(state, firmId).length) add('crisis_open')
  if (firm.scandalPenalty > 0) add('embarrassed')
  if (firm.heat > 40) add('suspicious')

  const restless = firm.stars.find((s) => !s.founder && s.loyalty < 35)
  if (restless) add('star_restless', { name: restless.name.split(' ')[0] })

  if (firm.budgets.salaryPremium < 0) add('underpaid')
  else if (firm.budgets.salaryPremium >= 0.1) add('good_pay')

  if (firm.fagmiljo < 25) add('no_learning')
  else if (firm.fagmiljo >= 60) add('fagdag_good')

  if (firm.sosialt < 25) add('lonely')
  else if (firm.sosialt >= 60) add('great_colleagues')

  const own = firm.fagmiljo + firm.sosialt
  const rival = activeFirms(state)
    .filter((f) => f.id !== firm.id)
    .sort((a, b) => b.fagmiljo + b.sosialt - (a.fagmiljo + a.sosialt) || a.id.localeCompare(b.id))[0]
  if (rival && rival.fagmiljo + rival.sosialt > own + 30) add('rival_sushi', { firm: rival.name })

  const freelancers = state.contracts
    .filter((c) => c.firmId === firmId && c.lastFreelance)
    .reduce((s, c) => s + seatTotal(c.lastFreelance!), 0)
  if (freelancers > 0) add('who_are_freelancers')

  if (firm.listed) add('listed')
  if (ctx.headcount < 8) add('startup_vibes')
  else if (ctx.headcount >= 40) add('big_firm')
  if (!out.length) add('all_quiet')

  // Fill up with the season and everyday office life.
  if (out.length < 5) add(SEASONS[state.quarter % 4])
  if (out.length < 5) add('everyday')
  return out.slice(0, 5)
}

const SEASONS = ['season_q1', 'season_q2', 'season_q3', 'season_q4'] as const satisfies readonly ThoughtId[]
