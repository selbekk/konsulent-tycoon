import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES } from '../content/starNames'
import {
  CAREER_START_AGE,
  CAREER_START_AGE_SPREAD,
  EMPLOYEE_NAME_TRIES,
  EXPERIENCE_PER_LEVEL,
  EXPERIENCE_SPREAD,
  FEMALE_SHARE,
  NONBINARY_SHARE,
} from './constants'
import { createRng, hashString, nextFloat, noise, pick } from './rng'
import type { RngState } from './rng'
import type { Discipline, Gender, GameState, Profile } from './types'

/*
 * Gender, age and experience, for the people statistics. Drawn from a hash of the seed and the
 * person's id, never from state.rng or the roster RNG, so adding them didn't shift any other draw.
 */

const profileRng = (state: GameState, key: string): RngState => createRng(hashString(`${state.seed}:${key}:profile`))

function drawProfile(rng: RngState, discipline: Discipline, level: number, quarter: number): Required<Profile> {
  const roll = nextFloat(rng)
  const gender: Gender = roll < NONBINARY_SHARE ? 'nonbinary' : roll < NONBINARY_SHARE + FEMALE_SHARE[discipline] ? 'female' : 'male'
  const years = Math.max(0, (level - 1) * EXPERIENCE_PER_LEVEL + noise(rng, EXPERIENCE_SPREAD))
  const startAge = CAREER_START_AGE + nextFloat(rng) * CAREER_START_AGE_SPREAD
  const careerStartQuarter = quarter - Math.round(years * 4)
  return { gender, careerStartQuarter, bornQuarter: careerStartQuarter - Math.round(startAge * 4) }
}

/** A new person's profile. `key` must be unique to them (firm and roster id, or star id). */
export function newProfile(state: GameState, key: string, discipline: Discipline, level: number): Required<Profile> {
  return drawProfile(profileRng(state, key), discipline, level, state.quarter)
}

/**
 * Swaps the first name for one that fits the gender, if it doesn't already. Names are drawn as
 * before (from state.rng for stars, the roster RNG for employees), so every other draw stays put.
 */
export function fitName(state: GameState, key: string, name: string, gender: Gender, taken?: ReadonlySet<string>): string {
  if (gender === 'nonbinary') return name
  const names = gender === 'female' ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES
  const [first, ...rest] = name.split(' ')
  if (names.includes(first)) return name
  const rng = createRng(hashString(`${state.seed}:${key}:name`))
  let fitted = [pick(rng, names), ...rest].join(' ')
  for (let i = 1; i < EMPLOYEE_NAME_TRIES && taken?.has(fitted); i++) fitted = [pick(rng, names), ...rest].join(' ')
  return fitted
}

interface Person extends Profile {
  id: string
  name: string
  discipline: Discipline
  level: number
  joinedQuarter?: number
}

/** Stored profile, or one derived from the id for people from early saves. Pure. */
export function profileOf(state: GameState, p: Person): Required<Profile> {
  if (p.gender && p.bornQuarter !== undefined && p.careerStartQuarter !== undefined) {
    return { gender: p.gender, bornQuarter: p.bornQuarter, careerStartQuarter: p.careerStartQuarter }
  }
  const drawn = drawProfile(profileRng(state, p.id), p.discipline, p.level, p.joinedQuarter ?? 0)
  // Their name was drawn without a gender, so let a gendered first name decide.
  const first = p.name.split(' ')[0]
  if (drawn.gender !== 'nonbinary') drawn.gender = FEMALE_FIRST_NAMES.includes(first) ? 'female' : MALE_FIRST_NAMES.includes(first) ? 'male' : drawn.gender
  return drawn
}

export const ageAt = (profile: Required<Profile>, quarter: number) => (quarter - profile.bornQuarter) / 4
export const experienceAt = (profile: Required<Profile>, quarter: number) => Math.max(0, (quarter - profile.careerStartQuarter) / 4)
