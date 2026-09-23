import { BUZZWORDS } from '../content/buzzwords'
import { CUSTOMERS } from '../content/customers'
import { MEETING_QUESTIONS, MEETING_STYLES, OPPOSITE_STYLE, QUESTION_SECTOR } from '../content/meetingQuestions'
import type { MeetingQuestion } from '../content/meetingQuestions'
import { clamp } from './constants'
import { createRng, hashString, shuffle } from './rng'
import type { MeetingStyle, Tender } from './types'

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
