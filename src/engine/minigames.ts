import { BUZZWORDS } from '../content/buzzwords'
import { CRISIS_TALK_QUESTIONS, OPPOSITE_TALK_STYLE, TALK_PREFERENCE_WEIGHTS, TALK_STYLES } from '../content/crisisTalks'
import type { TalkStyle } from '../content/crisisTalks'
import { CUSTOMERS } from '../content/customers'
import { MEETING_QUESTIONS, MEETING_STYLES, OPPOSITE_STYLE, QUESTION_SECTOR } from '../content/meetingQuestions'
import type { MeetingQuestion } from '../content/meetingQuestions'
import { clamp } from './constants'
import { createRng, hashString, nextFloat, shuffle } from './rng'
import type { CrisisMinigame, MeetingStyle, Tender } from './types'

/**
 * Minigames run in the UI with their own hash-seeded RNG – they never touch state.rng.
 * The resulting score is stored via the `recordMinigame` action.
 */
const uiRng = (tender: Tender, firmId: string, salt: string) => createRng(hashString(`${tender.id}:${firmId}:${salt}`))

export interface MeetingRound {
  question: MeetingQuestion
  /** Answer order as shown. */
  styles: MeetingStyle[]
}

export function setupMeeting(tender: Tender, firmId: string): MeetingRound[] {
  const rng = uiRng(tender, firmId, 'meeting')
  const sector = CUSTOMERS.find((c) => c.id === tender.customerId)?.sector
  const fits = MEETING_QUESTIONS.filter((q) => !QUESTION_SECTOR[q] || QUESTION_SECTOR[q] === sector)
  return shuffle(rng, fits)
    .slice(0, 3)
    .map((question) => ({ question, styles: shuffle(rng, MEETING_STYLES) }))
}

export function answerScore(style: MeetingStyle, preference: MeetingStyle): number {
  if (style === preference) return 33
  if (OPPOSITE_STYLE[preference] === style) return 0
  return 15
}

export function reactionFor(style: MeetingStyle, preference: MeetingStyle): 'love' | 'ok' | 'hate' {
  const s = answerScore(style, preference)
  return s === 33 ? 'love' : s === 0 ? 'hate' : 'ok'
}

/** Three answers → 0–100. One point for answering at least one question quickly. */
export function scoreMeeting(answers: { style: MeetingStyle; ms: number }[], preference: MeetingStyle): number {
  const base = answers.reduce((s, a) => s + answerScore(a.style, preference), 0)
  const quick = answers.some((a) => a.ms < 5000) ? 1 : 0
  return clamp(base + quick, 0, 100)
}

export interface BingoBoard {
  words: string[]
  correct: string[]
}

export function setupBingo(tender: Tender, firmId: string): BingoBoard {
  const rng = uiRng(tender, firmId, 'bingo')
  const correct = tender.buzzwords.slice(0, 6)
  const decoys = shuffle(rng, BUZZWORDS.filter((w) => !correct.includes(w))).slice(0, 16 - correct.length)
  return { words: shuffle(rng, [...correct, ...decoys]), correct }
}

export const BINGO_SECONDS = 20

/** Picked words vs. the correct ones, plus a time bonus of up to 10. */
export function scoreBingo(picked: string[], correct: string[], secondsLeft: number, totalSeconds = BINGO_SECONDS): number {
  if (!correct.length) return 0
  const hits = picked.filter((w) => correct.includes(w)).length
  const misses = picked.length - hits
  const base = ((hits - 0.5 * misses) / correct.length) * 100
  const bonus = hits === correct.length && misses === 0 ? (secondsLeft / totalSeconds) * 10 : 0
  return Math.round(clamp(base + bonus, 0, 100))
}

export interface TalkRound {
  question: string
  /** Answer order as shown. */
  answers: TalkStyle[]
}

/** Seconds per question in a crisis talk. Running out counts as the hated answer. */
export const TALK_SECONDS = 12

const talkRng = (crisisId: string, firmId: string, salt: string) => createRng(hashString(`${crisisId}:${firmId}:${salt}`))

/** Three questions for a crisis talk, the same every time for this crisis and firm. */
export function setupCrisisTalk(crisisId: string, firmId: string, kind: CrisisMinigame): TalkRound[] {
  const rng = talkRng(crisisId, firmId, 'talk')
  return shuffle(rng, CRISIS_TALK_QUESTIONS[kind])
    .slice(0, 3)
    .map((question) => ({ question, answers: shuffle(rng, TALK_STYLES) }))
}

/** The style this audience secretly wants. Hash-seeded, so it stays the same after a reload. */
export function talkPreference(crisisId: string, firmId: string, kind: CrisisMinigame): TalkStyle {
  const rng = talkRng(crisisId, firmId, 'preference')
  const w = TALK_PREFERENCE_WEIGHTS[kind]
  const total = TALK_STYLES.reduce((s, x) => s + w[x], 0)
  let roll = nextFloat(rng) * total
  for (const x of TALK_STYLES) {
    roll -= w[x]
    if (roll < 0) return x
  }
  return TALK_STYLES[0]
}

export function talkReaction(style: TalkStyle | null, preference: TalkStyle): 'love' | 'ok' | 'hate' {
  if (style === preference) return 'love'
  if (style === null || OPPOSITE_TALK_STYLE[preference] === style) return 'hate'
  return 'ok'
}

const TALK_POINTS = { love: 33, ok: 15, hate: 0 } as const

/** Three answers → 0–100, on the same scale as the pitch meeting. `null` = ran out of time. */
export function scoreCrisisTalk(answers: (TalkStyle | null)[], preference: TalkStyle): number {
  const reactions = answers.map((a) => talkReaction(a, preference))
  const base = reactions.reduce((s, r) => s + TALK_POINTS[r], 0)
  return clamp(base + (reactions.length === 3 && reactions.every((r) => r === 'love') ? 1 : 0), 0, 100)
}
