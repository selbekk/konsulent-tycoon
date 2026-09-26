/** Standup bingo: the easter egg behind typing "bingo" on the main menu. UI only, with its own randomness. */

export const STANDUP_PHRASES = [
  'noBlockers',
  'offline',
  'sameAsYesterday',
  'seeMyScreen',
  'onMute',
  'almostDone',
  'separateChat',
  'stuff',
  'waitingReview',
  'myMachine',
  'quickOne',
  'shareScreen',
  'wasMuted',
  'retro',
  'hearMe',
  'notMuch',
  'bitsAndPieces',
  'carryingOn',
  'isPerHere',
  'waitForOthers',
  'quickThing',
  'sync',
  'prodSoon',
  'hardStop',
] as const
export type Phrase = (typeof STANDUP_PHRASES)[number]

export const CARD_SIZE = 4
export const SCRIPT_LINES = 15
export const SPEAKERS = 5
export const MAX_STRIKES = 3

export interface StandupLine {
  speaker: number
  phrase: Phrase
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function setupStandup(rand: () => number) {
  const card = shuffle(STANDUP_PHRASES, rand).slice(0, CARD_SIZE * CARD_SIZE)
  const script: StandupLine[] = shuffle(STANDUP_PHRASES, rand)
    .slice(0, SCRIPT_LINES)
    .map((phrase) => ({ phrase, speaker: Math.floor(rand() * SPEAKERS) }))
  return { card, script }
}

/** Rows, columns and both diagonals of cell indices. */
const LINES: number[][] = (() => {
  const n = CARD_SIZE
  const idx = Array.from({ length: n }, (_, i) => i)
  return [
    ...idx.map((r) => idx.map((c) => r * n + c)),
    ...idx.map((c) => idx.map((r) => r * n + c)),
    idx.map((i) => i * n + i),
    idx.map((i) => i * n + (n - 1 - i)),
  ]
})()

/** The first completed line, or null. */
export function bingoLine(marked: readonly number[]): number[] | null {
  return LINES.find((line) => line.every((i) => marked.includes(i))) ?? null
}
