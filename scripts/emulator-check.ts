/**
 * End-to-end check of the leaderboard backend in the Firebase Emulator Suite (no Blaze plan needed):
 * `npm run functions:check`. Plays a weekly game with the bot, submits it, reads it back as the player,
 * checks rules, rate limit, idempotency and tamper rejection, then deletes the account.
 */
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore/lite'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { isoWeek, weekSeed } from '../src/engine'
import { botRun } from '../src/engine/testUtils'
import { buildSubmission } from '../src/online/submission'
import { engineVersion } from './engineVersion'

const app = initializeApp({ apiKey: 'fake', projectId: 'konsulent-tycoon', appId: 'x' })
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true })
const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8181)
const fns = getFunctions(app, 'europe-west1')
connectFunctionsEmulator(fns, '127.0.0.1', 5101)

const week = isoWeek(Date.now())
const { state, log } = botRun({ seed: weekSeed(week), firmName: 'Emu AS', founderDisciplines: ['backend', 'data'], difficulty: 'normal', weekly: week })
const sub = buildSubmission({ ...state, gameId: 'emulator-game-1' }, log, ['moose', 'owl', 'as'], engineVersion())!
const check = (ok: boolean, what: string) => { console.log(ok ? 'OK  ' : 'FAIL', what); if (!ok) process.exitCode = 1 }

const submit = httpsCallable(fns, 'submitRun')
const del = httpsCallable(fns, 'deleteAccount')

// Not signed in: refused.
try { await submit(sub); check(false, 'unauthenticated refused') } catch (e) { check((e as { code: string }).code === 'functions/unauthenticated', 'unauthenticated refused') }

const { user } = await signInAnonymously(auth)
const r = (await submit(sub)).data as Record<string, unknown>
console.log('     result', r)
check(r.valuation === sub.claimedValuation && r.place === 1 && r.best === true, 'submitted and ranked')

const entries = await getDocs(collection(db, 'weeks', week, 'entries'))
check(entries.size === 1 && entries.docs[0].id === user.uid, 'week entry readable by anyone')
const history = await getDocs(collection(db, 'users', user.uid, 'history'))
check(history.size === 1 && !('log' in history.docs[0].data()), 'own history readable, without log')
try { await getDoc(doc(db, 'runs', `${user.uid}_emulator-game-1`)); check(false, 'runs not readable') } catch { check(true, 'runs not readable') }

// Too fast, then the same game again after the cooldown: counted once.
try { await submit(sub); check(false, 'rate limited') } catch (e) { check((e as { code: string }).code === 'functions/resource-exhausted', 'rate limited') }
await new Promise((res) => setTimeout(res, 10_500))
await submit(sub)
check((await getDocs(collection(db, 'users', user.uid, 'history'))).size === 1, 'resubmitting the same game counts once')

// Tampered: rejected with a reason.
await new Promise((res) => setTimeout(res, 10_500))
try {
  await submit({ ...sub, gameId: 'emulator-game-2', log: [{ type: 'hireStar', firmId: 'player', starId: 'nope' }, ...sub.log] })
  check(false, 'tampered log rejected')
} catch (e) {
  const err = e as { code: string; details?: { reason?: string } }
  check(err.code === 'functions/failed-precondition' && err.details?.reason === 'replayFailed', 'tampered log rejected')
}

await del()
const after = await getDocs(collection(db, 'weeks', week, 'entries'))
check(after.size === 0, 'delete removes the week entry')
check((await getDocs(collection(db, 'users', user.uid, 'history'))).size === 0, 'delete removes history')
process.exit()
