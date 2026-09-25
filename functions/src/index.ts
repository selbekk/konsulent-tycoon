import { createHash } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { verifySubmission } from '../../src/online/submission'
import type { SubmitResult } from '../../src/online/submission'
import { ENGINE_VERSION } from '../../src/online/version'

/**
 * The leaderboard backend (docs/plans/2026-09-25-toppliste.md). Clients never write to Firestore: they
 * send a weekly game's action log here, the engine replays it, and only the result it works out is stored.
 *
 * - `runs/{uid}_{gameId}`: the whole submission, log included. Not readable by clients.
 * - `users/{uid}/history/{runId}`: the player's own results, readable by them.
 * - `weeks/{week}/entries/{uid}`: the best result per player and week, readable by everyone.
 * - `weeks/{week}/games/{fingerprint}`: which player first sent in a game ending in exactly this state. Server only.
 */

initializeApp()
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })
const db = getFirestore()

/** Seconds between two submissions from the same player; replays cost about half a second each. */
const SUBMIT_COOLDOWN_MS = 10_000

export const submitRun = onCall({ memory: '512MiB', timeoutSeconds: 60 }, async (req): Promise<SubmitResult> => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'signIn')

  // Read and write the cooldown in one transaction, so calls sent in parallel can't all read the old time.
  const user = db.doc(`users/${uid}`)
  const allowed = await db.runTransaction(async (tx) => {
    const last = (await tx.get(user)).get('lastSubmitAt') as FirebaseFirestore.Timestamp | undefined
    if (last && Date.now() - last.toMillis() < SUBMIT_COOLDOWN_MS) return false
    tx.set(user, { lastSubmitAt: FieldValue.serverTimestamp() }, { merge: true })
    return true
  })
  if (!allowed) throw new HttpsError('resource-exhausted', 'tooFast')

  const verified = verifySubmission(req.data, { engineVersion: ENGINE_VERSION, now: Date.now() })
  if (!verified.ok) {
    console.warn('submitRun rejected', { uid, error: verified.error, detail: verified.detail })
    throw new HttpsError('failed-precondition', verified.error, { reason: verified.error })
  }
  const { submission, run } = verified
  // Same end state, same game: one log sent in from many accounts would otherwise fill the whole list. Hashing
  // the end state rather than the log means padding the log with extra fields or no-op steps doesn't count as new.
  const fingerprint = createHash('sha256').update(JSON.stringify(verified.state)).digest('hex')
  const game = db.doc(`weeks/${submission.week}/games/${fingerprint}`)
  if (run.valuation !== submission.claimedValuation) {
    // Not the player's fault and not a reason to reject: a sign the engine isn't deterministic somewhere.
    console.error('submitRun valuation mismatch', { uid, gameId: submission.gameId, claimed: submission.claimedValuation, replayed: run.valuation })
  }

  const runId = `${uid}_${submission.gameId}`
  const week = db.doc(`weeks/${submission.week}`)
  const entry = week.collection('entries').doc(uid)
  const best = await db.runTransaction(async (tx) => {
    const [runSnap, entrySnap, gameSnap] = await Promise.all([tx.get(db.doc(`runs/${runId}`)), tx.get(entry), tx.get(game)])
    const prev = entrySnap.exists ? (entrySnap.get('valuation') as number) : -1
    // The same game sent twice (a retry after a lost answer) counts once.
    if (runSnap.exists) return prev <= run.valuation
    if (gameSnap.exists && gameSnap.get('uid') !== uid) return 'duplicate' as const
    const now = FieldValue.serverTimestamp()
    tx.set(db.doc(`runs/${runId}`), {
      uid,
      week: submission.week,
      gameId: submission.gameId,
      engineVersion: submission.engineVersion,
      founders: submission.founders,
      name: submission.name,
      log: JSON.stringify(submission.log),
      claimedValuation: submission.claimedValuation,
      fingerprint,
      ...run,
      submittedAt: now,
    })
    tx.set(db.doc(`users/${uid}/history/${runId}`), { week: submission.week, name: submission.name, founders: submission.founders, ...run, submittedAt: now })
    tx.set(week, { week: submission.week, engineVersion: submission.engineVersion }, { merge: true })
    if (!gameSnap.exists) tx.set(game, { uid, runId, submittedAt: now })
    const isBest = run.valuation > prev
    if (isBest) tx.set(entry, { week: submission.week, name: submission.name, founders: submission.founders, valuation: run.valuation, title: run.title, rank: run.rank, runId, submittedAt: now })
    return isBest
  })
  if (best === 'duplicate') {
    console.warn('submitRun duplicate', { uid, week: submission.week, fingerprint })
    throw new HttpsError('failed-precondition', 'duplicate', { reason: 'duplicate' })
  }

  const entries = week.collection('entries')
  const myBest = best ? run.valuation : ((await entry.get()).get('valuation') as number)
  const [above, below, total] = await Promise.all([
    entries.where('valuation', '>', myBest).count().get(),
    entries.where('valuation', '<', run.valuation).count().get(),
    entries.count().get(),
  ])
  const others = total.data().count - 1
  return {
    ...run,
    week: submission.week,
    best,
    place: above.data().count + 1,
    players: total.data().count,
    // Share of the other players this game beat; 100 when you're the only one so far.
    percentile: others > 0 ? Math.round((below.data().count / others) * 100) : 100,
  }
})

/** Deletes everything stored for the player, then the account itself. */
export const deleteAccount = onCall(async (req): Promise<{ deleted: true }> => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'signIn')
  const user = db.doc(`users/${uid}`)
  const history = await user.collection('history').get()
  const weeks = new Set(history.docs.map((d) => d.get('week') as string))
  const runs = history.empty ? [] : await db.getAll(...history.docs.map((d) => db.doc(`runs/${d.id}`)))
  const writer = db.bulkWriter()
  for (const w of weeks) void writer.delete(db.doc(`weeks/${w}/entries/${uid}`))
  for (const r of runs) {
    const fingerprint = r.get('fingerprint') as string | undefined
    if (fingerprint) void writer.delete(db.doc(`weeks/${r.get('week') as string}/games/${fingerprint}`))
    void writer.delete(r.ref)
  }
  await writer.close()
  await db.recursiveDelete(user)
  await getAuth().deleteUser(uid).catch(() => undefined)
  return { deleted: true }
})
