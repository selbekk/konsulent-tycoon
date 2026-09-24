import { describe, expect, it } from 'vitest'
import { compose, LEAD_RANGE, parseChord, passesFor, type LeadVoice } from './compose'
import { SONGS } from './songs'

const isLead = (v: string): v is LeadVoice => v in LEAD_RANGE

describe('compose', () => {
  it('has twenty songs with unique ids', () => {
    expect(SONGS).toHaveLength(20)
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(20)
  })

  it('parses every chord in every song', () => {
    for (const song of SONGS) {
      for (const bar of Object.values(song.sections).flat()) for (const c of bar.split(' ')) expect(() => parseChord(c)).not.toThrow()
      expect(() => parseChord(song.end)).not.toThrow()
      for (const l of song.form) expect(song.sections[l], `${song.id} section ${l}`).toBeDefined()
    }
  })

  it('is deterministic', () => {
    for (const song of SONGS) expect(compose(song)).toEqual(compose(song))
  })

  it.each(SONGS.map((s) => [s.id, s] as const))('%s is a sane length, sorted and in range', (_, song) => {
    const score = compose(song)
    const seconds = (score.beats * 60) / score.bpm
    expect(seconds).toBeGreaterThan(60)
    expect(seconds).toBeLessThan(240)
    for (let i = 1; i < score.events.length; i++) expect(score.events[i].time).toBeGreaterThanOrEqual(score.events[i - 1].time)
    for (const e of score.events) {
      expect(e.dur).toBeGreaterThan(0)
      expect(e.time + e.dur).toBeLessThanOrEqual(score.beats)
      if (e.part === 'lead' && isLead(e.voice)) {
        const [lo, hi] = LEAD_RANGE[e.voice]
        expect(e.midi).toBeGreaterThanOrEqual(lo)
        expect(e.midi).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('puts chord tones on the strong beats and repeats the A theme rhythm', () => {
    for (const song of SONGS) {
      // Straight songs only, so beat positions are exact.
      const score = compose({ ...song, swing: false })
      const barsA = song.sections[song.form[0]].length
      const bars = [...song.form].flatMap((l) => song.sections[l])
      const intro = 2
      const melody = score.events.filter((e) => e.part === 'lead' && e.voice === song.lead)
      for (const e of melody) {
        const bar = Math.floor(e.time / 4) - intro
        const beat = e.time % 4
        if (bar < 0 || bar >= bars.length * passesFor(song) || (beat !== 0 && beat !== 2)) continue
        const names = bars[bar % bars.length].split(' ')
        const chord = parseChord(names[names.length === 2 && beat >= 2 ? 1 : 0])
        expect(chord.tones.map((t) => (chord.root + t) % 12), `${song.id} bar ${bar}`).toContain(e.midi % 12)
      }
      // The first A and the A of the second pass share their rhythm.
      const rhythm = (fromBar: number) =>
        melody.filter((e) => e.time >= (intro + fromBar) * 4 && e.time < (intro + fromBar + barsA) * 4).map((e) => e.time - (intro + fromBar) * 4)
      expect(rhythm(bars.length), song.id).toEqual(rhythm(0))
    }
  })
})
