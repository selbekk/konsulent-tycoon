import { describe, expect, it } from 'vitest'
import { scoreBingo, scoreMeeting, setupBingo, setupMeeting } from './minigames'
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
})
