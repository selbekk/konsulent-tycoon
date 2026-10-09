/**
 * Player feedback: a 1–5 rating and an optional comment, sent to the `submitFeedback` Cloud Function.
 * Pure and shared, like submission.ts: the app builds the payload and the server checks it again with `parseFeedback`.
 */

export const FEEDBACK_SOURCES = ['report', 'end', 'menu'] as const
/** Where the player was asked: after a quarter report, on the end screen, or from the main menu. */
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

export const FEEDBACK_LANGS = ['nb', 'en'] as const
export type FeedbackLang = (typeof FEEDBACK_LANGS)[number]

/** Characters, after trimming. The text box stops here too. */
export const FEEDBACK_MAX_TEXT = 1000

export interface Feedback {
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  lang: FeedbackLang
  source: FeedbackSource
  /** The quarter of the game being played (0–39), or null outside a game. */
  quarter: number | null
}

const KEYS: ReadonlySet<string> = new Set(['rating', 'text', 'lang', 'source', 'quarter'])

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

/** Checks untrusted input and returns a clean copy, or null. Unknown keys are refused rather than dropped. */
export function parseFeedback(data: unknown): Feedback | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (Object.keys(d).some((k) => !KEYS.has(k))) return null
  const { rating, text, lang, source, quarter } = d
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return null
  if (text !== undefined && typeof text !== 'string') return null
  const clean = (text ?? '').trim()
  if (clean.length > FEEDBACK_MAX_TEXT) return null
  if (!oneOf(FEEDBACK_LANGS, lang) || !oneOf(FEEDBACK_SOURCES, source)) return null
  if (quarter !== null && (typeof quarter !== 'number' || !Number.isInteger(quarter) || quarter < 0 || quarter > 99))
    return null
  return { rating: rating as Feedback['rating'], text: clean, lang, source, quarter }
}
