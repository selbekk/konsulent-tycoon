import { beforeAll, describe, expect, it } from 'vitest'
import { valuation, weekBounds, weekSeed } from '../engine'
import type { GameState, NewGameOptions, RunLog } from '../engine'
import { botRun } from '../engine/testUtils'
import { buildSubmission, verifySubmission } from './submission'
import type { RunSubmission } from './submission'
import { ENGINE_VERSION } from './version'

const WEEK = '2026-W39'
const now = weekBounds(WEEK)!.start + 3 * 86_400_000
const ctx = { engineVersion: ENGINE_VERSION, now }
const opts: NewGameOptions = { seed: weekSeed(WEEK), firmName: 'Mitt Eget Navn AS', founderDisciplines: ['frontend', 'pm'], difficulty: 'normal', weekly: WEEK }

let game: GameState
let log: RunLog
let sub: RunSubmission

describe('leaderboard submission', () => {
  beforeAll(() => {
    const run = botRun(opts)
    game = { ...run.state, gameId: 'test-game-0001' }
    log = run.log
    sub = buildSubmission(game, log, ['moose', 'spreadsheet', 'as'], ENGINE_VERSION)!
  })

  it('the build has a real engine version', () => {
    expect(ENGINE_VERSION).toMatch(/^[0-9a-f]{12}$/)
  })

  it('a finished weekly game replays to the result the player saw', () => {
    expect(sub).not.toBeNull()
    expect(sub.founders).toEqual(['frontend', 'pm'])
    // Nothing the player typed goes along.
    expect(JSON.stringify(sub)).not.toContain('Mitt Eget Navn')
    const r = verifySubmission(JSON.parse(JSON.stringify(sub)), ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.run.valuation).toBe(Math.round(valuation(game.firms.player)))
    expect(r.run.valuation).toBe(sub.claimedValuation)
    expect(r.run.status).toBe(game.status)
  })

  it('only finished weekly games with a log can be submitted', () => {
    expect(buildSubmission({ ...game, weekly: undefined }, log, ['moose', 'owl', 'as'], ENGINE_VERSION)).toBeNull()
    expect(buildSubmission({ ...game, status: 'playing' }, log, ['moose', 'owl', 'as'], ENGINE_VERSION)).toBeNull()
    expect(buildSubmission(game, null, ['moose', 'owl', 'as'], ENGINE_VERSION)).toBeNull()
  })

  it('ignores the claimed value: the server works it out', () => {
    const r = verifySubmission({ ...sub, claimedValuation: 1e15 }, ctx)
    expect(r.ok && r.run.valuation).toBe(sub.claimedValuation)
  })

  it('rejects another engine version', () => {
    expect(verifySubmission({ ...sub, engineVersion: 'old' }, ctx)).toEqual({ ok: false, error: 'outdated' })
  })

  it('rejects a week that has closed', () => {
    expect(verifySubmission(sub, { ...ctx, now: now + 30 * 86_400_000 })).toEqual({ ok: false, error: 'weekClosed' })
  })

  it('rejects anything that is not shaped like a submission', () => {
    for (const bad of [null, 'x', {}, { ...sub, name: ['moose', 'moose', 'as'] }, { ...sub, name: ['Kari', 'owl', 'as'] }, { ...sub, founders: ['frontend'] }, { ...sub, log: [1] }, { ...sub, gameId: 'x' }]) {
      expect(verifySubmission(bad, ctx)).toEqual({ ok: false, error: 'invalid' })
    }
  })

  it('rejects a tampered log', () => {
    // Legal moves just make a different game; these can't have come from the store.
    const rival = game.firmOrder.find((id) => id !== game.playerId)!
    for (const step of [{ type: 'hireStar', firmId: 'player', starId: 'nobody' }, { type: 'fire', firmId: rival, discipline: 'backend', count: 5 }, { type: 'noSuchAction', firmId: 'player' }]) {
      const tampered = [...log.slice(0, 5), step, ...log.slice(5)] as RunLog
      expect(verifySubmission({ ...sub, log: tampered }, ctx)).toMatchObject({ ok: false, error: 'replayFailed' })
    }
  })

  it('rejects a game that has not ended', () => {
    const cut = log.slice(0, log.indexOf('end') + 1)
    expect(verifySubmission({ ...sub, log: cut }, ctx)).toEqual({ ok: false, error: 'unfinished' })
  })

  it('rejects an absurdly long log before replaying it', () => {
    expect(verifySubmission({ ...sub, log: Array.from({ length: 10_000 }, () => 'end') }, ctx)).toEqual({ ok: false, error: 'tooLong' })
  })

  it('averages every minigame score that can count, clamped, and crisis scores only after a talk', () => {
    const r = verifySubmission(sub, ctx)
    const talks = new Set<string>()
    const scores: number[] = []
    for (const e of log) {
      if (e === 'end') continue
      if (e.type === 'recordMinigame') scores.push(Math.max(0, Math.min(100, e.score)))
      if (e.type === 'startCrisisTalk') talks.add(`${e.crisisId}:${e.choiceId}`)
      if (e.type === 'resolveCrisis' && typeof e.score === 'number' && talks.has(`${e.crisisId}:${e.choiceId}`)) scores.push(e.score)
    }
    expect(r.ok && r.run.minigameAvg).toBe(scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null)
  })

  it('rejects an oversized submission before replaying it', () => {
    const padded = log.map((e, i) => (e !== 'end' && i < 400 ? { ...e, pad: 'x'.repeat(99) } : e)) as RunLog
    // Each step alone is fine; together they are far beyond any real game.
    expect(verifySubmission({ ...sub, log: [...padded, ...padded, ...padded] }, ctx)).toMatchObject({ ok: false })
    const huge = { ...sub, log: log.map((e) => (e === 'end' ? e : { ...e, pad: Array.from({ length: 30 }, () => 'y'.repeat(99)) })) }
    expect(verifySubmission(huge, ctx)).toEqual({ ok: false, error: 'tooLong' })
  })

  it('rejects steps with oversized, deeply nested or prototype-named values', () => {
    const at = log.findIndex((e) => e !== 'end')
    const withStep = (extra: Record<string, unknown>) => ({ ...sub, log: log.map((e, i) => (i === at && e !== 'end' ? { ...e, ...extra } : e)) })
    for (const extra of [
      { targetFirmId: '__proto__' },
      { targetFirmId: 'constructor' },
      { contractId: 'toString' },
      { contractId: 'x'.repeat(101) },
      { contractId: { a: { b: { c: { d: 1 } } } } },
      { contractId: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`k${i}`, i])) },
      JSON.parse('{"__proto__": {"polluted": 1}}') as Record<string, unknown>,
    ]) {
      expect(verifySubmission(JSON.parse(JSON.stringify(withStep(extra))), ctx)).toMatchObject({ ok: false, error: 'invalid' })
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('hands back the replayed end state, the same for the same game', () => {
    const a = verifySubmission(JSON.parse(JSON.stringify(sub)), ctx)
    const b = verifySubmission(JSON.parse(JSON.stringify({ ...sub, gameId: 'another-game-02' })), ctx)
    expect(a.ok && b.ok && JSON.stringify(a.state) === JSON.stringify(b.state)).toBe(true)
  })
})
