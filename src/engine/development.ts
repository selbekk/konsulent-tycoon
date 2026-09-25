import { QUIRK_MAP } from '../content/quirks'
import { TRAITS } from '../content/traits'
import {
  CAREER_BROKEN_MORALE,
  CAREER_GROWTH_FACTOR,
  CAREER_KEPT_MORALE,
  CAREER_PROMISE_GROWTH,
  CAREER_PROMISE_QUARTERS,
  COURSE_COST,
  COURSE_LEVEL_GAIN,
  COURSE_MAX_LEVEL,
  COURSE_QUARTERS,
  HOMEGROWN_LOYALTY,
  HOMEGROWN_PREMIUM,
  MAX_POOL_LEVEL,
  MAX_STAR_LEVEL,
  MENTOR_LEVEL_GAIN,
  MENTOR_LEVEL_GAP,
  MENTOR_TRAIT_FACTOR,
  POTENTIAL_EXPONENT,
  POTENTIAL_GROWTH_BONUS,
  POTENTIAL_REVEAL_TENURE,
  PROMOTE_COOLDOWN,
  PROMOTE_COST,
  PROMOTE_MIN_LEVEL,
  PROMOTE_MIN_POTENTIAL,
  STRETCH_LEVEL_GAIN,
  STRETCH_SATISFACTION_CHANCE,
  STRETCH_SATISFACTION_HIT,
  clamp,
} from './constants'
import { isActive } from './economy'
import { hasFeature } from './levels'
import { profileOf } from './profile'
import { employeeOf, removePeople, rosterRng, syncPool } from './roster'
import { chance, nextFloat, pick } from './rng'
import { AMBITIONS } from './stars'
import { DISCIPLINES } from './types'
import type { ActionOf, Contract, Employee, Firm, GameState, Star } from './types'
import { addNews, nextId } from './util'

/*
 * Growing the player's own people: courses, mentors, stretch assignments and career talks, and
 * promotion to star. The block functions are pure and shared by the reducer and the UI.
 */

export type PotentialBand = 'low' | 'medium' | 'high'
export const potentialBand = (p: number): PotentialBand => (p >= PROMOTE_MIN_POTENTIAL ? 'high' : p >= 0.4 ? 'medium' : 'low')

/** Multiplies every level gain for this person. */
export function growthFactor(e: Employee): number {
  const quirks = e.quirks.reduce((f, q) => f * (QUIRK_MAP[q]?.growth ?? 1), 1)
  return (1 + POTENTIAL_GROWTH_BONUS * e.potential) * quirks * (e.promise ? CAREER_GROWTH_FACTOR : 1)
}

export const tenure = (state: GameState, e: Employee) => state.quarter - e.joinedQuarter

export function courseBlock(firm: Firm, e: Employee): string | undefined {
  if (!hasFeature(firm, 'development')) return 'errors.levelTooLow'
  if (e.course) return 'errors.alreadyOnCourse'
  if (e.level >= COURSE_MAX_LEVEL) return 'errors.courseMaxLevel'
  if (firm.cash < COURSE_COST) return 'errors.notEnoughCash'
  return undefined
}

export function promotionBlock(state: GameState, firm: Firm, e: Employee): string | undefined {
  if (!hasFeature(firm, 'stars')) return 'errors.levelTooLow'
  if (!e.potentialRevealed || e.potential < PROMOTE_MIN_POTENTIAL) return 'errors.noPotential'
  if (e.level < PROMOTE_MIN_LEVEL) return 'errors.notReadyForPromotion'
  if (firm.lastPromotionQuarter !== undefined && state.quarter - firm.lastPromotionQuarter < PROMOTE_COOLDOWN) return 'errors.promotedRecently'
  if (firm.cash < PROMOTE_COST) return 'errors.notEnoughCash'
  return undefined
}

/** Highest level a star can bring a mentee to. */
export const mentorCap = (star: Star) => star.level - MENTOR_LEVEL_GAP

export function mentorBlock(firm: Firm, e: Employee, star: Star | undefined): string | undefined {
  if (!hasFeature(firm, 'development')) return 'errors.levelTooLow'
  if (!star) return 'errors.invalidStar'
  if (star.discipline !== e.discipline) return 'errors.mentorDiscipline'
  if (e.level >= mentorCap(star)) return 'errors.mentorLevel'
  if (firm.roster?.some((x) => x.mentorStarId === star.id && x.id !== e.id)) return 'errors.mentorBusy'
  return undefined
}

/** Running contracts with seats in this person's discipline. */
export function stretchContracts(state: GameState, firm: Firm, e: Employee): Contract[] {
  return state.contracts.filter(
    (c) => c.firmId === firm.id && isActive(c, state.quarter) && (c.activeSeats[e.discipline] ?? 0) > 0,
  )
}

export function stretchBlock(state: GameState, firm: Firm, e: Employee, contractId: string): string | undefined {
  if (!hasFeature(firm, 'development')) return 'errors.levelTooLow'
  if (e.level >= MAX_POOL_LEVEL) return 'errors.courseMaxLevel'
  const c = stretchContracts(state, firm, e).find((x) => x.id === contractId)
  if (!c) return 'errors.stretchContract'
  // One stretcher per seat in their discipline.
  const others = firm.roster?.filter((x) => x.id !== e.id && x.discipline === e.discipline && x.stretchContractId === c.id).length ?? 0
  if (others >= (c.activeSeats[e.discipline] ?? 0)) return 'errors.stretchFull'
  return undefined
}

export function careerTalkBlock(firm: Firm, e: Employee): string | undefined {
  if (!hasFeature(firm, 'development')) return 'errors.levelTooLow'
  if (e.promise) return 'errors.promiseActive'
  if (e.level >= MAX_POOL_LEVEL - CAREER_PROMISE_GROWTH) return 'errors.courseMaxLevel'
  return undefined
}

function reveal(state: GameState, firm: Firm, e: Employee) {
  if (e.potentialRevealed) return
  e.potentialRevealed = true
  if (e.potential >= PROMOTE_MIN_POTENTIAL)
    addNews(state, 'news.staff.talentSpotted', { name: e.name, discipline: e.discipline }, 'good', { firmId: firm.id, personal: true })
}

function poolMorale(firm: Firm, delta: number) {
  for (const d of DISCIPLINES) firm.pools[d].morale = clamp(firm.pools[d].morale + delta, 0, 100)
}

/** Once per quarter for a firm with a roster, after departments and before morale. */
export function developRoster(state: GameState, firm: Firm) {
  if (!firm.roster) return
  const quitters: Employee[] = []
  const graduates: Employee[] = []
  for (const e of firm.roster) {
    const f = growthFactor(e)
    if (e.course) {
      if (e.level < COURSE_MAX_LEVEL) e.level = Math.min(COURSE_MAX_LEVEL, e.level + (COURSE_LEVEL_GAIN / COURSE_QUARTERS) * f)
      if (state.quarter >= e.course.untilQuarter - 1) {
        delete e.course
        graduates.push(e)
        reveal(state, firm, e)
      }
    }
    if (e.mentorStarId) {
      const star = firm.stars.find((s) => s.id === e.mentorStarId)
      if (!star) delete e.mentorStarId
      else {
        const trait = star.traits.includes('mentor') ? MENTOR_TRAIT_FACTOR : 1
        const cap = mentorCap(star)
        if (e.level < cap) e.level = Math.min(cap, e.level + MENTOR_LEVEL_GAIN * trait * f)
        reveal(state, firm, e)
        // Nothing more to learn: the star is free for someone else.
        if (e.level >= cap) delete e.mentorStarId
      }
    }
    if (e.stretchContractId) {
      const c = stretchContracts(state, firm, e).find((x) => x.id === e.stretchContractId)
      if (!c) delete e.stretchContractId
      else {
        const risk = (STRETCH_SATISFACTION_CHANCE * (MAX_POOL_LEVEL - e.level)) / 4
        e.level = Math.min(MAX_POOL_LEVEL, e.level + STRETCH_LEVEL_GAIN * f)
        if (chance(rosterRng(state, firm, 'stretch'), risk)) c.satisfaction = clamp(c.satisfaction - STRETCH_SATISFACTION_HIT, 0, 100)
      }
    }
    if (tenure(state, e) + 1 >= POTENTIAL_REVEAL_TENURE) reveal(state, firm, e)
    if (e.promise && state.quarter >= e.promise.dueQuarter - 1) {
      const kept = e.level - e.promise.levelAtTalk >= CAREER_PROMISE_GROWTH - 1e-9
      delete e.promise
      if (kept) {
        poolMorale(firm, CAREER_KEPT_MORALE)
        addNews(state, 'news.staff.promiseKept', { name: e.name }, 'good', { firmId: firm.id, personal: true })
      } else quitters.push(e)
    }
  }
  if (graduates.length)
    addNews(state, 'news.staff.courseDone', { name: graduates[0].name, count: graduates.length }, 'neutral', { firmId: firm.id, personal: true })
  for (const e of quitters) {
    removePeople(state, firm, e.discipline, 1, { employeeId: e.id })
    firm.quarterLeavers += 1
    poolMorale(firm, -CAREER_BROKEN_MORALE)
    addNews(state, 'news.staff.promiseBroken', { name: e.name }, 'bad', { firmId: firm.id, personal: true })
  }
  for (const d of DISCIPLINES) syncPool(firm, d)
}

const firmOf = (state: GameState, id: string) => {
  const f = state.firms[id]
  return f && !f.bankrupt ? f : undefined
}

export function handleTrain(state: GameState, a: ActionOf<'trainEmployee'>): string | undefined {
  const firm = firmOf(state, a.firmId)
  if (!firm || !DISCIPLINES.includes(a.discipline)) return 'errors.invalid'
  if (!firm.roster) {
    // AI firms: the same course spread over the pool, with an average potential.
    if (!hasFeature(firm, 'development')) return 'errors.levelTooLow'
    const p = firm.pools[a.discipline]
    if (!p.count) return 'errors.invalid'
    if (p.level >= COURSE_MAX_LEVEL) return 'errors.courseMaxLevel'
    if (firm.cash < COURSE_COST) return 'errors.notEnoughCash'
    firm.cash -= COURSE_COST
    const avgPotential = 1 / (POTENTIAL_EXPONENT + 1)
    p.level = Math.min(COURSE_MAX_LEVEL, p.level + (COURSE_LEVEL_GAIN * (1 + POTENTIAL_GROWTH_BONUS * avgPotential)) / p.count)
    return undefined
  }
  const e = a.employeeId
    ? employeeOf(firm, a.employeeId)
    : // No one named: the most promising person who can go.
      firm.roster
        .filter((x) => x.discipline === a.discipline && !courseBlock(firm, x))
        .sort((x, y) => Number(!!y.potentialRevealed) * y.potential - Number(!!x.potentialRevealed) * x.potential || x.level - y.level)[0]
  if (!e) return 'errors.invalidEmployee'
  const blocked = courseBlock(firm, e)
  if (blocked) return blocked
  firm.cash -= COURSE_COST
  e.course = { untilQuarter: state.quarter + COURSE_QUARTERS }
  return undefined
}

export function handleSetMentor(state: GameState, a: ActionOf<'setMentor'>): string | undefined {
  const firm = firmOf(state, a.firmId)
  const e = firm && employeeOf(firm, a.employeeId)
  if (!firm || !e) return 'errors.invalidEmployee'
  if (!a.starId) {
    delete e.mentorStarId
    return undefined
  }
  const blocked = mentorBlock(firm, e, firm.stars.find((s) => s.id === a.starId))
  if (blocked) return blocked
  e.mentorStarId = a.starId
  return undefined
}

export function handleSetStretch(state: GameState, a: ActionOf<'setStretch'>): string | undefined {
  const firm = firmOf(state, a.firmId)
  const e = firm && employeeOf(firm, a.employeeId)
  if (!firm || !e) return 'errors.invalidEmployee'
  if (!a.contractId) {
    delete e.stretchContractId
    return undefined
  }
  const blocked = stretchBlock(state, firm, e, a.contractId)
  if (blocked) return blocked
  e.stretchContractId = a.contractId
  return undefined
}

export function handleCareerTalk(state: GameState, a: ActionOf<'careerTalk'>): string | undefined {
  const firm = firmOf(state, a.firmId)
  const e = firm && employeeOf(firm, a.employeeId)
  if (!firm || !e) return 'errors.invalidEmployee'
  const blocked = careerTalkBlock(firm, e)
  if (blocked) return blocked
  e.promise = { dueQuarter: state.quarter + CAREER_PROMISE_QUARTERS, levelAtTalk: e.level }
  return undefined
}

export function handlePromote(state: GameState, a: ActionOf<'promoteEmployee'>): string | undefined {
  const firm = firmOf(state, a.firmId)
  const e = firm && employeeOf(firm, a.employeeId)
  if (!firm || !e) return 'errors.invalidEmployee'
  const blocked = promotionBlock(state, firm, e)
  if (blocked) return blocked
  firm.cash -= PROMOTE_COST
  firm.lastPromotionQuarter = state.quarter
  const rng = rosterRng(state, firm, 'promote')
  const traits = [...new Set(e.quirks.map((q) => QUIRK_MAP[q]?.becomesTrait).filter((t): t is string => !!t))].slice(0, 2)
  if (!traits.length) traits.push(pick(rng, TRAITS).id)
  const star: Star = {
    id: nextId(state, 's'),
    name: e.name,
    discipline: e.discipline,
    level: clamp(Math.round(e.level), 3, MAX_STAR_LEVEL),
    traits,
    ambition: AMBITIONS[Math.floor(nextFloat(rng) * AMBITIONS.length)],
    morale: Math.max(70, firm.pools[e.discipline].morale),
    loyalty: HOMEGROWN_LOYALTY,
    salaryPremium: HOMEGROWN_PREMIUM,
    homegrown: true,
    joinedQuarter: e.joinedQuarter,
    // Same person, new id: keep who they are.
    ...profileOf(state, e),
  }
  removePeople(state, firm, e.discipline, 1, { employeeId: e.id })
  if (e.promise) {
    poolMorale(firm, CAREER_KEPT_MORALE)
    addNews(state, 'news.staff.promiseKept', { name: e.name }, 'good', { firmId: firm.id, personal: true })
  }
  firm.stars.push(star)
  addNews(state, 'news.staff.promoted', { name: e.name, discipline: e.discipline }, 'good', { firmId: firm.id, personal: true })
  return undefined
}
