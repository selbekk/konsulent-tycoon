import { describe, expect, it } from 'vitest'
import { GOSSIP } from '../content/gossip'
import { GOSSIP_REPEAT_QUARTERS } from './constants'
import { MILESTONES } from '../content/milestones'
import { industryGossip } from './flavor'
import { checkMilestones, trophies } from './milestones'
import { resolveDueTenders } from './tenders'
import { newTestGame } from './testUtils'
import { endTurn } from './turn'
import type { Bid, GameState, QuarterReport } from './types'

const record = (s: GameState, over: Partial<QuarterReport>): QuarterReport => ({
  quarter: s.quarter,
  revenue: 0,
  costs: 0,
  ebitda: 0,
  headcount: 6,
  utilization: 0.8,
  hires: 0,
  leavers: 0,
  fines: 0,
  fired: 0,
  ...over,
})

describe('milestones', () => {
  it('celebrates each first-time moment once, without touching the rng', () => {
    const s = newTestGame()
    const rng = s.rng.s
    s.firms.player.history.push(record(s, { revenue: 2_000_000, ebitda: 100_000 }))
    checkMilestones(s)
    checkMilestones(s)
    expect(s.firms.player.milestones).toEqual(['first_quarter', 'first_profit'])
    expect(s.news.filter((n) => n.key.startsWith('news.milestone.'))).toHaveLength(2)
    expect(s.rng.s).toBe(rng)
  })

  it('stamps a record quarter only once the game is under way and the old best is clearly beaten', () => {
    const s = newTestGame()
    const records = () => s.news.filter((n) => n.key === 'news.record.revenue')
    for (const [quarter, revenue] of [
      [0, 2_000_000],
      [1, 3_000_000],
      [2, 3_100_000],
      [3, 4_000_000],
    ]) {
      s.quarter = quarter
      s.firms.player.history.push(record(s, { revenue }))
      checkMilestones(s)
    }
    // Q1 is a record but too early, Q2 is within the margin, Q3 counts.
    expect(records().map((n) => n.quarter)).toEqual([3])
    expect(records()[0].params.amount).toBe(4_000_000)
    expect(s.firms.player.stats?.bestRevenue).toBe(4_000_000)
  })

  it('shows every milestone on the trophy wall, plus the missions done', () => {
    const s = newTestGame()
    s.firms.player.milestones = ['first_quarter']
    s.firms.player.missionsDone = ['first_win']
    const wall = trophies(s.firms.player)
    expect(wall.filter((x) => x.kind === 'milestone')).toHaveLength(MILESTONES.length)
    expect(wall.filter((x) => x.done).map((x) => x.def.id)).toEqual(['first_quarter', 'first_win'])
  })

  it('puts an estimate of the contract value on a won tender', () => {
    const s = newTestGame()
    const t = s.tenders.find((x) => !x.resolved && !x.hidden)!
    const bid: Bid = { firmId: 'player', rateMultiplier: 1, starIds: [], effort: 3, cvPad: false, ghostCv: false }
    Object.assign(t, {
      kind: 'project',
      seats: { backend: 2 },
      duration: 4,
      bids: [bid],
      dueQuarter: s.quarter,
      customerId: 'navet',
    })
    s.firms.player.fagmiljo = 100
    resolveDueTenders(s)
    const won = s.news.find((n) => n.key === 'news.tender.playerWon')
    if (!won) throw new Error(s.news.map((n) => n.key).join(', '))
    expect(won.params.amount).toBeGreaterThan(0)
  })
})

describe('industry gossip', () => {
  it('adds harmless news to the ticker without touching the rng', () => {
    const s = newTestGame()
    const rng = s.rng.s
    industryGossip(s)
    const gossip = s.news.filter((n) => n.key.startsWith('news.gossip.'))
    expect(gossip.length).toBeGreaterThan(0)
    expect(gossip.every((n) => !n.personal)).toBe(true)
    expect(s.rng.s).toBe(rng)
  })

  it('does not repeat a story for a while, and only runs seasonal ones in season', () => {
    let s = newTestGame()
    for (let i = 0; i < 8; i++) s = endTurn(s)
    const seen = s.news.filter((n) => n.key.startsWith('news.gossip.'))
    for (const n of seen) {
      const again = seen.filter(
        (m) => m.key === n.key && m.quarter > n.quarter && m.quarter - n.quarter < GOSSIP_REPEAT_QUARTERS,
      )
      expect(again).toEqual([])
    }
    for (const n of seen) {
      const def = GOSSIP.find((g) => `news.gossip.${g.id}` === n.key)!
      if (def.season !== undefined) expect(n.quarter % 4).toBe(def.season)
    }
  })

  it('is deterministic', () => {
    const a = newTestGame(7)
    const b = newTestGame(7)
    industryGossip(a)
    industryGossip(b)
    expect(a.news).toEqual(b.news)
  })
})
