import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_ASK_PAUSE_DAYS,
  FEEDBACK_MAX_PAUSE_DAYS,
  FEEDBACK_MIN_QUARTER,
  FEEDBACK_SENT_PAUSE_DAYS,
  shouldAskForFeedback,
} from './cadence'

const DAY = 24 * 60 * 60 * 1000
const now = 1_000 * DAY
const report = { at: 'report', quarter: 12 } as const
const end = { at: 'end' } as const

describe('shouldAskForFeedback', () => {
  it('asks a new player at the end, and in a report once the game is under way', () => {
    expect(shouldAskForFeedback({}, now, end)).toBe(true)
    expect(shouldAskForFeedback({}, now, report)).toBe(true)
    expect(shouldAskForFeedback({}, now, { at: 'report', quarter: FEEDBACK_MIN_QUARTER - 1 })).toBe(false)
  })

  it('waits after asking, longer for every "not now"', () => {
    const askedAt = now - FEEDBACK_ASK_PAUSE_DAYS * DAY
    expect(shouldAskForFeedback({ askedAt }, now, end)).toBe(true)
    expect(shouldAskForFeedback({ askedAt: askedAt + DAY }, now, end)).toBe(false)
    expect(shouldAskForFeedback({ askedAt, dismissals: 1 }, now, end)).toBe(false)
    expect(shouldAskForFeedback({ askedAt: now - 2 * FEEDBACK_ASK_PAUSE_DAYS * DAY, dismissals: 1 }, now, end)).toBe(
      true,
    )
  })

  it('caps the pause, so a player who said no many times is still asked again eventually', () => {
    const memory = { askedAt: now - FEEDBACK_MAX_PAUSE_DAYS * DAY, dismissals: 20 }
    expect(shouldAskForFeedback(memory, now, end)).toBe(true)
  })

  it('stays quiet for a long while after the player has sent something', () => {
    expect(shouldAskForFeedback({ sentAt: now - DAY }, now, end)).toBe(false)
    expect(shouldAskForFeedback({ sentAt: now - FEEDBACK_SENT_PAUSE_DAYS * DAY }, now, end)).toBe(true)
  })
})
