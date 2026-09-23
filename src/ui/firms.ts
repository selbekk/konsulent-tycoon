import { FIRMS, PLAYER_COLORS } from '../content/firms'
import type { FirmDef } from '../content/firms'

const BY_ID: Record<string, FirmDef> = Object.fromEntries(FIRMS.map((f) => [f.id, f]))

export const firmDef = (id: string): FirmDef | undefined => BY_ID[id]
export const firmColors = (id: string): [string, string] => BY_ID[id]?.colors ?? PLAYER_COLORS
