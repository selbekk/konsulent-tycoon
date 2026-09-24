import { SAVE_VERSION } from './constants'
import { buildRoster } from './roster'
import { hasValidShape } from './saveShape'
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
  if (!hasValidShape(s)) throw new Error('save.incompatible')
  // Saves from before rosters: give the player's people names from their pools.
  const me = s.firms[s.playerId]
  if (!me.roster) buildRoster(s, me)
  return s
}

/**
 * One slot, written after every action. Manual slots were removed: saving before a pitch or the end
 * of a quarter and loading again made every minigame and roll retryable.
 */
export type SlotId = 'auto'
export const SLOTS: SlotId[] = ['auto']
/** Manual slots from earlier builds; deleted at startup. */
const LEGACY_SLOTS = ['1', '2', '3']

export interface SlotMeta {
  slot: SlotId
  firmName: string
  quarter: number
  savedAt: string
  cash: number
  status: GameState['status']
}

const saveKey = (slot: string) => `kt.save.${slot}`
/** The localStorage key a slot's save lives under, e.g. to notice another tab writing it. */
export const slotStorageKey = (slot: SlotId) => saveKey(slot)
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

/**
 * - `missing`: nothing stored.
 * - `incompatible`: stored, but unreadable by this version of the game (broken, wrong shape, no migration).
 * - `tooNew`: written by a newer build (e.g. a stale service worker running old code). Keep it.
 */
export type SlotRead = { state: GameState } | { error: 'missing' | 'incompatible' | 'tooNew' }

export function readSlot(storage: Storage, slot: SlotId): SlotRead {
  let raw: string | null
  try {
    raw = storage.getItem(saveKey(slot))
  } catch {
    return { error: 'missing' }
  }
  if (!raw) return { error: 'missing' }
  try {
    return { state: deserialize(raw) }
  } catch (e) {
    return { error: e instanceof Error && e.message === 'save.tooNew' ? 'tooNew' : 'incompatible' }
  }
}

export function loadFromSlot(storage: Storage, slot: SlotId): GameState | null {
  const r = readSlot(storage, slot)
  return 'state' in r ? r.state : null
}

/**
 * Deletes saves the current game can't load (and metadata left without a save), so the menu
 * never offers to continue them. Returns the slots that held a real save that was dropped.
 */
export function purgeIncompatibleSaves(storage: Storage): SlotId[] {
  const dropped: SlotId[] = []
  for (const slot of SLOTS) {
    const r = readSlot(storage, slot)
    if ('state' in r || r.error === 'tooNew') continue
    if (r.error === 'incompatible') dropped.push(slot)
    deleteSlot(storage, slot)
  }
  for (const slot of LEGACY_SLOTS) removeSlotKeys(storage, slot)
  return dropped
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
  removeSlotKeys(storage, slot)
}

function removeSlotKeys(storage: Storage, slot: string) {
  try {
    storage.removeItem(saveKey(slot))
    storage.removeItem(metaKey(slot))
  } catch {
    /* ignore */
  }
}
