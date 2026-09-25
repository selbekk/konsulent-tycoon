import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createNewGame } from './newGame'
import type { NewGameOptions } from './newGame'
import { replayRun } from './replay'
import { botRun } from './testUtils'
import { weekSeed } from './weekly'

const opts: NewGameOptions = {
  seed: 7,
  firmName: 'Replay AS',
  founderDisciplines: ['backend', 'data'],
  difficulty: 'normal',
}
/** The whole state as JSON, without the store's `gameId` (the engine never sees it). */
const json = (s: object) => JSON.stringify(s, (k, v) => (k === 'gameId' ? undefined : v))

describe('replay', () => {
  let full: ReturnType<typeof botRun>
  beforeAll(() => {
    full = botRun(opts)
  })

  it('a full logged game replays to the identical state', () => {
    const { state, log } = full
    expect(state.status).not.toBe('playing')
    const replay = replayRun(opts, log)
    expect(replay.error).toBeUndefined()
    expect(json(replay.state)).toBe(json(state))
  })

  it('the firm name is only shown, never played, so the server can replay with a placeholder', () => {
    const { state, log } = botRun(opts, 6)
    const replay = replayRun({ ...opts, firmName: 'Spiller AS' }, log)
    expect(replay.error).toBeUndefined()
    // The name turns up in the firm and in news params, and nowhere else.
    expect(JSON.stringify(replay.state).replaceAll('Spiller AS', 'Replay AS')).toBe(JSON.stringify(state))
  })

  it('stops at the first step that fails', () => {
    const { log } = botRun(opts, 2)
    const bad = [...log.slice(0, 3), { type: 'lobby' as const, firmId: 'nobody' }, ...log.slice(3)]
    const replay = replayRun(opts, bad)
    expect(replay.error).toEqual({ index: 3, key: expect.any(String) })
  })

  it('refuses actions for any firm but the player', () => {
    const { state, log } = botRun(opts, 2)
    const rival = state.firmOrder.find((id) => id !== state.playerId)!
    const bad = [...log, { type: 'fire' as const, firmId: rival, discipline: 'backend' as const, count: 5 }]
    expect(replayRun(opts, bad).error).toEqual({ index: log.length, key: 'errors.invalid' })
  })

  it('refuses to end a quarter after the game is over', () => {
    const { log } = full
    expect(replayRun(opts, [...log, 'end']).error?.key).toBe('errors.gameOver')
  })

  it('a weekly game carries its week and seed', () => {
    const s = createNewGame({ ...opts, seed: weekSeed('2026-W39'), weekly: '2026-W39' })
    expect(s.weekly).toEqual({ week: '2026-W39', founders: ['backend', 'data'] })
    expect(s.seed).toBe(weekSeed('2026-W39'))
    expect(createNewGame(opts).weekly).toBeUndefined()
  })
})

describe('determinism guard', () => {
  // The leaderboard replays games on a server. Anything that depends on the clock, locale or a
  // non-seeded random source would make a browser and the server play differently.
  const FORBIDDEN = [
    /\.localeCompare\(/,
    /\bIntl\./,
    /\.toLocale\w*\(/,
    /Math\.random\(/,
    /Date\.now\(/,
    /performance\.now\(/,
  ]
  // Pure date maths on a timestamp the caller passes, and the save timestamp; neither feeds the game.
  const ALLOWED_DATE = new Set(['weekly.ts', 'save.ts'])

  function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? sources(join(dir, e.name))
        : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && e.name !== 'testUtils.ts'
          ? [join(dir, e.name)]
          : [],
    )
  }

  it('the engine and content use no clock, locale or unseeded randomness', () => {
    const offenders: string[] = []
    for (const file of [...sources('src/engine'), ...sources('src/content')]) {
      const code = readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '')
      for (const re of FORBIDDEN) if (re.test(code)) offenders.push(`${file}: ${re}`)
      if (/new Date\(/.test(code) && !ALLOWED_DATE.has(file.split('/').pop()!)) offenders.push(`${file}: new Date(`)
    }
    expect(offenders).toEqual([])
  })
})
