import { EVENTS, EVENT_MAP } from '../content/events'
import type { Effect, EventCtx } from '../content/events'
import { PREMIUM_MAX, PREMIUM_MIN, clamp } from './constants'
import { averageMorale, headcount, staffFirm } from './economy'
import { chance, pick, weightedPick } from './rng'
import { removeStar, starSigningCost } from './stars'
import { DISCIPLINES } from './types'
import type { ActionOf, Firm, GameState, PendingEvent } from './types'
import { addNews, nextId } from './util'

export function eventCtx(state: GameState, firm: Firm): EventCtx {
  return {
    state,
    firm,
    headcount: headcount(firm),
    utilization: staffFirm(state, firm).utilization,
    morale: averageMorale(firm),
  }
}

/** Draws 0–2 events for the player for the current quarter. */
export function drawEvents(state: GameState) {
  const firm = state.firms[state.playerId]
  if (firm.bankrupt) return
  const ctx = eventCtx(state, firm)
  const rngPick = <T>(xs: readonly T[]) => pick(state.rng, xs)
  const slots = [0.8, 0.3]
  const taken = new Set<string>()
  for (const p of slots) {
    if (!chance(state.rng, p)) break
    const candidates = EVENTS.filter((e) => {
      if (e.special || taken.has(e.id)) return false
      if (e.minQuarter !== undefined && state.quarter < e.minQuarter) return false
      const last = state.eventHistory[e.id]
      if (last !== undefined && state.quarter - last < e.cooldown) return false
      return !e.condition || e.condition(ctx)
    })
    const def = weightedPick(state.rng, candidates, (e) => e.weight)
    if (!def) break
    const params = def.params ? def.params(ctx, rngPick) : {}
    if (params === null) continue
    taken.add(def.id)
    state.eventHistory[def.id] = state.quarter
    state.pendingEvents.push({ id: nextId(state, 'pe'), eventId: def.id, firmId: firm.id, params })
  }
}

function applyMorale(firm: Firm, delta: number) {
  for (const d of DISCIPLINES) firm.pools[d].morale = clamp(firm.pools[d].morale + delta, 0, 100)
  for (const s of firm.stars) s.morale = clamp(s.morale + delta, 0, 100)
}

export function applyEffect(state: GameState, firm: Firm, effect: Effect, pe: PendingEvent) {
  const hc = headcount(firm)
  if (effect.cash) firm.cash += effect.cash
  if (effect.cashPerHead) firm.cash += effect.cashPerHead * hc
  if (effect.reputation) firm.reputation = clamp(firm.reputation + effect.reputation, 0, 100)
  if (effect.heat) firm.heat = clamp(firm.heat + effect.heat, 0, 100)
  if (effect.fagmiljo) firm.fagmiljo = clamp(firm.fagmiljo + effect.fagmiljo, 0, 100)
  if (effect.sosialt) firm.sosialt = clamp(firm.sosialt + effect.sosialt, 0, 100)
  if (effect.morale) applyMorale(firm, effect.morale)
  if (effect.brand) firm.brandMod += effect.brand
  if (effect.salaryPremium)
    firm.budgets.salaryPremium = clamp(firm.budgets.salaryPremium + effect.salaryPremium, PREMIUM_MIN, PREMIUM_MAX)
  const customerId = pe.params.customer as string | undefined
  if (effect.relationship && customerId && state.customers[customerId]) {
    const c = state.customers[customerId]
    c.relationships[firm.id] = clamp((c.relationships[firm.id] ?? 20) + effect.relationship, 0, 100)
  }
  const star = firm.stars.find((s) => s.id === pe.params.starId)
  if (star && effect.starLoyalty) star.loyalty = clamp(star.loyalty + effect.starLoyalty, 0, 100)
  if (star && effect.starPremium) star.salaryPremium = Math.round((star.salaryPremium + effect.starPremium) * 100) / 100

  switch (effect.special) {
    case 'grant_remote':
      if (star) {
        star.remoteGranted = true
        star.loyalty = clamp(star.loyalty + 15, 0, 100)
      }
      break
    case 'acquire_agency': {
      const d = pick(state.rng, DISCIPLINES)
      const p = firm.pools[d]
      const n = 8
      p.level = (p.level * p.count + 3.2 * n) / (p.count + n)
      p.morale = (p.morale * p.count + 60 * n) / (p.count + n)
      p.count += n
      firm.reputation = clamp(firm.reputation + 2, 0, 100)
      addNews(state, 'news.firm.acquired', { firm: firm.name, discipline: d }, 'good', { personal: true })
      break
    }
    case 'hire_interns': {
      for (const d of ['frontend', 'backend', 'design'] as const) {
        const p = firm.pools[d]
        p.level = (p.level * p.count + 1.5) / (p.count + 1)
        p.count += 1
      }
      break
    }
    case 'poach_match':
      if (star) {
        firm.cash -= starSigningCost(star, firm) / 2
        star.salaryPremium = Math.round((star.salaryPremium + 0.1) * 100) / 100
        star.loyalty = clamp(star.loyalty + 20, 0, 100)
      }
      break
    case 'poach_let_go':
    case 'poach_podcast': {
      const attacker = state.firms[pe.params.firmId as string]
      if (star && attacker && !attacker.bankrupt) {
        const moved = removeStar(state, firm, star.id)!
        firm.quarterLeavers += 1
        moved.salaryPremium = Math.round((moved.salaryPremium + 0.1) * 100) / 100
        moved.loyalty = 55
        attacker.stars.push(moved)
        addNews(state, 'news.shady.poachSuccess', { name: moved.name, from: firm.name, to: attacker.name }, 'sassy', {
          personal: true,
        })
      }
      if (effect.special === 'poach_podcast') firm.reputation = clamp(firm.reputation + 2, 0, 100)
      break
    }
  }
}

export function canChoose(state: GameState, pe: PendingEvent, choiceId: string): boolean {
  const def = EVENT_MAP[pe.eventId]
  const choice = def?.choices.find((c) => c.id === choiceId)
  if (!choice) return false
  return choice.minCash === undefined || state.firms[pe.firmId].cash >= choice.minCash
}

export function handleResolveEvent(state: GameState, a: ActionOf<'resolveEvent'>): string | undefined {
  const pe = state.pendingEvents.find((p) => p.id === a.pendingEventId)
  if (!pe) return 'errors.invalid'
  const def = EVENT_MAP[pe.eventId]
  const choice = def?.choices.find((c) => c.id === a.choiceId)
  if (!def || !choice) return 'errors.invalid'
  if (!canChoose(state, pe, a.choiceId)) return 'errors.notEnoughCash'
  applyEffect(state, state.firms[pe.firmId], choice.effect, pe)
  state.pendingEvents = state.pendingEvents.filter((p) => p.id !== pe.id)
  return undefined
}

/** Unresolved events at end of turn pick their last affordable choice (usually the "do nothing" one). */
export function autoResolveEvents(state: GameState) {
  for (const pe of [...state.pendingEvents]) {
    const def = EVENT_MAP[pe.eventId]
    const choice = def ? [...def.choices].reverse().find((c) => canChoose(state, pe, c.id)) : undefined
    if (choice) applyEffect(state, state.firms[pe.firmId], choice.effect, pe)
  }
  state.pendingEvents = []
}
