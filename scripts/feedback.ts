/**
 * Prints the latest player feedback: `npm run feedback` (or `-- 100` for more, `-- --account you@example.com`
 * for another gcloud account than the active one). Reads Firestore over REST with your gcloud login, so it needs
 * `gcloud auth login` and access to the project, but no service account or extra packages.
 */
import { execFileSync } from 'node:child_process'

const PROJECT = 'konsulent-tycoon'
const args = process.argv.slice(2)
const accountAt = args.indexOf('--account')
const account = accountAt >= 0 ? args[accountAt + 1] : undefined
const count = Number(args.find((a, i) => /^\d+$/.test(a) && i !== accountAt + 1) ?? 30)

const token = execFileSync('gcloud', ['auth', 'print-access-token', ...(account ? [account] : [])], {
  encoding: 'utf8',
}).trim()

type Value = { stringValue?: string; integerValue?: string; nullValue?: null; timestampValue?: string }
interface Row {
  document?: { fields: Record<string, Value> }
}

const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
  {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'feedback' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: count,
      },
    }),
  },
)
if (!res.ok) {
  console.error(`Firestore answered ${res.status}:`, await res.text())
  process.exit(1)
}

const rows = ((await res.json()) as Row[]).flatMap((r) => (r.document ? [r.document.fields] : []))
if (!rows.length) {
  console.log('No feedback yet.')
  process.exit(0)
}

const str = (v?: Value) => v?.stringValue ?? v?.integerValue ?? v?.timestampValue ?? ''
for (const f of rows) {
  const rating = Number(str(f.rating))
  const where = str(f.source) + (f.quarter?.integerValue ? `, quarter ${Number(f.quarter.integerValue) + 1}` : '')
  console.log(
    `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}  ${str(f.createdAt).slice(0, 16)}  ${str(f.lang)}  ${where}`,
  )
  if (str(f.text)) console.log(`  ${str(f.text).replaceAll('\n', '\n  ')}`)
  console.log()
}
const ratings = rows.map((f) => Number(str(f.rating)))
const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
console.log(`${rows.length} shown, average ${avg.toFixed(2)} / 5`)
