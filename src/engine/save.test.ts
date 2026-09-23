import { describe, expect, it } from 'vitest'
import { deleteSlot, deserialize, listSlots, loadFromSlot, purgeIncompatibleSaves, readSlot, saveToSlot, serialize } from './save'
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

  it('rejects saves with the wrong shape', () => {
    const s = JSON.parse(serialize(newTestGame()))
    delete s.firms.player.pools
    expect(() => deserialize(JSON.stringify(s))).toThrow('save.incompatible')
  })

  it('purges saves this version cannot read, but keeps ones from newer builds', () => {
    const storage = new MemoryStorage()
    const good = newTestGame()
    saveToSlot(storage, 'auto', good)
    saveToSlot(storage, '1', good)
    saveToSlot(storage, '2', good)
    const broken = JSON.parse(serialize(good))
    delete broken.firms.player.stars
    storage.setItem('kt.save.1', JSON.stringify(broken))
    storage.setItem('kt.save.2', JSON.stringify({ ...good, saveVersion: 999 }))
    // Metadata without a save behind it.
    storage.setItem('kt.meta.3', JSON.stringify({ slot: '3', firmName: 'Borte AS', quarter: 4, savedAt: '', cash: 0, status: 'playing' }))

    expect(readSlot(storage, '1')).toEqual({ error: 'incompatible' })
    expect(readSlot(storage, '2')).toEqual({ error: 'tooNew' })
    expect(purgeIncompatibleSaves(storage)).toEqual(['1'])
    expect(listSlots(storage).map((m) => m.slot)).toEqual(['auto', '2'])
    expect(loadFromSlot(storage, 'auto')).toEqual(good)
    expect(storage.getItem('kt.save.2')).not.toBeNull()
  })
})
