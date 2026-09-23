import { describe, expect, it } from 'vitest'
import { deleteSlot, deserialize, listSlots, loadFromSlot, saveToSlot, serialize } from './save'
import { newTestGame } from './testUtils'

class MemoryStorage implements Storage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.get(k) ?? null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

class BrokenStorage extends MemoryStorage {
  setItem(): void { throw new Error('QuotaExceeded') }
}

describe('save', () => {
  it('round-trips', () => {
    const s = newTestGame()
    expect(deserialize(serialize(s))).toEqual(s)
  })

  it('runs migrations in order', () => {
    const s = { ...newTestGame(), saveVersion: 0 }
    const migrated = deserialize(JSON.stringify(s), { 0: (x) => ({ ...x, migrated: true }) }, 1) as unknown as Record<string, unknown>
    expect(migrated.saveVersion).toBe(1)
    expect(migrated.migrated).toBe(true)
  })

  it('refuses saves from the future', () => {
    expect(() => deserialize(JSON.stringify({ saveVersion: 999 }))).toThrow('save.tooNew')
  })

  it('stores slots with metadata and survives broken storage', () => {
    const storage = new MemoryStorage()
    const s = newTestGame()
    expect(saveToSlot(storage, '1', s, new Date('2027-01-01'))).toBe(true)
    expect(listSlots(storage)).toEqual([
      { slot: '1', firmName: 'Test AS', quarter: 0, savedAt: '2027-01-01T00:00:00.000Z', cash: s.firms.player.cash, status: 'playing' },
    ])
    expect(loadFromSlot(storage, '1')).toEqual(s)
    deleteSlot(storage, '1')
    expect(loadFromSlot(storage, '1')).toBeNull()
    expect(saveToSlot(new BrokenStorage(), 'auto', s)).toBe(false)
  })
})
