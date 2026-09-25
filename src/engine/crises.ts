import { CRISES, CRISIS_MAP, EXPOSED_STAGE } from '../content/crises'
import type { CrisisChoice, CrisisDef, CrisisEffect, CrisisStage, SeverityEffect } from '../content/crises'
import { TREND_MAP } from '../content/trends'
import {
  CRISIS_AI_CHANCE,
  CRISIS_AI_EXPOSE_FACTOR,
  CRISIS_AI_IMPACT,
  CRISIS_BURY_QUARTERS,
  CRISIS_CHANCE,
  CRISIS_CLIENT_STAY,
  CRISIS_EXPOSE_CHANCE,
  CRISIS_GAP,
  CRISIS_KEEP_QUARTERS,
  CRISIS_MAX_OPEN,
  CRISIS_MIN_QUARTER,
  CRISIS_TALK_BAD,
  CRISIS_TALK_GOOD,
  PREMIUM_MAX,
  PREMIUM_MIN,
  RATE_MIN,
  clamp,
} from './constants'
import { terminateContract } from './contracts'
import { contractRevenue, headcount, isActive, activeContracts, spendable } from './economy'
import { applyMorale } from './events'
import { firmLevel } from './levels'
import { chance, nextInt, pick, weightedPick } from './rng'
import { addPeople, removePeople } from './roster'
import { removeStar } from './stars'
import { DISCIPLINES } from './types'
import type { ActionOf, Crisis, CrisisOutcome, CrisisSeverity, Discipline, Firm, GameState, Params } from './types'
import { addNews, nextId } from './util'

// ---- lookups (pure, safe for the UI) ----

export const allCrises = (state: GameState): Crisis[] => state.crises ?? []
export const crisesOf = (state: GameState, firmId: string): Crisis[] =>
  allCrises(state).filter((c) => c.firmId === firmId)
/** Crises waiting for a decision from the firm this quarter. */
export const openCrises = (state: GameState, firmId: string): Crisis[] =>
  crisesOf(state, firmId).filter((c) => c.status === 'active')

export function crisisDef(c: Crisis): CrisisDef | undefined {
  return CRISIS_MAP[c.defId]
}

export function crisisStage(c: Crisis): CrisisStage | undefined {
  if (c.stage === EXPOSED_STAGE.id) return EXPOSED_STAGE
  return CRISIS_MAP[c.defId]?.stages.find((s) => s.id === c.stage)
}

/** Stage position for the timeline: 1-based index and the longest path length in the def. */
export function crisisProgress(c: Crisis): { step: number; total: number } {
  const def = crisisDef(c)
  const decided = new Set(c.log.map((l) => l.stage)).size
  const total = Math.max(decided + (c.status === 'active' || c.status === 'waiting' ? 1 : 0), longestPath(def))
  return { step: decided + (c.status === 'active' ? 1 : 0), total }
}

function longestPath(def: CrisisDef | undefined): number {
  if (!def) return 1
  const byId = new Map(def.stages.map((s) => [s.id, s]))
  const depth = (id: string, seen: Set<string>): number => {
    const s = byId.get(id)
    if (!s || seen.has(id)) return 0
    const next = new Set<string>([
      ...s.choices.flatMap((c) => (c.next ? [c.next] : [])),
      ...(s.route ? [s.route.pass, s.route.fail] : []),
    ])
    // Route stages are decided by the engine and never shown as a step of their own.
    const own = s.route ? 0 : 1
    return own + Math.max(0, ...[...next].map((n) => depth(n, new Set([...seen, id]))))
  }
  return depth(def.stages[0].id, new Set())
}

/** Choices offered at the current stage (stages that reveal the severity offer different ones). */
export function crisisChoices(c: Crisis): CrisisChoice[] {
  return crisisStage(c)?.choices.filter((ch) => !ch.only || ch.only === c.severity) ?? []
}

export function fallbackChoice(c: Crisis): CrisisChoice | undefined {
  return crisisChoices(c).find((ch) => ch.fallback)
}

const impact = (firm: Firm) => (firm.isPlayer ? 1 : CRISIS_AI_IMPACT)

function severityPart(e: SeverityEffect | undefined, severity: CrisisSeverity): CrisisEffect {
  if (!e) return {}
  if ('low' in e || 'high' in e) return (e as { low?: CrisisEffect; high?: CrisisEffect })[severity] ?? {}
  return e as CrisisEffect
}

const COUNT_KEYS = ['leavers', 'hires'] as const

function scaleEffect(e: CrisisEffect, k: number): CrisisEffect {
  if (k === 1) return e
  const out: CrisisEffect = {}
  for (const [key, v] of Object.entries(e) as [keyof CrisisEffect, number | boolean][]) {
    if (typeof v !== 'number') (out as Record<string, unknown>)[key] = v
    else if ((COUNT_KEYS as readonly string[]).includes(key)) (out as Record<string, number>)[key] = Math.floor(v * k)
    else (out as Record<string, number>)[key] = v * k
  }
  return out
}

function mergeEffects(...es: (CrisisEffect | undefined)[]): CrisisEffect {
  const out: Record<string, number | boolean> = {}
  for (const e of es) {
    if (!e) continue
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === 'number') out[k] = ((out[k] as number | undefined) ?? 0) + v
      else if (v) out[k] = true
    }
  }
  return out as CrisisEffect
}

export type TalkTier = 'good' | 'ok' | 'bad'
export const talkTier = (score: number): TalkTier =>
  score >= CRISIS_TALK_GOOD ? 'good' : score < CRISIS_TALK_BAD ? 'bad' : 'ok'

/** Everything a choice does, for this firm and this crisis's severity. `score` only matters for talks. */
export function choiceEffect(firm: Firm, c: Crisis, choice: CrisisChoice, score?: number): CrisisEffect {
  const tier = choice.talk ? talkTier(score ?? 0) : undefined
  const talk = tier === 'good' ? choice.talkGood : tier === 'bad' ? choice.talkBad : undefined
  return scaleEffect(mergeEffects(choice.effect, choice[c.severity], talk), impact(firm))
}

const contractOf = (state: GameState, c: Crisis) =>
  typeof c.params.contract === 'string' ? state.contracts.find((x) => x.id === c.params.contract) : undefined

/** People a bench share takes off billable work. */
export function benchCount(firm: Firm, share: number): number {
  return Math.min(
    Math.max(1, Math.round(headcount(firm) * share)),
    DISCIPLINES.reduce((s, d) => s + firm.pools[d].count, 0),
  )
}

/** The part of a choice's effect the firm can know before picking it: no hidden severity, no talk result. */
function knownEffect(firm: Firm, c: Crisis, choice: CrisisChoice): CrisisEffect {
  const known = c.revealed || !!crisisStage(c)?.reveals
  return scaleEffect(mergeEffects(choice.effect, known ? choice[c.severity] : undefined), impact(firm))
}

/** Direct cash from an effect: lump sums, per head, and shares of the contract's quarterly revenue. */
function effectCash(state: GameState, firm: Firm, c: Crisis, e: CrisisEffect): number {
  let cash = (e.cash ?? 0) + (e.cashPerHead ?? 0) * headcount(firm)
  const contract = contractOf(state, c)
  if (e.contractRevenue && contract) cash += contractRevenue(firm, contract) * e.contractRevenue
  return Math.round(cash)
}

/** Error key if the firm can't pick this choice right now, else undefined. Pure. */
export function crisisChoiceBlock(state: GameState, c: Crisis, choiceId: string): string | undefined {
  if (c.status !== 'active') return 'errors.crisisClosed'
  const choice = crisisChoices(c).find((ch) => ch.id === choiceId)
  if (!choice) return 'errors.invalid'
  if (c.minigameStarted && c.minigameStarted !== choiceId) return 'errors.minigameAlreadyPlayed'
  const firm = state.firms[c.firmId]
  if (choice.needs === 'star' && !firm.stars.some((s) => s.id === c.params.starId)) return 'errors.crisisNeedsStar'
  if (choice.needs === 'contract') {
    const contract = contractOf(state, c)
    if (!contract || !isActive(contract, state.quarter)) return 'errors.crisisNeedsContract'
  }
  if (choice.needs === 'customer' && !(typeof c.params.customer === 'string' && state.customers[c.params.customer]))
    return 'errors.crisisNeedsCustomer'
  // Only what the player can know counts (a hidden severity must not show up as a block). Credit line included.
  const cost = -effectCash(state, firm, c, knownEffect(firm, c, choice))
  if (cost > 0 && spendable(firm) < cost) return 'errors.notEnoughCash'
  return undefined
}

export type Stake = -1 | 0 | 1 | '?'
export type StakeAxis = 'team' | 'customer' | 'press' | 'risk'
export const STAKE_AXES: StakeAxis[] = ['team', 'customer', 'press', 'risk']

export interface ChoicePreview {
  /** Known cash now (negative = cost). */
  cash: number
  /** People off billable work this quarter. */
  bench: number
  benchStar?: string
  /** Who likes it (+1), dislikes it (−1), or it depends ('?'). Risk +1 means more risk. */
  stakes: Record<StakeAxis, Stake>
  /** Part of the effect depends on how bad things really are. */
  uncertain: boolean
  ends: boolean
  bury: boolean
  talk?: CrisisChoice['talk']
  block?: string
}

function axes(e: CrisisEffect): Record<StakeAxis, number> {
  return {
    team:
      (e.morale ?? 0) +
      0.5 * ((e.fagmiljo ?? 0) + (e.sosialt ?? 0)) +
      0.3 * (e.starLoyalty ?? 0) -
      4 * (e.leavers ?? 0) -
      (e.scandal ?? 0),
    customer:
      (e.relationship ?? 0) +
      (e.satisfaction ?? 0) +
      (e.satisfactionAll ?? 0) +
      100 * (e.rateCut ?? 0) -
      (e.terminate ? 20 : 0),
    press: (e.reputation ?? 0) + (e.brand ?? 0),
    risk: e.heat ?? 0,
  }
}

const sign = (v: number): -1 | 0 | 1 => (v > 0.5 ? 1 : v < -0.5 ? -1 : 0)

/** What the player can know about a choice before picking it. Pure – the reducer uses the same numbers. */
export function crisisChoicePreview(state: GameState, c: Crisis, choice: CrisisChoice): ChoicePreview {
  const firm = state.firms[c.firmId]
  const known = c.revealed || !!crisisStage(c)?.reveals
  const base = knownEffect(firm, c, choice)
  const unknown = known ? [] : [choice.low, choice.high].filter((x): x is CrisisEffect => !!x)
  const talks = [choice.talkGood, choice.talkBad].filter((x): x is CrisisEffect => !!x)
  const baseAxes = axes(base)
  const stakes = Object.fromEntries(
    STAKE_AXES.map((a) => {
      const varies = [...unknown, ...talks].some((e) => sign(axes(e)[a]) !== 0)
      const v = baseAxes[a] + (a === 'risk' && choice.bury ? 10 : 0)
      return [a, varies ? '?' : sign(v)]
    }),
  ) as Record<StakeAxis, Stake>
  const star = base.benchStar ? firm.stars.find((s) => s.id === c.params.starId) : undefined
  return {
    cash: effectCash(state, firm, c, base),
    bench: base.bench ? benchCount(firm, base.bench) : 0,
    benchStar: star?.name,
    stakes,
    uncertain: unknown.length > 0,
    ends: !choice.next,
    bury: !!choice.bury,
    talk: choice.talk,
    block: crisisChoiceBlock(state, c, choice.id),
  }
}

// ---- effects (draft only) ----

function benchedThisQuarter(state: GameState, firm: Firm) {
  if (!firm.benched || firm.benched.quarter !== state.quarter)
    firm.benched = { quarter: state.quarter, seats: {}, starIds: [] }
  return firm.benched
}

/** Largest pools first, the crisis's own discipline before the rest. */
function disciplineOrder(preferred: unknown, free: (d: Discipline) => number): Discipline[] {
  const sorted = [...DISCIPLINES].sort((a, b) => free(b) - free(a))
  const p = DISCIPLINES.find((d) => d === preferred)
  return p ? [p, ...sorted.filter((d) => d !== p)] : sorted
}

function bench(state: GameState, firm: Firm, c: Crisis, share: number) {
  const b = benchedThisQuarter(state, firm)
  let n = benchCount(firm, share)
  const free = (d: Discipline) => firm.pools[d].count - (b.seats[d] ?? 0)
  while (n > 0) {
    const d = disciplineOrder(c.params.discipline, free).find((x) => free(x) > 0)
    if (!d) break
    b.seats[d] = (b.seats[d] ?? 0) + 1
    n--
  }
}

function leave(state: GameState, firm: Firm, c: Crisis, n: number) {
  for (let i = 0; i < n; i++) {
    const d = disciplineOrder(c.params.discipline, (x) => firm.pools[x].count).find((x) => firm.pools[x].count > 0)
    if (!d) return
    removePeople(state, firm, d, 1)
    firm.quarterLeavers += 1
  }
}

function hire(state: GameState, firm: Firm, c: Crisis, n: number) {
  const d =
    DISCIPLINES.find((x) => x === c.params.discipline) ?? disciplineOrder(undefined, (x) => firm.pools[x].count)[0]
  addPeople(state, firm, d, n, 2.8, 60)
  firm.quarterHires += n
}

export function applyCrisisEffect(state: GameState, firm: Firm, c: Crisis, e: CrisisEffect) {
  firm.cash += effectCash(state, firm, c, e)
  if (e.reputation) firm.reputation = clamp(firm.reputation + e.reputation, 0, 100)
  if (e.heat) firm.heat = clamp(firm.heat + e.heat, 0, 100)
  if (e.fagmiljo) firm.fagmiljo = clamp(firm.fagmiljo + e.fagmiljo, 0, 100)
  if (e.sosialt) firm.sosialt = clamp(firm.sosialt + e.sosialt, 0, 100)
  if (e.morale) applyMorale(firm, e.morale)
  if (e.brand) firm.brandMod += e.brand
  if (e.scandal) firm.scandalPenalty += e.scandal
  if (e.salaryPremium)
    firm.budgets.salaryPremium = clamp(firm.budgets.salaryPremium + e.salaryPremium, PREMIUM_MIN, PREMIUM_MAX)
  const customer = typeof c.params.customer === 'string' ? state.customers[c.params.customer] : undefined
  if (e.relationship && customer)
    customer.relationships[firm.id] = clamp((customer.relationships[firm.id] ?? 20) + e.relationship, 0, 100)
  const contract = contractOf(state, c)
  const running = contract && isActive(contract, state.quarter) ? contract : undefined
  if (e.satisfaction && running) running.satisfaction = clamp(running.satisfaction + e.satisfaction, 0, 100)
  if (e.satisfactionAll)
    for (const x of activeContracts(state, firm.id)) x.satisfaction = clamp(x.satisfaction + e.satisfactionAll, 0, 100)
  if (e.rateCut && running)
    running.rateMultiplier = Math.max(RATE_MIN, Math.round((running.rateMultiplier - e.rateCut) * 100) / 100)
  const star = firm.stars.find((s) => s.id === c.params.starId)
  if (star && e.starLoyalty) star.loyalty = clamp(star.loyalty + e.starLoyalty, 0, 100)
  if (star && e.benchStar) benchedThisQuarter(state, firm).starIds.push(star.id)
  if (star && e.loseStar) {
    removeStar(state, firm, star.id)
    firm.quarterLeavers += 1
  }
  if (e.bench) bench(state, firm, c, e.bench)
  if (e.leavers) leave(state, firm, c, e.leavers)
  if (e.hires) hire(state, firm, c, e.hires)
  if (e.terminate && running) terminateContract(state, running, undefined, 0)
}

// ---- lifecycle (draft only) ----

const newsOpts = (firm: Firm) => ({ firmId: firm.id, personal: firm.isPlayer })

function countOutcome(firm: Firm, outcome: CrisisOutcome) {
  firm.crisisOutcomes = { ...firm.crisisOutcomes, [outcome]: (firm.crisisOutcomes?.[outcome] ?? 0) + 1 }
}

function finish(state: GameState, c: Crisis, outcome: CrisisOutcome, bury = false) {
  const firm = state.firms[c.firmId]
  c.outcome = outcome
  c.nextStage = undefined
  if (bury) {
    c.status = 'buried'
    c.buriedUntil = state.quarter + CRISIS_BURY_QUARTERS
  } else {
    c.status = 'over'
    c.endQuarter = state.quarter
    countOutcome(firm, outcome)
  }
  if (firm.isPlayer)
    addNews(
      state,
      bury ? 'news.crisis.buried' : `news.crisis.ended.${outcome}`,
      { ...c.params, crisis: c.defId },
      outcome === 'bad' ? 'bad' : 'good',
      newsOpts(firm),
    )
}

function enterStage(state: GameState, c: Crisis, stageId: string) {
  const firm = state.firms[c.firmId]
  c.stage = stageId
  c.stageQuarter = state.quarter
  c.status = 'active'
  c.nextStage = undefined
  const stage = crisisStage(c)
  if (!stage) return finish(state, c, 'ok')
  if (stage.reveals) c.revealed = true
  if (stageId === EXPOSED_STAGE.id) {
    addNews(
      state,
      firm.isPlayer ? 'news.crisis.exposed' : 'news.crisis.exposedRival',
      { ...c.params, crisis: c.defId, firm: firm.name },
      firm.isPlayer ? 'bad' : 'sassy',
      newsOpts(firm),
    )
  }
  if (stage.onEnter)
    applyCrisisEffect(state, firm, c, scaleEffect(severityPart(stage.onEnter, c.severity), impact(firm)))
  if (stage.route) {
    const contract = contractOf(state, c)
    // The contract ended some other way in the meantime: nothing left to decide.
    if (!contract || !isActive(contract, state.quarter)) return finish(state, c, 'ok')
    c.revealed = true
    const pass = contract.satisfaction >= CRISIS_CLIENT_STAY[c.severity]
    return enterStage(state, c, pass ? stage.route.pass : stage.route.fail)
  }
}

/** Starts a crisis for a firm. `severity` is rolled unless given (tests). */
export function startCrisis(
  state: GameState,
  firm: Firm,
  def: CrisisDef,
  params: Params,
  severity?: CrisisSeverity,
): Crisis {
  const c: Crisis = {
    id: nextId(state, 'cr'),
    defId: def.id,
    firmId: firm.id,
    stage: def.stages[0].id,
    severity: severity ?? (chance(state.rng, def.highChance) ? 'high' : 'low'),
    startQuarter: state.quarter,
    stageQuarter: state.quarter,
    params,
    status: 'active',
    log: [],
  }
  state.crises = [...allCrises(state), c]
  if (firm.isPlayer) addNews(state, 'news.crisis.started', { ...params, crisis: def.id }, 'bad', newsOpts(firm))
  else if (def.scope !== 'market')
    addNews(state, `crises.${def.id}.gossip`, { ...params, firm: firm.name }, 'sassy', { firmId: firm.id })
  enterStage(state, c, def.stages[0].id)
  return c
}

/** A market crisis hits every firm at once and starts its trend. */
export function startMarketCrisis(state: GameState, def: CrisisDef) {
  if (def.trend && !state.trends.some((t) => t.id === def.trend)) {
    const t = TREND_MAP[def.trend]
    state.trends.push({ id: def.trend, untilQuarter: state.quarter + nextInt(state.rng, t.minDuration, t.maxDuration) })
  }
  addNews(state, `crises.${def.id}.news`, {}, 'bad')
  for (const id of state.firmOrder) {
    const firm = state.firms[id]
    if (!firm.bankrupt) startCrisis(state, firm, def, {})
  }
}

function resolveChoice(state: GameState, c: Crisis, choice: CrisisChoice, score: number | undefined, auto: boolean) {
  const firm = state.firms[c.firmId]
  applyCrisisEffect(state, firm, c, choiceEffect(firm, c, choice, score))
  c.log.push({
    stage: c.stage,
    choiceId: choice.id,
    quarter: state.quarter,
    ...(auto ? { auto } : {}),
    ...(choice.talk ? { score: score ?? 0 } : {}),
  })
  c.minigameStarted = undefined
  if (choice.next) {
    c.status = 'waiting'
    c.nextStage = choice.next
  } else {
    const o = choice.outcome ?? 'ok'
    finish(state, c, typeof o === 'string' ? o : o[c.severity], choice.bury)
  }
}

export function handleResolveCrisis(state: GameState, a: ActionOf<'resolveCrisis'>): string | undefined {
  const firm = state.firms[a.firmId]
  const c = allCrises(state).find((x) => x.id === a.crisisId && x.firmId === a.firmId)
  if (!firm || firm.bankrupt || !c) return 'errors.invalid'
  const error = crisisChoiceBlock(state, c, a.choiceId)
  if (error) return error
  const choice = crisisChoices(c).find((ch) => ch.id === a.choiceId)!
  // A talk only scores if it was started first (startCrisisTalk), like the UI does.
  const talked = choice.talk && c.minigameStarted === choice.id
  resolveChoice(
    state,
    c,
    choice,
    choice.talk ? (talked ? clamp(Math.round(a.score ?? 0), 0, 100) : 0) : undefined,
    false,
  )
  return undefined
}

/** Starting a crisis talk locks in the choice: reloading the page won't give a second try. */
export function handleStartCrisisTalk(state: GameState, a: ActionOf<'startCrisisTalk'>): string | undefined {
  const firm = state.firms[a.firmId]
  const c = allCrises(state).find((x) => x.id === a.crisisId && x.firmId === a.firmId)
  if (!firm || firm.bankrupt || !c) return 'errors.invalid'
  if (c.minigameStarted) return 'errors.minigameAlreadyPlayed'
  const error = crisisChoiceBlock(state, c, a.choiceId)
  if (error) return error
  if (!crisisChoices(c).find((ch) => ch.id === a.choiceId)?.talk) return 'errors.invalid'
  c.minigameStarted = a.choiceId
  return undefined
}

/** End of turn, after the AI has answered: open stages take their fallback (an abandoned talk scores 0). */
export function autoResolveCrises(state: GameState) {
  for (const c of allCrises(state)) {
    if (c.status !== 'active') continue
    const firm = state.firms[c.firmId]
    if (firm.bankrupt) {
      c.status = 'over'
      c.endQuarter = state.quarter
      continue
    }
    const started = c.minigameStarted ? crisisChoices(c).find((ch) => ch.id === c.minigameStarted) : undefined
    const choice = started ?? fallbackChoice(c)
    if (choice) resolveChoice(state, c, choice, choice.talk ? 0 : undefined, true)
  }
}

/** Hushed-up crises may resurface; the scandal opens next quarter. Runs next to shady detection. */
export function rollCrisisExposure(
  state: GameState,
  exposeChance: Record<CrisisSeverity, number> = CRISIS_EXPOSE_CHANCE,
) {
  for (const c of allCrises(state)) {
    if (c.status !== 'buried' || state.firms[c.firmId].bankrupt) continue
    const firm = state.firms[c.firmId]
    if (chance(state.rng, exposeChance[c.severity] * (firm.isPlayer ? 1 : CRISIS_AI_EXPOSE_FACTOR))) {
      c.status = 'waiting'
      c.nextStage = EXPOSED_STAGE.id
      c.buriedUntil = undefined
    }
  }
}

/** Start of a new quarter: answered crises move on, old ones are tidied away. */
export function advanceCrises(state: GameState) {
  if (!state.crises) return
  for (const c of state.crises) {
    if (c.status === 'waiting' && c.nextStage && !state.firms[c.firmId].bankrupt) enterStage(state, c, c.nextStage)
    else if (c.status === 'buried' && c.buriedUntil !== undefined && state.quarter >= c.buriedUntil) {
      c.status = 'over'
      c.endQuarter = state.quarter
      countOutcome(state.firms[c.firmId], c.outcome ?? 'ok')
    }
  }
  state.crises = state.crises.filter(
    (c) =>
      !state.firms[c.firmId].bankrupt &&
      !(c.status === 'over' && (c.endQuarter ?? 0) < state.quarter - CRISIS_KEEP_QUARTERS),
  )
}

function lastCrisisQuarter(state: GameState): number {
  return Math.max(-Infinity, ...CRISES.map((d) => state.eventHistory[d.id] ?? -Infinity))
}

const unresolved = (c: Crisis) => c.status === 'active' || c.status === 'waiting'

/** New crises: now and then for the player, rarely (and gentler) for AI firms. Runs after advanceCrises. */
export function drawCrises(state: GameState) {
  const rngPick = <T>(xs: readonly T[]) => pick(state.rng, xs)
  const player = state.firms[state.playerId]
  const mine = crisesOf(state, player.id)
  // A firm already fighting the bank gets no new trouble: crises should sting, not topple.
  if (
    !player.bankrupt &&
    state.quarter >= CRISIS_MIN_QUARTER &&
    player.negativeCashQuarters === 0 &&
    mine.filter(unresolved).length < CRISIS_MAX_OPEN &&
    state.quarter - lastCrisisQuarter(state) >= CRISIS_GAP &&
    chance(state.rng, CRISIS_CHANCE)
  ) {
    const level = firmLevel(player)
    const candidates = CRISES.filter((d) => {
      const last = state.eventHistory[d.id]
      return (
        d.minLevel <= level &&
        (last === undefined || state.quarter - last >= d.cooldown) &&
        !mine.some((c) => c.defId === d.id && unresolved(c))
      )
    })
    const def = weightedPick(state.rng, candidates, (d) => d.weight)
    const params = def && (def.params ? def.params({ state, firm: player }, rngPick) : {})
    if (def && params) {
      state.eventHistory[def.id] = state.quarter
      if (def.scope === 'market') startMarketCrisis(state, def)
      else startCrisis(state, player, def, params)
    }
  }

  for (const id of state.firmOrder) {
    const firm = state.firms[id]
    if (firm.isPlayer || firm.bankrupt || firm.negativeCashQuarters > 0 || state.quarter < CRISIS_MIN_QUARTER) continue
    if (!chance(state.rng, CRISIS_AI_CHANCE) || crisesOf(state, id).some(unresolved)) continue
    const level = firmLevel(firm)
    const def = weightedPick(
      state.rng,
      CRISES.filter((d) => d.scope !== 'market' && d.minLevel <= level),
      (d) => d.weight,
    )
    const params = def && (def.params ? def.params({ state, firm }, rngPick) : {})
    if (def && params) startCrisis(state, firm, def, params)
  }
}
