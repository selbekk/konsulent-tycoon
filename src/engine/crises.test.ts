import { describe, expect, it } from 'vitest'
import { CRISES, CRISIS_MAP, EXPOSED_STAGE } from '../content/crises'
import { TREND_MAP } from '../content/trends'
import { planCrisisAnswers } from './ai/crises'
import { planHumanProxy } from './ai/humanProxy'
import { CRISIS_AI_IMPACT, CRISIS_CLIENT_STAY } from './constants'
import {
  advanceCrises,
  autoResolveCrises,
  crisesOf,
  crisisChoiceBlock,
  crisisChoicePreview,
  crisisChoices,
  openCrises,
  rollCrisisExposure,
  startCrisis,
  startMarketCrisis,
} from './crises'
import { staffFirm } from './economy'
import { applyAction, applyActionInPlace } from './reducer'
import { deepFreeze, newTestGame, veteranTestGame } from './testUtils'
import { quarterTodos } from './todos'
import { endTurn } from './turn'
import type { Crisis, GameState } from './types'

const playerContract = (s: GameState) => s.contracts.find((c) => c.firmId === s.playerId && !c.terminated && c.startQuarter <= s.quarter)!

function withCrisis(defId: string, severity: 'low' | 'high', params: Record<string, string> = {}, seed = 42) {
  const s = veteranTestGame(seed)
  const c = startCrisis(s, s.firms.player, CRISIS_MAP[defId], params, severity)
  return { s, id: c.id }
}

const crisis = (s: GameState, id: string) => s.crises!.find((c) => c.id === id)!
const resolve = (s: GameState, id: string, choiceId: string, score?: number) =>
  applyAction(s, { type: 'resolveCrisis', firmId: 'player', crisisId: id, choiceId, score })

/** Ends the quarter with nobody else doing anything that could get in the way. */
function nextQuarter(s: GameState): GameState {
  return endTurn(s)
}

describe('crises', () => {
  it('a choice with a next stage waits a quarter, then opens the next stage', () => {
    const { s, id } = withCrisis('prod_outage', 'high', { contract: playerContract(veteranTestGame()).id, customer: playerContract(veteranTestGame()).customerId })
    const r = resolve(s, id, 'blameless')
    expect(r.error).toBeUndefined()
    expect(crisis(r.state, id).status).toBe('waiting')
    expect(openCrises(r.state, 'player')).toHaveLength(0)
    const next = nextQuarter(r.state)
    const c = crisis(next, id)
    expect(c.stage).toBe('postmortem')
    expect(c.status).toBe('active')
    expect(c.stageQuarter).toBe(next.quarter)
    expect(c.revealed).toBe(true)
    // The revealed stage offers the choices for the real severity only.
    expect(crisisChoices(c).map((ch) => ch.id)).toEqual(['own_it', 'credit_note', 'move_on'])
  })

  it('an unanswered stage takes its free fallback at the end of the quarter', () => {
    const { s, id } = withCrisis('power_outage', 'low')
    const cash = s.firms.player.cash
    const draft = structuredClone(s)
    autoResolveCrises(draft)
    const c = crisis(draft, id)
    expect(c.log).toEqual([{ stage: 'dark', choiceId: 'pause', quarter: s.quarter, auto: true }])
    expect(c.status).toBe('waiting')
    expect(draft.firms.player.cash).toBe(cash)
  })

  it('benched people stop billing this quarter only', () => {
    const { s, id } = withCrisis('power_outage', 'low')
    // Everyone busy, so benching someone actually costs billable work (idle people are benched for free).
    playerContract(s).activeSeats = { backend: 20, frontend: 20 }
    const before = staffFirm(s, s.firms.player).billed
    const r = resolve(s, id, 'pause')
    const p = r.state.firms.player
    expect(p.benched?.quarter).toBe(s.quarter)
    expect(staffFirm(r.state, p).billed).toBeLessThan(before)
    expect(staffFirm(r.state, p, s.quarter + 1).billed).toBe(staffFirm(s, s.firms.player, s.quarter + 1).billed)
  })

  it('a benched star is not staffed on its contract', () => {
    const s = veteranTestGame()
    const star = s.firms.player.stars[0]
    const c = playerContract(s)
    star.assignedContractId = c.id
    const cr = startCrisis(s, s.firms.player, CRISIS_MAP.client_exit, { contract: c.id, customer: c.customerId, starId: star.id, name: star.name }, 'low')
    const before = staffFirm(s, s.firms.player).billed
    const r = resolve(s, cr.id, 'send_partner')
    expect(r.error).toBeUndefined()
    expect(r.state.firms.player.benched?.starIds).toEqual([star.id])
    expect(staffFirm(r.state, r.state.firms.player).billed).toBeLessThanOrEqual(before)
  })

  it('a hushed-up crisis can resurface as a scandal', () => {
    const c0 = playerContract(veteranTestGame())
    const { s, id } = withCrisis('data_leak', 'high', { contract: c0.id, customer: c0.customerId })
    const r = resolve(s, id, 'quiet_fix')
    expect(crisis(r.state, id).status).toBe('buried')
    const draft = structuredClone(r.state)
    rollCrisisExposure(draft, { low: 1, high: 1 })
    draft.quarter += 1
    const rep = draft.firms.player.reputation
    advanceCrises(draft)
    const c = crisis(draft, id)
    expect(c.stage).toBe(EXPOSED_STAGE.id)
    expect(c.status).toBe('active')
    expect(draft.firms.player.reputation).toBeLessThan(rep)
    expect(draft.news.some((n) => n.key === 'news.crisis.exposed')).toBe(true)
  })

  it('buried crises that never resurface are over after a while', () => {
    const { s, id } = withCrisis('whistleblower', 'low', { starId: veteranTestGame().firms.player.stars[0].id })
    const r = resolve(s, id, 'drawer')
    const draft = structuredClone(r.state)
    rollCrisisExposure(draft, { low: 0, high: 0 })
    draft.quarter = crisis(draft, id).buriedUntil!
    advanceCrises(draft)
    expect(crisis(draft, id).status).toBe('over')
  })

  for (const [satisfaction, stage] of [
    [CRISIS_CLIENT_STAY.high, 'stayed'],
    [CRISIS_CLIENT_STAY.high - 1, 'left'],
  ] as const) {
    it(`the client decides by satisfaction: ${satisfaction} → ${stage}`, () => {
      const s = veteranTestGame()
      const c = playerContract(s)
      const cr = startCrisis(s, s.firms.player, CRISIS_MAP.client_exit, { contract: c.id, customer: c.customerId }, 'high')
      const r = resolve(s, cr.id, 'do_nothing')
      const draft = structuredClone(r.state)
      draft.contracts.find((x) => x.id === c.id)!.satisfaction = satisfaction
      draft.quarter += 1
      advanceCrises(draft)
      expect(crisis(draft, cr.id).stage).toBe(stage)
      expect(draft.contracts.find((x) => x.id === c.id)!.terminated).toBe(stage === 'left')
    })
  }

  it('a market crisis hits every firm, starts its trend, and hits AI firms softer', () => {
    const s = veteranTestGame()
    startMarketCrisis(s, CRISIS_MAP.krone_crash)
    expect(s.trends.some((t) => t.id === 'krone_crash')).toBe(true)
    for (const id of s.firmOrder) expect(crisesOf(s, id)).toHaveLength(1)
    // Same choice, same headcount-scaled cost, but halved for the AI.
    const ai = s.firmOrder.find((id) => id !== 'player')!
    const aiCrisis = crisesOf(s, ai)[0]
    const pc = crisesOf(s, 'player')[0]
    const hedge = CRISIS_MAP.krone_crash.stages[0].choices.find((c) => c.id === 'hedge')!
    const perHead = (st: GameState, cr: Crisis) => crisisChoicePreview(st, cr, hedge).cash / (st.firms[cr.firmId].stars.length + Object.values(st.firms[cr.firmId].pools).reduce((n, p) => n + p.count, 0))
    expect(perHead(s, aiCrisis)).toBeCloseTo(perHead(s, pc) * CRISIS_AI_IMPACT)
    expect(s.news.filter((n) => n.key === 'crises.krone_crash.news')).toHaveLength(1)
  })

  it('a crisis talk locks in the choice once started, and an abandoned one scores zero', () => {
    const c0 = playerContract(veteranTestGame())
    const { s, id } = withCrisis('client_exit', 'low', { contract: c0.id, customer: c0.customerId })
    const started = applyAction(s, { type: 'startCrisisTalk', firmId: 'player', crisisId: id, choiceId: 'rescue_meeting' })
    expect(started.error).toBeUndefined()
    expect(resolve(started.state, id, 'discount').error).toBe('errors.minigameAlreadyPlayed')
    expect(applyAction(started.state, { type: 'startCrisisTalk', firmId: 'player', crisisId: id, choiceId: 'rescue_meeting' }).error).toBe(
      'errors.minigameAlreadyPlayed',
    )
    const draft = structuredClone(started.state)
    const sat = draft.contracts.find((x) => x.id === c0.id)!.satisfaction
    autoResolveCrises(draft)
    expect(crisis(draft, id).log[0]).toMatchObject({ choiceId: 'rescue_meeting', score: 0, auto: true })
    // Base +6, talk gone badly −6.
    expect(draft.contracts.find((x) => x.id === c0.id)!.satisfaction).toBe(sat)
  })

  it('a good talk pays off', () => {
    const c0 = playerContract(veteranTestGame())
    const { s, id } = withCrisis('client_exit', 'low', { contract: c0.id, customer: c0.customerId })
    const sat = s.contracts.find((x) => x.id === c0.id)!.satisfaction
    const r = resolve(s, id, 'rescue_meeting', 90)
    expect(r.state.contracts.find((x) => x.id === c0.id)!.satisfaction).toBe(Math.min(100, sat + 6 + 11))
  })

  it('choices that need something missing are blocked, fallbacks never are', () => {
    const { s, id } = withCrisis('whistleblower', 'high', { starId: 'nobody' })
    const c = crisis(s, id)
    expect(crisisChoiceBlock(s, c, 'investigate')).toBe('errors.crisisNeedsStar')
    expect(crisisChoiceBlock(s, c, 'drawer')).toBeUndefined()
    s.firms.player.cash = -1e12
    expect(crisisChoiceBlock(s, c, 'drawer')).toBeUndefined()
  })

  it('UI helpers are pure: no input mutation, no rng draws', () => {
    const c0 = playerContract(veteranTestGame())
    const { s } = withCrisis('data_leak', 'high', { contract: c0.id, customer: c0.customerId })
    const frozen = deepFreeze(structuredClone(s))
    const rng = frozen.rng.s
    for (const c of frozen.crises!) {
      for (const ch of crisisChoices(c)) {
        crisisChoicePreview(frozen, c, ch)
        crisisChoiceBlock(frozen, c, ch.id)
      }
    }
    quarterTodos(frozen, 'player')
    expect(frozen.rng.s).toBe(rng)
  })

  it('an open crisis is a to-do that one answer ticks off', () => {
    const { s, id } = withCrisis('power_outage', 'low')
    expect(quarterTodos(s, 'player').find((t) => t.id === 'crisis')).toMatchObject({ done: false, params: { count: 1 } })
    const r = resolve(s, id, 'generator')
    expect(quarterTodos(r.state, 'player').find((t) => t.id === 'crisis')?.done).toBe(true)
  })

  it('previews do not give away a hidden severity', () => {
    const c0 = playerContract(veteranTestGame())
    const low = withCrisis('slack_slip', 'low', { contract: c0.id, customer: c0.customerId })
    const high = withCrisis('slack_slip', 'high', { contract: c0.id, customer: c0.customerId })
    for (const ch of crisisChoices(crisis(low.s, low.id))) {
      expect(crisisChoicePreview(low.s, crisis(low.s, low.id), ch)).toEqual(crisisChoicePreview(high.s, crisis(high.s, high.id), ch))
    }
  })

  it('AI answers are always accepted, and whole games stay deterministic', () => {
    const play = (seed: number) => {
      let s = newTestGame(seed)
      let rejected = 0
      let seen = 0
      for (let q = 0; q < 24 && s.status === 'playing'; q++) {
        const draft = structuredClone(s)
        for (const id of draft.firmOrder) {
          for (const a of planCrisisAnswers(draft, id)) {
            seen++
            if (applyActionInPlace(draft, a)) rejected++
          }
        }
        s = endTurn(draft)
      }
      return { s, rejected, seen }
    }
    const a = play(3)
    expect(a.rejected).toBe(0)
    expect(a.seen).toBeGreaterThan(0)
    expect(JSON.stringify(play(3).s)).toBe(JSON.stringify(a.s))
  })

  it('the player gets roughly one crisis every three to four quarters', () => {
    let total = 0
    const games = 6
    for (let seed = 1; seed <= games; seed++) {
      let s = newTestGame(seed)
      const seen = new Set<string>()
      while (s.status === 'playing') {
        const draft = structuredClone(s)
        for (const a of planCrisisAnswers(draft, 'player')) applyActionInPlace(draft, a)
        for (const a of planHumanProxy(draft)) applyActionInPlace(draft, a)
        for (const c of crisesOf(draft, 'player')) seen.add(c.id)
        s = endTurn(draft)
      }
      for (const c of crisesOf(s, 'player')) seen.add(c.id)
      total += seen.size
    }
    // Market crises count once per firm, so the player's list is the right measure.
    expect(total / games).toBeGreaterThan(6)
    expect(total / games).toBeLessThan(16)
  })
})

describe('crisis content', () => {
  const severities = ['low', 'high'] as const
  for (const def of [...CRISES]) {
    it(`${def.id} is well-formed`, () => {
      const ids = new Set(def.stages.map((s) => s.id))
      const reached = new Set([def.stages[0].id])
      for (const stage of def.stages) {
        for (const ch of stage.choices) {
          if (ch.next) {
            expect(ids.has(ch.next), `${stage.id}.${ch.id} → ${ch.next}`).toBe(true)
            reached.add(ch.next)
            // Moving on must not leak the hidden severity through the numbers.
            if (!stage.reveals) expect(ch.low ?? ch.high, `${stage.id}.${ch.id} leaks severity`).toBeUndefined()
          } else expect(ch.outcome, `${stage.id}.${ch.id} needs an outcome`).toBeDefined()
          if (ch.only) expect(stage.reveals, `${stage.id}.${ch.id}: only in revealing stages`).toBe(true)
          if (ch.talk) expect(ch.talkGood && ch.talkBad).toBeTruthy()
        }
        if (stage.route) {
          expect(stage.choices).toEqual([])
          for (const n of [stage.route.pass, stage.route.fail]) {
            expect(ids.has(n)).toBe(true)
            reached.add(n)
          }
          continue
        }
        for (const sev of severities) {
          const offered = stage.choices.filter((c) => !c.only || c.only === sev)
          const fallbacks = offered.filter((c) => c.fallback)
          expect(fallbacks, `${stage.id} (${sev}) needs exactly one fallback`).toHaveLength(1)
          const f = fallbacks[0]
          expect(f.needs ?? f.talk, `${stage.id}.${f.id}: fallback has needs`).toBeUndefined()
          const cost = [f.effect, f[sev]].some((e) => (e?.cash ?? 0) < 0 || (e?.cashPerHead ?? 0) < 0 || (e?.contractRevenue ?? 0) < 0)
          expect(cost, `${stage.id}.${f.id}: fallback costs cash`).toBe(false)
        }
      }
      expect([...ids].filter((id) => !reached.has(id)), 'unreachable stages').toEqual([])
      if (def.scope === 'market') expect(def.trend && TREND_MAP[def.trend]?.crisisOnly).toBe(true)
    })
  }
})
