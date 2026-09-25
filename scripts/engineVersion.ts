import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIRS = ['src/engine', 'src/content']

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('testUtils.ts'))
}

/**
 * Fingerprint of everything that decides how a game plays: the engine and its content. The leaderboard
 * only replays games from the same version, since any rule change can make an old log play differently.
 * Baked into the app and the Cloud Function at build time (`__ENGINE_VERSION__`).
 */
export function engineVersion(root = ROOT): string {
  const hash = createHash('sha256')
  for (const file of DIRS.flatMap((d) => sources(join(root, d))).sort()) {
    hash.update(relative(root, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(engineVersion())
