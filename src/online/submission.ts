import { isLeaderboardName } from '../content/leaderboardNames'
import type { LeaderboardName } from '../content/leaderboardNames'
import {
  DISCIPLINES,
  RUN_LOG_MAX,
  WEEKLY_DIFFICULTY,
  endTitle,
  playerRank,
  replayRun,
  shadyStats,
  valuation,
  weekOpen,
  weekSeed,
} from '../engine'
import type { Discipline, EndTitle, GameState, NewGameOptions, RunLog } from '../engine'

/**
 * What the game sends to the leaderboard: how the weekly game was set up and every step the player took.
 * Never a score. The server replays the log and works the result out itself (verifySubmission).
 * Shared by the app and the Cloud Function; no Firebase in here.
 */
export interface RunSubmission {
  engineVersion: string
  /** ISO week of the weekly challenge; the seed follows from it. */
  week: string
  /** The store's id for the playthrough, so sending the same game twice counts once. */
  gameId: string
  founders: [Discipline, Discipline]
  log: RunLog
  name: LeaderboardName
  /** What the player's own game ended at. Only compared, never trusted. */
  claimedValuation: number
}

export interface VerifiedRun {
  valuation: number
  title: EndTitle
  /** Place among the 25 firms in that game. */
  rank: number
  status: 'finished' | 'lost'
  quarter: number
  /** Average of the minigame scores the client reported (0–100), or null without any. Trusted input; kept to spot outliers. */
  minigameAvg: number | null
  shady: number
}

/** What the server answers for an accepted game. */
export interface SubmitResult extends VerifiedRun {
  week: string
  /** Whether this became the player's best game of the week (the one on the list). */
  best: boolean
  /** The player's place on the week's list, with their best game. */
  place: number
  players: number
  /** Share of the other players this game beat, 0–100. */
  percentile: number
}

export type SubmitError =
  | 'outdated'
  | 'weekClosed'
  | 'invalid'
  | 'tooLong'
  | 'replayFailed'
  | 'unfinished'
  | 'duplicate'

export type VerifyResult =
  | {
      ok: true
      submission: RunSubmission
      run: VerifiedRun
      /** The replayed game's end state, so the server can tell two copies of the same game apart from two games. */
      state: GameState
    }
  | { ok: false; error: SubmitError; detail?: string }

/** The firm name never affects play (replay.test.ts), so the server uses a placeholder instead of what the player typed. */
const PLACEHOLDER_NAME = 'Spiller AS'

export function submissionOptions(s: Pick<RunSubmission, 'week' | 'founders'>): NewGameOptions {
  return {
    seed: weekSeed(s.week),
    firmName: PLACEHOLDER_NAME,
    founderDisciplines: s.founders,
    difficulty: WEEKLY_DIFFICULTY,
    weekly: s.week,
  }
}

/** Builds the submission for a finished weekly game, or null if it can't go on the leaderboard. */
export function buildSubmission(
  game: GameState,
  log: RunLog | null,
  name: LeaderboardName,
  engineVersion: string,
): RunSubmission | null {
  if (!game.weekly || !log || !game.gameId || game.status === 'playing' || game.difficulty !== WEEKLY_DIFFICULTY)
    return null
  return {
    engineVersion,
    week: game.weekly.week,
    gameId: game.gameId,
    founders: game.weekly.founders,
    log,
    name,
    claimedValuation: Math.round(valuation(game.firms[game.playerId])),
  }
}

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const WEEK_RE = /^\d{4}-W\d{2}$/
const GAME_ID_RE = /^[A-Za-z0-9-]{8,64}$/

/**
 * Size limits for what a client sends, checked before anything is replayed. A real game's log is around
 * 100 kB with steps under 200 characters, ids under 20 and objects three levels deep, so these leave plenty of
 * room. Without them, a few steps carrying huge payloads that the engine copies into the state make every
 * replayed quarter slower and can run the function out of memory.
 */
const SUBMISSION_MAX_CHARS = 900_000
const STEP_MAX_CHARS = 2_000
const STEP_MAX_DEPTH = 4
export const STRING_MAX_CHARS = 100

/**
 * Whether a step is plain, small data: no oversized strings, no deep nesting, and no string or key that names
 * something on Object.prototype. The engine looks ids up in plain objects, so `"__proto__"` or `"constructor"`
 * as an id reaches the prototype, and no real id is ever one of those names.
 */
function plainStep(x: unknown, depth = 0): boolean {
  // `undefined` never arrives over JSON, but optional fields built in code (the tests, the store) have it.
  if (x === null || x === undefined || typeof x === 'boolean') return true
  if (typeof x === 'number') return Number.isFinite(x)
  if (typeof x === 'string') return x.length <= STRING_MAX_CHARS && !(x in Object.prototype)
  if (typeof x !== 'object' || depth >= STEP_MAX_DEPTH) return false
  if (Array.isArray(x)) return x.every((v) => plainStep(v, depth + 1))
  return Object.keys(x).every(
    (k) => !(k in Object.prototype) && plainStep((x as Record<string, unknown>)[k], depth + 1),
  )
}

export function stepOk(e: unknown): boolean {
  if (e === 'end') return true
  if (!e || typeof e !== 'object' || Array.isArray(e) || typeof (e as { type?: unknown }).type !== 'string')
    return false
  return plainStep(e) && JSON.stringify(e).length <= STEP_MAX_CHARS
}

/** Checks a submission's shape before anything is replayed. Everything here comes from the client. */
function parse(x: unknown): RunSubmission | null {
  if (!x || typeof x !== 'object') return null
  const s = x as Record<string, unknown>
  if (typeof s.engineVersion !== 'string' || s.engineVersion.length > 64) return null
  if (typeof s.week !== 'string' || !WEEK_RE.test(s.week)) return null
  if (typeof s.gameId !== 'string' || !GAME_ID_RE.test(s.gameId)) return null
  if (
    !Array.isArray(s.founders) ||
    s.founders.length !== 2 ||
    !s.founders.every((d) => (DISCIPLINES as readonly unknown[]).includes(d))
  )
    return null
  if (!Array.isArray(s.log)) return null
  if (!s.log.every(stepOk)) return null
  if (!isLeaderboardName(s.name)) return null
  if (!isFiniteNumber(s.claimedValuation)) return null
  return s as unknown as RunSubmission
}

/**
 * The average minigame score the client reported, meant to spot outliers. Counts every score that can affect
 * the game, provisional ones included (they count towards a bid until replaced), and a crisis score only after
 * its talk was started, since the engine ignores it otherwise. Clamped the way the engine clamps them.
 */
function minigameAverage(log: RunLog): number | null {
  const scores: number[] = []
  const talks = new Set<string>()
  const score = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) ? scores.push(Math.max(0, Math.min(100, n))) : 0
  for (const e of log) {
    if (e === 'end') continue
    if (e.type === 'recordMinigame') score(e.score)
    if (e.type === 'startCrisisTalk') talks.add(`${e.crisisId}:${e.choiceId}`)
    if (e.type === 'resolveCrisis' && talks.has(`${e.crisisId}:${e.choiceId}`)) score(e.score)
  }
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

/**
 * Replays a submission and works out its result. Rejects anything that isn't a finished weekly game from
 * this engine version, and any log where a step fails: the store only logs steps that succeeded, so a failing
 * one means a bug or tampering.
 */
export function verifySubmission(input: unknown, ctx: { engineVersion: string; now: number }): VerifyResult {
  let size: number
  try {
    size = JSON.stringify(input)?.length ?? 0
  } catch {
    return { ok: false, error: 'invalid' }
  }
  if (size > SUBMISSION_MAX_CHARS) return { ok: false, error: 'tooLong' }
  const submission = parse(input)
  if (!submission) return { ok: false, error: 'invalid' }
  if (submission.engineVersion !== ctx.engineVersion) return { ok: false, error: 'outdated' }
  if (!weekOpen(submission.week, ctx.now)) return { ok: false, error: 'weekClosed' }
  if (submission.log.length > RUN_LOG_MAX) return { ok: false, error: 'tooLong' }

  let replay: ReturnType<typeof replayRun>
  try {
    replay = replayRun(submissionOptions(submission), submission.log)
  } catch (e) {
    return { ok: false, error: 'replayFailed', detail: e instanceof Error ? e.message : 'crash' }
  }
  if (replay.error) return { ok: false, error: 'replayFailed', detail: `${replay.error.index}:${replay.error.key}` }
  const state = replay.state
  if (state.status === 'playing') return { ok: false, error: 'unfinished' }

  const me = state.firms[state.playerId]
  const value = Math.round(valuation(me))
  // A step with a missing number can leave NaN in the state. It can't be ranked, and Firestore and the
  // callable's answer would both choke on it.
  if (!Number.isFinite(value)) return { ok: false, error: 'replayFailed', detail: 'notFinite' }
  return {
    ok: true,
    submission,
    state,
    run: {
      valuation: value,
      title: endTitle(state),
      rank: playerRank(state),
      status: state.status,
      quarter: state.quarter,
      minigameAvg: minigameAverage(submission.log),
      shady: shadyStats(me).total,
    },
  }
}
