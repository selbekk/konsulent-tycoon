import { describe, expect, it } from 'vitest'
import { binomial, chance, createRng, hashString, nextFloat, nextInt, pick, shuffle, weightedPick } from './rng'

describe('rng', () => {
  it('is deterministic for same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([nextFloat(a), nextFloat(a), nextFloat(a)]).toEqual([nextFloat(b), nextFloat(b), nextFloat(b)])
  })

  it('state is plain serializable data', () => {
    const r = createRng(1)
    nextFloat(r)
    const copy = JSON.parse(JSON.stringify(r))
    expect(nextFloat(copy)).toBe(nextFloat(r))
  })

  it('nextInt is inclusive and in range', () => {
    const r = createRng(7)
    const seen = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const n = nextInt(r, 2, 5)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(5)
      seen.add(n)
    }
    expect(seen.size).toBe(4)
  })

  it('pick, chance, weightedPick, shuffle and binomial behave', () => {
    const r = createRng(3)
    expect(['a', 'b']).toContain(pick(r, ['a', 'b']))
    expect(chance(r, 0)).toBe(false)
    expect(chance(r, 1)).toBe(true)
    expect(weightedPick(r, ['x', 'y'], (v) => (v === 'y' ? 1 : 0))).toBe('y')
    expect(weightedPick(r, ['x'], () => 0)).toBeUndefined()
    expect(shuffle(r, [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
    expect(binomial(r, 10, 0)).toBe(0)
    expect(binomial(r, 10, 1)).toBe(10)
  })

  it('hashString is stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})
