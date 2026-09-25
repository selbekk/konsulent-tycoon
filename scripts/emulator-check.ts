/**
 * End-to-end check of the leaderboard backend in the Firebase Emulator Suite (no Blaze plan needed):
 * `npm run functions:check`. Plays a weekly game with the bot, submits it, reads it back as the player,
 * checks rules, rate limit (also in parallel), idempotency, duplicates from another account and tamper rejection,
 * then deletes the accounts.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, query } from 'firebase/firestore/lite'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { isoWeek, weekSeed } from '../src/engine'
import { botRun } from '../src/engine/testUtils'
import { buildSubmission } from '../src/online/submission'
import { engineVersion } from './engineVersion'

/** One player: an app instance of its own, so two anonymous accounts can be signed in at once. */
function client(name?: string) {
  const app = initializeApp({ apiKey: 'fake', projectId: 'konsulent-tycoon', appId: 'x' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8181)
  const fns = getFunctions(app, 'europe-west1')
  connectFunctionsEmulator(fns, '127.0.0.1', 5101)
  return { auth, db, submit: httpsCallable(fns, 'submitRun'), del: httpsCallable(fns, 'deleteAccount') }
}
const { auth, db, submit, del } = client()
const page = (...path: [string, ...string[]]) => getDocs(query(collection(db, ...path), limit(50)))
const reason = (e: unknown) => (e as { details?: { reason?: string } }).details?.reason

const week = isoWeek(Date.now())
const { state, log } = botRun({ seed: weekSeed(week), firmName: 'Emu AS', founderDisciplines: ['backend', 'data'], difficulty: 'normal', weekly: week })
const sub = buildSubmission({ ...state, gameId: 'emulator-game-1' }, log, ['moose', 'owl', 'as'], engineVersion())!
const check = (ok: boolean, what: string) => { console.log(ok ? 'OK  ' : 'FAIL', what); if (!ok) process.exitCode = 1 }


// Not signed in: refused.
try { await submit(sub); check(false, 'unauthenticated refused') } catch (e) { check((e as { code: string }).code === 'functions/unauthenticated', 'unauthenticated refused') }

const { user } = await signInAnonymously(auth)
const r = (await submit(sub)).data as Record<string, unknown>
console.log('     result', r)
check(r.valuation === sub.claimedValuation && r.place === 1 && r.best === true, 'submitted and ranked')

const entries = await page('weeks', week, 'entries')
check(entries.size === 1 && entries.docs[0].id === user.uid, 'week entry readable by anyone')
try { await getDocs(collection(db, 'weeks', week, 'entries')); check(false, 'list without a limit refused') } catch { check(true, 'list without a limit refused') }
const history = await page('users', user.uid, 'history')
check(history.size === 1 && !('log' in history.docs[0].data()), 'own history readable, without log')
try { await getDoc(doc(db, 'runs', `${user.uid}_emulator-game-1`)); check(false, 'runs not readable') } catch { check(true, 'runs not readable') }
try { await getDocs(query(collection(db, 'weeks', week, 'games'), limit(5))); check(false, 'game fingerprints not readable') } catch { check(true, 'game fingerprints not readable') }

// Too fast, also when sent all at once; then the same game again after the cooldown: counted once.
try { await submit(sub); check(false, 'rate limited') } catch (e) { check((e as { code: string }).code === 'functions/resource-exhausted', 'rate limited') }
await new Promise((res) => setTimeout(res, 10_500))
const burst = await Promise.allSettled(Array.from({ length: 5 }, () => submit(sub)))
check(burst.filter((b) => b.status === 'fulfilled').length === 1, 'parallel submissions: only one gets through')
check((await page('users', user.uid, 'history')).size === 1, 'resubmitting the same game counts once')

// The same game from another account: refused, so one log can't fill the list.
const other = client('other')
await signInAnonymously(other.auth)
try {
  await other.submit({ ...sub, gameId: 'emulator-game-copy' })
  check(false, 'copy from another account refused')
} catch (e) {
  check(reason(e) === 'duplicate', 'copy from another account refused')
}
await other.del()

// Tampered: rejected with a reason.
await new Promise((res) => setTimeout(res, 10_500))
try {
  await submit({ ...sub, gameId: 'emulator-game-2', log: [{ type: 'hireStar', firmId: 'player', starId: 'nope' }, ...sub.log] })
  check(false, 'tampered log rejected')
} catch (e) {
  const err = e as { code: string; details?: { reason?: string } }
  check(err.code === 'functions/failed-precondition' && err.details?.reason === 'replayFailed', 'tampered log rejected')
}

// A step with a prototype name as an id is refused before it is replayed.
await new Promise((res) => setTimeout(res, 10_500))
try {
  await submit({ ...sub, gameId: 'emulator-game-3', log: [{ type: 'shady', firmId: 'player', actionId: 'rumor', targetFirmId: '__proto__' }, ...sub.log] })
  check(false, 'prototype id refused')
} catch (e) {
  check(reason(e) === 'invalid', 'prototype id refused')
}

await del()
const after = await page('weeks', week, 'entries')
check(after.size === 0, 'delete removes the week entry')
check((await page('users', user.uid, 'history')).size === 0, 'delete removes history')
process.exit()
