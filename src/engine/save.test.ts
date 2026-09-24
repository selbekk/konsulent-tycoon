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

  it('stores the slot with metadata and survives broken storage', () => {
    const storage = new MemoryStorage()
    const s = newTestGame()
    expect(saveToSlot(storage, 'auto', s, new Date('2027-01-01'))).toBe(true)
    expect(listSlots(storage)).toEqual([
      { slot: 'auto', firmName: 'Test AS', quarter: 0, savedAt: '2027-01-01T00:00:00.000Z', cash: s.firms.player.cash, status: 'playing' },
    ])
    expect(loadFromSlot(storage, 'auto')).toEqual(s)
    deleteSlot(storage, 'auto')
    expect(loadFromSlot(storage, 'auto')).toBeNull()
    expect(saveToSlot(new BrokenStorage(), 'auto', s)).toBe(false)
  })

  it('rejects saves with the wrong shape', () => {
    const s = JSON.parse(serialize(newTestGame()))
    delete s.firms.player.pools
    expect(() => deserialize(JSON.stringify(s))).toThrow('save.incompatible')
  })

  it('purges a save this version cannot read', () => {
    const storage = new MemoryStorage()
    const broken = JSON.parse(serialize(newTestGame()))
    delete broken.firms.player.stars
    saveToSlot(storage, 'auto', newTestGame())
    storage.setItem('kt.save.auto', JSON.stringify(broken))

    expect(readSlot(storage, 'auto')).toEqual({ error: 'incompatible' })
    expect(purgeIncompatibleSaves(storage)).toEqual(['auto'])
    expect(listSlots(storage)).toEqual([])
  })

  it('keeps a save from a newer build', () => {
    const storage = new MemoryStorage()
    const good = newTestGame()
    saveToSlot(storage, 'auto', good)
    storage.setItem('kt.save.auto', JSON.stringify({ ...good, saveVersion: 999 }))
    expect(readSlot(storage, 'auto')).toEqual({ error: 'tooNew' })
    expect(purgeIncompatibleSaves(storage)).toEqual([])
    expect(storage.getItem('kt.save.auto')).not.toBeNull()
  })

  it('deletes manual slots from earlier builds, which made minigames retryable', () => {
    const storage = new MemoryStorage()
    const good = newTestGame()
    saveToSlot(storage, 'auto', good)
    for (const slot of ['1', '2', '3']) {
      storage.setItem(`kt.save.${slot}`, serialize(good))
      storage.setItem(`kt.meta.${slot}`, JSON.stringify({ slot, firmName: 'Borte AS', quarter: 4, savedAt: '', cash: 0, status: 'playing' }))
    }
    expect(purgeIncompatibleSaves(storage)).toEqual([])
    expect(storage.length).toBe(2)
    expect(loadFromSlot(storage, 'auto')).toEqual(good)
  })

  it('rejects a save where a required field is null (NaN written as JSON)', () => {
    const s = JSON.parse(serialize(newTestGame()))
    s.firms.player.cash = null
    expect(() => deserialize(JSON.stringify(s))).toThrow('save.incompatible')
  })

  it('rejects a save where a firm number is not a number', () => {
    const s = JSON.parse(serialize(newTestGame()))
    s.firms.player.cash = '9999999999'
    expect(() => deserialize(JSON.stringify(s))).toThrow('save.incompatible')
  })
})
