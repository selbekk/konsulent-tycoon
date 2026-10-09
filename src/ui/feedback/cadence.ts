/**
 * When the game asks for feedback by itself. It should feel like a question now and then, not a nag:
 * only at natural breaks (a quarter report well into a game, or the end screen), never twice in a short while,
 * a longer pause each time the player waves it off, and a long rest after they've answered.
 * The menu button is always there, whatever this says.
 */

const DAY = 24 * 60 * 60 * 1000

/** A quarter report only asks once the player has had time to form an opinion (two years in). */
export const FEEDBACK_MIN_QUARTER = 8
/** Days between two unprompted questions. */
export const FEEDBACK_ASK_PAUSE_DAYS = 7
/** Each "not now" doubles the pause, up to this many days. */
export const FEEDBACK_MAX_PAUSE_DAYS = 90
/** Days of quiet after the player has sent feedback. */
export const FEEDBACK_SENT_PAUSE_DAYS = 60

export interface FeedbackMemory {
  /** When the game last asked by itself (ms). */
  askedAt?: number
  /** When the player last sent feedback, from anywhere (ms). */
  sentAt?: number
  /** Times in a row the player said "not now"; reset by sending. */
  dismissals?: number
}

export type AskContext = { at: 'report'; quarter: number } | { at: 'end' }

export function shouldAskForFeedback(memory: FeedbackMemory, now: number, context: AskContext): boolean {
  if (context.at === 'report' && context.quarter < FEEDBACK_MIN_QUARTER) return false
  if (memory.sentAt !== undefined && now - memory.sentAt < FEEDBACK_SENT_PAUSE_DAYS * DAY) return false
  if (memory.askedAt === undefined) return true
  const pause = Math.min(FEEDBACK_ASK_PAUSE_DAYS * 2 ** (memory.dismissals ?? 0), FEEDBACK_MAX_PAUSE_DAYS)
  return now - memory.askedAt >= pause * DAY
}

const KEY = 'kt.feedback'

export function readFeedbackMemory(): FeedbackMemory {
  try {
    const raw = localStorage.getItem(KEY)
    const v: unknown = raw ? JSON.parse(raw) : null
    return typeof v === 'object' && v !== null ? (v as FeedbackMemory) : {}
  } catch {
    return {}
  }
}

function update(change: (m: FeedbackMemory) => FeedbackMemory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(change(readFeedbackMemory())))
  } catch {
    /* no storage: the game may ask again next visit, which is fine */
  }
}

export const rememberAsked = (now = Date.now()) => update((m) => ({ ...m, askedAt: now }))
export const rememberDismissed = () => update((m) => ({ ...m, dismissals: (m.dismissals ?? 0) + 1 }))
export const rememberSent = (now = Date.now()) => update((m) => ({ ...m, sentAt: now, dismissals: 0 }))
