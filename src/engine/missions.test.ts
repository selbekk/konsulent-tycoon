import { describe, expect, it } from 'vitest'
import { MISSIONS } from '../content/missions'
import { MAX_LEVEL } from './constants'
import { checkMissions, visibleMissions } from './missions'
import { resolveDueTenders } from './tenders'
import { newTestGame } from './testUtils'
import type { Bid } from './types'

const bid: Bid = { firmId: 'player', rateMultiplier: 1, starIds: [], effort: 3, cvPad: false, ghostCv: false }

describe('missions', () => {
  it('shows only the missions up to the firm level', () => {
    const s = newTestGame()
    expect(visibleMissions(s.firms.player).every((m) => m.def.level === 1)).toBe(true)
    s.firms.player.level = MAX_LEVEL
    expect(visibleMissions(s.firms.player)).toHaveLength(MISSIONS.length)
  })

  it('completes a mission once, pays the reward and says so, without touching the rng', () => {
    const s = newTestGame()
    const rep = s.firms.player.reputation
    const rng = s.rng.s
    s.firms.player.tendersWon = 1
    checkMissions(s)
    checkMissions(s)
    expect(s.firms.player.missionsDone).toEqual(['first_win'])
    expect(s.firms.player.reputation).toBe(rep + 3)
    expect(s.news.filter((n) => n.key === 'news.mission.done')).toHaveLength(1)
    expect(s.rng.s).toBe(rng)
  })

  it('tracks public, framework and big wins for later missions', () => {
    const s = newTestGame()
    const t = s.tenders.find((x) => !x.resolved && !x.hidden)!
    Object.assign(t, { kind: 'framework', seats: { backend: 16 }, bids: [bid], dueQuarter: s.quarter, customerId: 'navet' })
    s.firms.player.fagmiljo = 100
    resolveDueTenders(s)
    expect(s.firms.player.stats).toMatchObject({ frameworkWins: 1, biggestWin: 16, publicWins: 1 })
  })
})
