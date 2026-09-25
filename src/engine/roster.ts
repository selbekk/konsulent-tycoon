import { QUIRKS, QUIRK_MAP } from '../content/quirks'
import { FIRST_NAMES, LAST_NAMES, NICKNAMES } from '../content/starNames'
import {
  EMPLOYEE_MIN_LEVEL,
  EMPLOYEE_NAME_TRIES,
  EMPLOYEE_NICKNAME_CHANCE,
  MAX_POOL_LEVEL,
  MENTOR_BID_PENALTY,
  POTENTIAL_EXPONENT,
  ROSTER_LEVEL_SPREAD,
  clamp,
} from './constants'
import { fitName, newProfile } from './profile'
import { chance, createRng, hashString, nextFloat, noise, pick, shuffle } from './rng'
import type { RngState } from './rng'
import { DISCIPLINES } from './types'
import type { Discipline, Employee, Firm, GameState } from './types'
import { compareIds } from './util'

/*
 * The player's people as individuals. Pools stay what the simulation reads; for a firm with a
 * roster, every change to pool size or level goes through here so `pools[d].count` and `.level`
 * always match the roster. Firms without a roster (the AI) keep the old pool arithmetic.
 *
 * Names, quirks, potential and who leaves are drawn from a hash of the seed, firm and a running
 * counter, never from state.rng, so the roster doesn't shift the rest of the game's random draws.
 */

export function personName(rng: RngState, nicknameChance: number): string {
  const first = pick(rng, FIRST_NAMES)
  const last = pick(rng, LAST_NAMES)
  return chance(rng, nicknameChance) ? `${first} «${pick(rng, NICKNAMES)}» ${last}` : `${first} ${last}`
}

/** A fresh roster RNG. Bumps `firm.rosterSeq`, so only call on a draft. */
export function rosterRng(state: GameState, firm: Firm, salt: string): RngState {
  firm.rosterSeq = (firm.rosterSeq ?? 0) + 1
  return createRng(hashString(`${state.seed}:${firm.id}:${firm.rosterSeq}:${salt}`))
}

export function newEmployee(state: GameState, firm: Firm, discipline: Discipline, level: number): Employee {
  const rng = rosterRng(state, firm, 'new')
  const id = `e${firm.rosterSeq}`
  const quirks = shuffle(rng, QUIRKS)
    .slice(0, chance(rng, 0.4) ? 2 : 1)
    .map((q) => q.id)
  const bias = quirks.reduce((s, q) => s + (QUIRK_MAP[q]?.potential ?? 0), 0)
  const potential = clamp(nextFloat(rng) ** POTENTIAL_EXPONENT + bias, 0, 1)
  const profile = newProfile(state, id, discipline, level)
  // Two people with the same name on one roster would be confusing, so try a few times.
  const taken = new Set((firm.roster ?? []).map((e) => e.name))
  let name = personName(rng, EMPLOYEE_NICKNAME_CHANCE)
  for (let i = 1; i < EMPLOYEE_NAME_TRIES && taken.has(name); i++) name = personName(rng, EMPLOYEE_NICKNAME_CHANCE)
  return {
    id,
    name: fitName(state, id, name, profile.gender, taken),
    discipline,
    level: clamp(level + noise(rng, ROSTER_LEVEL_SPREAD), EMPLOYEE_MIN_LEVEL, MAX_POOL_LEVEL),
    potential: Math.round(potential * 1000) / 1000,
    quirks,
    joinedQuarter: state.quarter,
    ...profile,
  }
}

export const rosterIn = (firm: Firm, d: Discipline): Employee[] => (firm.roster ?? []).filter((e) => e.discipline === d)

export const employeeOf = (firm: Firm, id: string | undefined): Employee | undefined =>
  id === undefined ? undefined : firm.roster?.find((e) => e.id === id)

/** Sets the pool's count and level from the roster. The level of an empty pool is left as it was. */
export function syncPool(firm: Firm, d: Discipline) {
  if (!firm.roster) return
  const people = rosterIn(firm, d)
  const p = firm.pools[d]
  p.count = people.length
  if (people.length) p.level = people.reduce((s, e) => s + e.level, 0) / people.length
}

/**
 * Gives a firm a roster that matches its pools, with levels spread around each pool's level
 * (the average stays the same). Used for a new player firm and for saves from before rosters.
 */
export function buildRoster(state: GameState, firm: Firm) {
  firm.roster = []
  for (const d of DISCIPLINES) {
    const p = firm.pools[d]
    if (!p.count) continue
    const people: Employee[] = []
    for (let i = 0; i < p.count; i++) {
      const e = newEmployee(state, firm, d, p.level)
      people.push(e)
      firm.roster.push(e)
    }
    const shift = p.level - people.reduce((s, e) => s + e.level, 0) / people.length
    for (const e of people) {
      e.level = clamp(e.level + shift, EMPLOYEE_MIN_LEVEL, MAX_POOL_LEVEL)
      e.joinedQuarter = 0
    }
    syncPool(firm, d)
  }
}

/** `n` people join discipline `d` at about `level`. `morale` is theirs on arrival; leave it out to take the pool's. */
export function addPeople(state: GameState, firm: Firm, d: Discipline, n: number, level: number, morale?: number) {
  if (n <= 0) return
  const p = firm.pools[d]
  const total = p.count + n
  if (morale !== undefined) p.morale = (p.morale * p.count + morale * n) / total
  if (!firm.roster) {
    p.level = clamp((p.level * p.count + level * n) / total, 1, MAX_POOL_LEVEL)
    p.count = total
    return
  }
  for (let i = 0; i < n; i++) firm.roster.push(newEmployee(state, firm, d, level))
  syncPool(firm, d)
}

export type RemovePick = { employeeId: string } | 'weakest' | 'random'

/**
 * Takes up to `n` people out of discipline `d` and returns who went (empty without a roster).
 * `random` (turnover, crises) spares people with a career promise while others are left.
 */
export function removePeople(
  state: GameState,
  firm: Firm,
  d: Discipline,
  n: number,
  how: RemovePick = 'random',
): Employee[] {
  const p = firm.pools[d]
  n = Math.min(n, p.count)
  if (n <= 0) return []
  if (!firm.roster) {
    p.count -= n
    return []
  }
  let chosen: Employee[]
  const people = rosterIn(firm, d)
  if (typeof how === 'object') chosen = people.filter((e) => e.id === how.employeeId)
  else if (how === 'weakest')
    chosen = [...people].sort((a, b) => a.level - b.level || compareIds(a.id, b.id)).slice(0, n)
  else
    chosen = shuffle(rosterRng(state, firm, 'leave'), people)
      .sort((a, b) => Number(!!a.promise) - Number(!!b.promise))
      .slice(0, n)
  const gone = new Set(chosen.map((e) => e.id))
  firm.roster = firm.roster.filter((e) => !gone.has(e.id))
  syncPool(firm, d)
  return chosen
}

/** Lifts everyone below `cap` by `amount` (not above `cap`). Without a roster, lifts the pool average the same way. */
export function raiseLevel(firm: Firm, d: Discipline, amount: number, cap: number) {
  if (!firm.roster) {
    const p = firm.pools[d]
    if (p.level < cap) p.level = Math.min(cap, p.level + amount)
    return
  }
  for (const e of rosterIn(firm, d)) if (e.level < cap) e.level = Math.min(cap, e.level + amount)
  syncPool(firm, d)
}

/** A star mentoring someone bids a little weaker. */
export const mentorPenalty = (firm: Firm, starId: string): number =>
  firm.roster?.some((e) => e.mentorStarId === starId) ? MENTOR_BID_PENALTY : 0

/** Shown morale in a profile: the pool's, nudged by quirks. Display only. */
export function employeeMorale(firm: Firm, e: Employee): number {
  const mood = e.quirks.reduce((s, q) => s + (QUIRK_MAP[q]?.mood ?? 0), 0)
  return clamp(firm.pools[e.discipline].morale + mood, 0, 100)
}
