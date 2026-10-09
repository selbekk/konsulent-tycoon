import { describe, expect, it } from 'vitest'
import { FEEDBACK_MAX_TEXT, parseFeedback } from './feedback'

const ok = { rating: 4, text: '  Gøy!  ', lang: 'nb', source: 'end', quarter: 39 }

describe('parseFeedback', () => {
  it('accepts a valid payload and trims the text', () => {
    expect(parseFeedback(ok)).toEqual({ ...ok, text: 'Gøy!' })
    expect(parseFeedback({ ...ok, text: undefined, quarter: null })).toEqual({ ...ok, text: '', quarter: null })
  })

  it.each([
    ['no object', 'hei'],
    ['an array', [ok]],
    ['a rating out of range', { ...ok, rating: 6 }],
    ['a fractional rating', { ...ok, rating: 3.5 }],
    ['a rating as a string', { ...ok, rating: '5' }],
    ['text that is too long', { ...ok, text: 'x'.repeat(FEEDBACK_MAX_TEXT + 1) }],
    ['text that is not a string', { ...ok, text: { toString: 'x' } }],
    ['an unknown language', { ...ok, lang: 'sv' }],
    ['an unknown source', { ...ok, source: 'constructor' }],
    ['a strange quarter', { ...ok, quarter: -1 }],
    ['an extra key', { ...ok, firmName: 'Selbekk AS' }],
    [
      'a prototype key',
      JSON.parse('{"__proto__": {"x": 1}, "rating": 4, "lang": "nb", "source": "end", "quarter": 1}'),
    ],
  ])('refuses %s', (_, data) => {
    expect(parseFeedback(data)).toBeNull()
  })
})
