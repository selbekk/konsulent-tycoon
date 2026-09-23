import { firmLevel, headcount } from '../../engine'
import type { Firm } from '../../engine'

export type RoomTile = 'coffee' | 'plant' | 'kitchen' | 'sofa' | 'fagrom' | 'whiteboard' | 'pingpong' | 'reception' | 'window' | 'terrace' | 'bust'

/** One new piece of the office per level (the office itself is named after the level). */
const LEVEL_ROOMS: [number, RoomTile][] = [
  [2, 'reception'],
  [3, 'window'],
  [4, 'terrace'],
  [5, 'bust'],
]
export type Tile = { kind: 'desk'; occupied: boolean } | { kind: 'room'; room: RoomTile }

export interface OfficeFloor {
  tiles: Tile[]
}

export const DESKS_PER_FLOOR = 20
export const MAX_FLOORS = 4

/** Pure: which rooms and desks the office has, from headcount and culture levels. */
export function officeLayout(firm: Firm): { floors: OfficeFloor[]; hiddenPeople: number; rooms: RoomTile[] } {
  const hc = headcount(firm)
  const level = firmLevel(firm)
  const rooms: RoomTile[] = ['coffee', ...LEVEL_ROOMS.filter(([l]) => level >= l).map(([, room]) => room)]
  if (hc >= 20) rooms.push('plant')
  if (firm.sosialt >= 40) rooms.push('kitchen')
  if (firm.sosialt >= 70) rooms.push('sofa')
  if (firm.fagmiljo >= 40) rooms.push('fagrom')
  if (firm.fagmiljo >= 70) rooms.push('whiteboard')
  if (hc >= 50) rooms.push('pingpong')

  const floorCount = Math.min(MAX_FLOORS, Math.max(1, Math.ceil(hc / DESKS_PER_FLOOR), hc >= 100 ? 4 : hc >= 50 ? 3 : hc >= 20 ? 2 : 1))
  const floors: OfficeFloor[] = []
  let people = hc
  for (let f = 0; f < floorCount; f++) {
    const tiles: Tile[] = []
    // Ground floor gets the rooms; upper floors share them out.
    const floorRooms = rooms.filter((_, i) => i % floorCount === f)
    for (const room of floorRooms) tiles.push({ kind: 'room', room })
    const desks = Math.max(4, Math.min(DESKS_PER_FLOOR, Math.ceil(hc / floorCount) + 2))
    for (let d = 0; d < desks; d++) {
      tiles.push({ kind: 'desk', occupied: people > 0 })
      if (people > 0) people--
    }
    floors.push({ tiles })
  }
  return { floors: floors.reverse(), hiddenPeople: Math.max(0, people), rooms }
}
