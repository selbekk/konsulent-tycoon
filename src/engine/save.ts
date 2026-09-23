import { SAVE_VERSION } from './constants'
import type { GameState } from './types'

type AnyState = Record<string, unknown> & { saveVersion: number }
export type Migration = (s: AnyState) => AnyState

/** migrations[n] upgrades a v(n) save to v(n+1). Add one every time GameState changes shape after release. */
export const migrations: Record<number, Migration> = {}

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

export function deserialize(raw: string, migs: Record<number, Migration> = migrations, target = SAVE_VERSION): GameState {
  let s = JSON.parse(raw) as AnyState
  if (typeof s?.saveVersion !== 'number') throw new Error('save.invalid')
  if (s.saveVersion > target) throw new Error('save.tooNew')
  while (s.saveVersion < target) {
    const m = migs[s.saveVersion]
    if (!m) throw new Error('save.noMigration')
    s = { ...m(s), saveVersion: s.saveVersion + 1 }
  }
  return s as unknown as GameState
}

export type SlotId = 'auto' | '1' | '2' | '3'
export const SLOTS: SlotId[] = ['auto', '1', '2', '3']

export interface SlotMeta {
  slot: SlotId
  firmName: string
  quarter: number
  savedAt: string
  cash: number
  status: GameState['status']
}

const saveKey = (slot: string) => `kt.save.${slot}`
const metaKey = (slot: string) => `kt.meta.${slot}`

export function saveToSlot(storage: Storage, slot: SlotId, state: GameState, now = new Date()): boolean {
  try {
    const p = state.firms[state.playerId]
    const meta: SlotMeta = { slot, firmName: p.name, quarter: state.quarter, savedAt: now.toISOString(), cash: p.cash, status: state.status }
    storage.setItem(saveKey(slot), serialize(state))
    storage.setItem(metaKey(slot), JSON.stringify(meta))
    return true
  } catch {
    return false
  }
}

export function loadFromSlot(storage: Storage, slot: SlotId): GameState | null {
  try {
    const raw = storage.getItem(saveKey(slot))
    return raw ? deserialize(raw) : null
  } catch {
    return null
  }
}

export function listSlots(storage: Storage): SlotMeta[] {
  const out: SlotMeta[] = []
  for (const slot of SLOTS) {
    try {
      const raw = storage.getItem(metaKey(slot))
      if (raw) out.push(JSON.parse(raw) as SlotMeta)
    } catch {
      /* ignore broken slot */
    }
  }
  return out
}

export function deleteSlot(storage: Storage, slot: SlotId) {
  try {
    storage.removeItem(saveKey(slot))
    storage.removeItem(metaKey(slot))
  } catch {
    /* ignore */
  }
}
