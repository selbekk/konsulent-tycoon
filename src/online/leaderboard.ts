import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore/lite'
import type { Functions } from 'firebase/functions'
import type { LeaderboardName } from '../content/leaderboardNames'
import { isLeaderboardName } from '../content/leaderboardNames'
import type { EndTitle } from '../engine'
import type { RunSubmission, SubmitError, SubmitResult } from './submission'

/**
 * The leaderboard client (Firebase), strictly opt-in.
 *
 * Nothing is loaded or sent until the player chooses to join. The SDK is a lazy chunk, like PostHog, so
 * players who never join never download it. Joining signs in anonymously; the account is just a random id.
 * Only the UI calls this, never the engine or the store.
 */

/** Public by design: a web app's Firebase config identifies the project, it grants nothing. Access is in firestore.rules. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAsngORxv5v8o7KFnI7u3ctvEJsEXx8sWI',
  authDomain: 'konsulent-tycoon.firebaseapp.com',
  projectId: 'konsulent-tycoon',
  storageBucket: 'konsulent-tycoon.firebasestorage.app',
  messagingSenderId: '223842877364',
  appId: '1:223842877364:web:2497ff42eb113da6e97ce1',
}
const REGION = 'europe-west1'

const OPT_IN_KEY = 'kt.online'
const NAME_KEY = 'kt.online.name'
const RESULTS_KEY = 'kt.online.results'

interface Services {
  auth: Auth
  db: Firestore
  functions: Functions
}

let services: Promise<Services> | null = null

function load(): Promise<Services> {
  services ??= Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
    import('firebase/functions'),
  ])
    .then(([{ initializeApp }, { getAuth }, { getFirestore }, { getFunctions }]) => {
      const app = initializeApp(FIREBASE_CONFIG)
      return { auth: getAuth(app), db: getFirestore(app), functions: getFunctions(app, REGION) }
    })
    .catch((e: unknown) => {
      // Offline on first use, or blocked: try again next time.
      services = null
      throw e
    })
  return services
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/** Whether the player has joined the leaderboard on this device. Cheap: doesn't load Firebase. */
export function isOptedIn(): boolean {
  return read<boolean>(OPT_IN_KEY) === true
}

/** The name the player last picked for the list. */
export function savedName(): LeaderboardName | null {
  const n = read<unknown>(NAME_KEY)
  return isLeaderboardName(n) ? n : null
}

/** Results of games already sent from this device, by game id, so the end screen remembers them. */
export function savedResult(gameId: string): SubmitResult | null {
  return read<Record<string, SubmitResult>>(RESULTS_KEY)?.[gameId] ?? null
}

/** Joins the leaderboard: signs in anonymously (once) and remembers the chosen name. */
export async function optIn(name: LeaderboardName): Promise<void> {
  const { auth } = await load()
  await auth.authStateReady()
  if (!auth.currentUser) {
    const { signInAnonymously } = await import('firebase/auth')
    await signInAnonymously(auth)
  }
  write(OPT_IN_KEY, true)
  write(NAME_KEY, name)
}

export type SubmitFailure = SubmitError | 'offline' | 'tooFast' | 'unknown'

export class SubmitFailed extends Error {
  readonly reason: SubmitFailure
  constructor(reason: SubmitFailure) {
    super(reason)
    this.reason = reason
  }
}

const SUBMIT_ERRORS: ReadonlySet<string> = new Set([
  'outdated',
  'weekClosed',
  'invalid',
  'tooLong',
  'replayFailed',
  'unfinished',
  'duplicate',
])

/** Sends a finished weekly game. Throws SubmitFailed with a reason the UI can explain. */
export async function submitRun(submission: RunSubmission): Promise<SubmitResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SubmitFailed('offline')
  try {
    const { functions, auth } = await load()
    await auth.authStateReady()
    if (!auth.currentUser) throw new SubmitFailed('unknown')
    const { httpsCallable } = await import('firebase/functions')
    const call = httpsCallable<RunSubmission, SubmitResult>(functions, 'submitRun', { timeout: 60_000 })
    const { data } = await call(submission)
    const results = read<Record<string, SubmitResult>>(RESULTS_KEY) ?? {}
    write(RESULTS_KEY, { ...results, [submission.gameId]: data })
    return data
  } catch (e) {
    if (e instanceof SubmitFailed) throw e
    const err = e as { code?: string; message?: string; details?: { reason?: string } }
    const reason = err.details?.reason ?? err.message ?? ''
    if (SUBMIT_ERRORS.has(reason)) throw new SubmitFailed(reason as SubmitError)
    if (err.code === 'functions/resource-exhausted') throw new SubmitFailed('tooFast')
    if (
      err.code === 'functions/unavailable' ||
      err.code === 'functions/deadline-exceeded' ||
      err.code === 'auth/network-request-failed'
    )
      throw new SubmitFailed('offline')
    throw new SubmitFailed('unknown')
  }
}

export interface BoardEntry {
  /** Player id (the entry's document id); compared with `myUid()` to mark the player's own row. */
  uid: string
  week: string
  name: LeaderboardName
  valuation: number
  title: EndTitle
  rank: number
}

export interface HistoryEntry {
  id: string
  week: string
  valuation: number
  title: EndTitle
  rank: number
  status: 'finished' | 'lost'
}

/** The signed-in player's id, or null if they haven't joined. Loads Firebase only for players who have. */
export async function myUid(): Promise<string | null> {
  if (!isOptedIn()) return null
  const { auth } = await load()
  await auth.authStateReady()
  return auth.currentUser?.uid ?? null
}

/** The best games of a week. */
export async function weekBoard(week: string, count = 50): Promise<BoardEntry[]> {
  const { db } = await load()
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite')
  const snap = await getDocs(
    query(collection(db, 'weeks', week, 'entries'), orderBy('valuation', 'desc'), limit(count)),
  )
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BoardEntry, 'uid'>), uid: d.id }))
}

/** The best weekly games of all time. */
export async function hallOfFame(count = 25): Promise<BoardEntry[]> {
  const { db } = await load()
  const { collectionGroup, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite')
  const snap = await getDocs(query(collectionGroup(db, 'entries'), orderBy('valuation', 'desc'), limit(count)))
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BoardEntry, 'uid'>), uid: d.id }))
}

/** The player's own submitted games, newest first. */
export async function myHistory(count = 20): Promise<HistoryEntry[]> {
  const uid = await myUid()
  if (!uid) return []
  const { db } = await load()
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite')
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'history'), orderBy('submittedAt', 'desc'), limit(count)),
  )
  return snap.docs.map((d) => ({ ...(d.data() as Omit<HistoryEntry, 'id'>), id: d.id }))
}

/** Deletes the account and everything on the server, then forgets it on this device. */
export async function deleteAccount(): Promise<void> {
  const { functions, auth } = await load()
  await auth.authStateReady()
  if (auth.currentUser) {
    const { httpsCallable } = await import('firebase/functions')
    await httpsCallable(functions, 'deleteAccount')()
    const { signOut } = await import('firebase/auth')
    await signOut(auth).catch(() => undefined)
  }
  write(OPT_IN_KEY, null)
  write(NAME_KEY, null)
  write(RESULTS_KEY, null)
}
