import { FIRMS } from '../../content/firms'

/** Names that make the business press raise an eyebrow: the game's own, and the rival firms' (as shown in the game). */
const FAMILIAR_NAMES = new Set(['konsulent tycoon', ...FIRMS.map((f) => f.name.toLowerCase())])

export function isFamiliarName(name: string) {
  return FAMILIAR_NAMES.has(name.trim().replace(/\s+/g, ' ').toLowerCase())
}
