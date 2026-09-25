import { describe, expect, it, vi } from 'vitest'
import { weekBounds, weekSeed } from '../engine'
import { botRun } from '../engine/testUtils'
import { verifySubmission } from './submission'
import type { RunSubmission } from './submission'
import { ENGINE_VERSION } from './version'

// Whatever engine bug leads there, a game that replays to a valuation that isn't a number must never be ranked:
// Firestore and the callable's answer would both choke on it.
vi.mock('../engine', async (original) => ({ ...(await original<typeof import('../engine')>()), valuation: () => Number.NaN }))

describe('leaderboard submission with a broken valuation', () => {
  it('is refused, not ranked', () => {
    const week = '2026-W39'
    const { log } = botRun({ seed: weekSeed(week), firmName: 'X', founderDisciplines: ['frontend', 'pm'], difficulty: 'normal', weekly: week })
    const sub: RunSubmission = { engineVersion: ENGINE_VERSION, week, gameId: 'test-game-0001', founders: ['frontend', 'pm'], log, name: ['moose', 'owl', 'as'], claimedValuation: 0 }
    const ctx = { engineVersion: ENGINE_VERSION, now: weekBounds(week)!.start + 3 * 86_400_000 }
    expect(verifySubmission(sub, ctx)).toMatchObject({ ok: false, error: 'replayFailed', detail: 'notFinite' })
  })
})
