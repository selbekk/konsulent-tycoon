import { describe, expect, it } from 'vitest'
import { CUSTOMERS } from '../content/customers'
import { QUESTION_SECTOR } from '../content/meetingQuestions'
import { CRISIS_TALKS, OPPOSITE_TALK_STYLE, TALK_STYLES } from '../content/crisisTalks'
import { scoreBingo, scoreCrisisTalk, scoreMeeting, setupBingo, setupCrisisTalk, setupMeeting, talkPreference } from './minigames'
import { newTestGame } from './testUtils'

describe('minigames', () => {
  const s = newTestGame()
  const tender = s.tenders[0]

  it('meeting: matching style scores best, opposite scores zero', () => {
    const fast = (style: 'concrete' | 'visionary' | 'humble' | 'buzzword') => ({ style, ms: 8000 })
    expect(scoreMeeting([fast('humble'), fast('humble'), fast('humble')], 'humble')).toBe(99)
    expect(scoreMeeting([{ style: 'humble', ms: 1000 }, fast('humble'), fast('humble')], 'humble')).toBe(100)
    expect(scoreMeeting([fast('buzzword'), fast('buzzword'), fast('buzzword')], 'humble')).toBe(0)
    expect(scoreMeeting([fast('concrete'), fast('concrete'), fast('concrete')], 'humble')).toBe(45)
  })

  it('meeting setup is deterministic and never touches game rng', () => {
    const before = s.rng.s
    expect(setupMeeting(tender, 'player')).toEqual(setupMeeting(tender, 'player'))
    expect(setupMeeting(tender, 'player')).toHaveLength(3)
    expect(s.rng.s).toBe(before)
  })

  it('meeting questions fit the customer sector', () => {
    for (const sector of ['public', 'private'] as const) {
      const customer = CUSTOMERS.find((c) => c.sector === sector)!
      for (let i = 0; i < 50; i++) {
        const rounds = setupMeeting({ ...tender, id: `t${i}`, customerId: customer.id }, 'player')
        for (const r of rounds) expect(QUESTION_SECTOR[r.question] ?? sector).toBe(sector)
      }
    }
  })

  it('bingo board contains all correct words among 16', () => {
    const b = setupBingo(tender, 'player')
    expect(b.words).toHaveLength(16)
    for (const w of b.correct) expect(b.words).toContain(w)
  })

  it('bingo scoring', () => {
    const correct = ['a', 'b', 'c', 'd']
    expect(scoreBingo(['a', 'b', 'c', 'd'], correct, 10)).toBe(100)
    expect(scoreBingo(['a', 'b', 'c', 'd'], correct, 0)).toBe(100)
    expect(scoreBingo(['a', 'b'], correct, 10)).toBe(50)
    expect(scoreBingo(['a', 'x', 'y'], correct, 10)).toBe(0)
    expect(scoreBingo([], correct, 10)).toBe(0)
  })

  it('crisis talk: the secret favourite scores best, its opposite and silence score zero', () => {
    expect(scoreCrisisTalk(['facts', 'facts', 'facts'], 'facts')).toBe(100)
    expect(scoreCrisisTalk(['candid', 'spin', 'facts'], 'facts')).toBe(15 + 15 + 33)
    expect(scoreCrisisTalk(['caring', null, 'caring'], 'facts')).toBe(0)
    for (const st of TALK_STYLES) expect(OPPOSITE_TALK_STYLE[OPPOSITE_TALK_STYLE[st]]).toBe(st)
  })

  it('crisis talk setup and favourite are stable per crisis, vary between crises, and never touch game rng', () => {
    const before = s.rng.s
    for (const kind of CRISIS_TALKS) {
      expect(setupCrisisTalk('cr1', 'player', kind)).toEqual(setupCrisisTalk('cr1', 'player', kind))
      expect(talkPreference('cr1', 'player', kind)).toBe(talkPreference('cr1', 'player', kind))
      const seen = new Set(Array.from({ length: 200 }, (_, i) => talkPreference(`cr${i}`, 'player', kind)))
      expect(seen.size).toBeGreaterThanOrEqual(3)
      for (const r of setupCrisisTalk('cr1', 'player', kind)) expect([...r.answers].sort()).toEqual([...TALK_STYLES].sort())
    }
    expect(s.rng.s).toBe(before)
  })
})
