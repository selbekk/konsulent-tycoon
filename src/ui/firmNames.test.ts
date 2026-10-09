import { describe, expect, it } from 'vitest'
import { FIRMS } from '../content/firms'
import { FIRM_NAME_SUGGESTIONS, suggestFirmName } from './firmNames'

describe('firm name suggestions', () => {
  it('has at least 100 unique names that fit the field and are not taken by a rival', () => {
    expect(FIRM_NAME_SUGGESTIONS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(FIRM_NAME_SUGGESTIONS).size).toBe(FIRM_NAME_SUGGESTIONS.length)
    const rivals = new Set(FIRMS.map((f) => f.name))
    for (const name of FIRM_NAME_SUGGESTIONS) {
      expect(name.length).toBeLessThanOrEqual(40)
      expect(rivals.has(name)).toBe(false)
    }
  })

  it('never suggests the name already in the field', () => {
    for (let i = 0; i < 50; i++) expect(suggestFirmName('Kaffe & Kode')).not.toBe('Kaffe & Kode')
  })
})
