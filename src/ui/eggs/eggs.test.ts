import { describe, expect, it } from 'vitest'
import { isChristmas, isChristmasSeason, isNight } from './clock'
import { isFamiliarName } from './familiarName'
import { CARD_SIZE, SCRIPT_LINES, STANDUP_PHRASES, bingoLine, setupStandup } from './standupRules'
import { isTerminalPerson } from './terminal'

const at = (month: number, day: number, hour = 12) => new Date(2027, month - 1, day, hour).getTime()

describe('easter egg clock', () => {
  it('knows night from day', () => {
    expect(isNight(at(3, 1, 3))).toBe(true)
    expect(isNight(at(3, 1, 5))).toBe(false)
    expect(isNight(at(3, 1, 23))).toBe(false)
  })

  it('keeps Christmas to December, up to Boxing Day, or late-year weekly challenges', () => {
    expect(isChristmas(at(12, 1))).toBe(true)
    expect(isChristmas(at(12, 26))).toBe(true)
    expect(isChristmas(at(12, 27))).toBe(false)
    expect(isChristmas(at(11, 30))).toBe(false)
    expect(isChristmasSeason('2027-W52', at(6, 1))).toBe(true)
    expect(isChristmasSeason('2027-W50', at(6, 1))).toBe(false)
    expect(isChristmasSeason(undefined, at(6, 1))).toBe(false)
  })
})

describe('familiar firm names', () => {
  it('recognises the game and the rivals, however they are typed', () => {
    expect(isFamiliarName('Konsulent Tycoon')).toBe(true)
    expect(isFamiliarName('  accentura ')).toBe(true)
    expect(isFamiliarName('Sopp   Steria')).toBe(true)
  })

  it('leaves the default name and the suggestions alone', () => {
    for (const name of [
      'Konsulent & Konsulent AS',
      'Consultant & Consultant Ltd',
      'Synergi Solutions',
      'Fakturerbar AS',
      'Nordlys Digital',
      'Kaffe & Kode',
      'Timeliste Group',
    ])
      expect(isFamiliarName(name)).toBe(false)
  })
})

describe('standup bingo', () => {
  it('deals a card and a script of distinct phrases', () => {
    const { card, script } = setupStandup(Math.random)
    expect(new Set(card).size).toBe(CARD_SIZE * CARD_SIZE)
    expect(new Set(script.map((l) => l.phrase)).size).toBe(SCRIPT_LINES)
    for (const p of [...card, ...script.map((l) => l.phrase)]) expect(STANDUP_PHRASES).toContain(p)
  })

  it('finds rows, columns and diagonals, and nothing less', () => {
    expect(bingoLine([0, 1, 2, 3])).toEqual([0, 1, 2, 3])
    expect(bingoLine([1, 5, 9, 13])).toEqual([1, 5, 9, 13])
    expect(bingoLine([0, 5, 10, 15])).toEqual([0, 5, 10, 15])
    expect(bingoLine([3, 6, 9, 12])).toEqual([3, 6, 9, 12])
    expect(bingoLine([0, 1, 2, 4, 5, 6])).toBeNull()
  })
})

describe('terminal portraits', () => {
  it('are rare but real', () => {
    const hits = Array.from({ length: 6000 }, (_, i) => isTerminalPerson(`e${i}`)).filter(Boolean).length
    expect(hits).toBeGreaterThan(10)
    expect(hits).toBeLessThan(90)
  })
})
