export interface RngState {
  s: number
}

export const createRng = (seed: number): RngState => ({ s: seed >>> 0 })

/** mulberry32 – mutates the given state object. Only ever call on a draft copy of game state. */
export function nextFloat(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0
  let t = r.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const nextInt = (r: RngState, min: number, max: number) => min + Math.floor(nextFloat(r) * (max - min + 1))

export const pick = <T>(r: RngState, xs: readonly T[]): T => xs[Math.floor(nextFloat(r) * xs.length)]

export const chance = (r: RngState, p: number) => nextFloat(r) < p

export const noise = (r: RngState, amp: number) => (nextFloat(r) * 2 - 1) * amp

export const range = (r: RngState, min: number, max: number) => min + nextFloat(r) * (max - min)

export function weightedPick<T>(r: RngState, xs: readonly T[], w: (x: T) => number): T | undefined {
  const total = xs.reduce((s, x) => s + Math.max(0, w(x)), 0)
  if (total <= 0) return undefined
  let roll = nextFloat(r) * total
  for (const x of xs) {
    roll -= Math.max(0, w(x))
    if (roll < 0) return x
  }
  return xs[xs.length - 1]
}

export function shuffle<T>(r: RngState, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(r) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Number of successes in n trials with probability p. */
export function binomial(r: RngState, n: number, p: number): number {
  let k = 0
  for (let i = 0; i < n; i++) if (nextFloat(r) < p) k++
  return k
}

/** Stable string hash (FNV-1a) – for UI-side RNG that must never touch game state. */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
