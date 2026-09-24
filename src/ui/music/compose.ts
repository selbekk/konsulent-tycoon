import { createRng, hashString, nextFloat, pick, type RngState } from '../../engine/rng'

/**
 * Turns a song spec (chords, form, style) into a list of timed notes. Pure and deterministic:
 * the melody is generated from a seed derived from the song id, so a song sounds the same every time.
 * Time is in beats (4 per bar); the player converts to seconds.
 */
export type LeadVoice = 'square' | 'clarinet' | 'flute' | 'brass' | 'vibes' | 'piano'
export type Voice = LeadVoice | 'epiano' | 'organ' | 'bass' | 'kick' | 'snare' | 'hat' | 'ride'
export type CompStyle = 'charleston' | 'stride' | 'pad' | 'twoFour' | 'bossa'
export type BassStyle = 'walk' | 'two' | 'boogie' | 'bossa' | 'none'
export type DrumStyle = 'swing' | 'brush' | 'shuffle' | 'bossa' | 'march'

export interface SongSpec {
  id: string
  bpm: number
  /** Swung eighths. */
  swing: boolean
  /** One entry per bar; a bar may hold two chords ("Dm7 G7"), two beats each. */
  sections: Record<string, string[]>
  /** Section letters in order, e.g. "AABA". */
  form: string
  /** The chord the song ends on. */
  end: string
  lead: LeadVoice
  /** Plays the B sections after the first pass (the "solo"). Defaults to piano, or vibes if the lead is piano. */
  solo?: LeadVoice
  comp: CompStyle
  bass: BassStyle
  drums: DrumStyle
  /** Busier melody rhythms. */
  busy?: boolean
}

export interface NoteEvent {
  part: 'lead' | 'comp' | 'bass' | 'drums'
  time: number
  dur: number
  midi: number
  voice: Voice
  /** 0–1 */
  vel: number
}

export interface Score {
  id: string
  bpm: number
  /** Total length in beats, including the ring-out after the last chord. */
  beats: number
  events: NoteEvent[]
}

/** Lowest and highest melody note per lead voice (MIDI). */
export const LEAD_RANGE: Record<LeadVoice, [number, number]> = {
  square: [65, 84],
  clarinet: [58, 81],
  flute: [67, 88],
  brass: [58, 79],
  vibes: [62, 84],
  piano: [62, 86],
}

const BEATS_PER_BAR = 4
/** Songs repeat the form until they are at least this many bars long. */
const MIN_BARS = 48

// ---------------------------------------------------------------------------------------------
// Chords

export interface Chord {
  root: number
  /** Semitones above the root. */
  tones: number[]
  /** The scale melody notes are drawn from over this chord. */
  scale: number[]
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10]
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10]
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11]

const QUALITIES: Record<string, Omit<Chord, 'root'>> = {
  '': { tones: [0, 4, 7], scale: IONIAN },
  '6': { tones: [0, 4, 7, 9], scale: IONIAN },
  maj7: { tones: [0, 4, 7, 11], scale: IONIAN },
  m: { tones: [0, 3, 7], scale: HARMONIC_MINOR },
  m6: { tones: [0, 3, 7, 9], scale: DORIAN },
  m7: { tones: [0, 3, 7, 10], scale: DORIAN },
  '7': { tones: [0, 4, 7, 10], scale: MIXOLYDIAN },
  '7b9': { tones: [0, 4, 7, 10, 13], scale: [0, 1, 4, 5, 7, 8, 10] },
  m7b5: { tones: [0, 3, 6, 10], scale: LOCRIAN },
  dim7: { tones: [0, 3, 6, 9], scale: [0, 2, 3, 5, 6, 8, 9, 11] },
}

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export function parseChord(name: string): Chord {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name)
  const quality = m ? QUALITIES[m[3]] : undefined
  if (!m || !quality) throw new Error(`Unknown chord: ${name}`)
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return { root: (PITCH_CLASS[m[1]] + shift + 12) % 12, ...quality }
}

const pc = (midi: number) => ((midi % 12) + 12) % 12
const isChordTone = (midi: number, c: Chord) => c.tones.some((t) => (c.root + t) % 12 === pc(midi))
const inScale = (midi: number, c: Chord) => c.scale.some((t) => (c.root + t) % 12 === pc(midi))

/** The lowest MIDI note >= lo with the given pitch class. */
const placeAbove = (pitchClass: number, lo: number) => lo + ((pitchClass - lo) % 12 + 12) % 12

function nearest(midi: number, ok: (n: number) => boolean): number {
  for (let d = 0; d < 12; d++) {
    if (ok(midi + d)) return midi + d
    if (ok(midi - d)) return midi - d
  }
  return midi
}

/** Moves `steps` scale degrees from `from` within the chord's scale. */
function stepInScale(from: number, steps: number, c: Chord): number {
  let n = nearest(from, (x) => inScale(x, c))
  const dir = Math.sign(steps)
  for (let i = 0; i < Math.abs(steps); i++) {
    n += dir
    while (!inScale(n, c)) n += dir
  }
  return n
}

/** Close-position voicing of up to four notes starting at `lo`. Ninths and flat nines drop the fifth. */
function voicing(c: Chord, lo: number): number[] {
  const tones = c.tones.length > 4 ? c.tones.filter((t) => t !== 7) : c.tones
  return tones.map((t) => placeAbove((c.root + t) % 12, lo)).sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------------------------
// Bars

interface Slot {
  /** Beat offset within the bar. */
  at: number
  len: number
  chord: Chord
}

interface Bar {
  slots: Slot[]
  /** Section letter, or '' for the intro and the final chord. */
  section: string
  /** Index of the bar within its section. */
  index: number
  length: number
  pass: number
}

function parseBar(bar: string): Slot[] {
  const names = bar.trim().split(/\s+/)
  const len = BEATS_PER_BAR / names.length
  return names.map((n, i) => ({ at: i * len, len, chord: parseChord(n) }))
}

export const passesFor = (spec: SongSpec) => {
  const formBars = [...spec.form].reduce((sum, l) => sum + spec.sections[l].length, 0)
  return Math.max(2, Math.ceil(MIN_BARS / formBars))
}

function layout(spec: SongSpec): Bar[] {
  const bars: Bar[] = []
  // Intro: the last two bars of the form, which are usually a turnaround back to the top.
  const last = spec.sections[spec.form[spec.form.length - 1]]
  for (const b of last.slice(-2)) bars.push({ slots: parseBar(b), section: '', index: 0, length: 0, pass: -1 })
  const passes = passesFor(spec)
  for (let pass = 0; pass < passes; pass++) {
    for (const letter of spec.form) {
      const sec = spec.sections[letter]
      sec.forEach((b, index) => bars.push({ slots: parseBar(b), section: letter, index, length: sec.length, pass }))
    }
  }
  return bars
}

// ---------------------------------------------------------------------------------------------
// Melody

/** A bar's rhythm as [start, length] pairs in eighth notes. */
type Cell = readonly (readonly [number, number])[]

const CALM_CELLS: Cell[] = [
  [[0, 2], [2, 2], [4, 4]],
  [[0, 3], [3, 1], [4, 4]],
  [[0, 4], [4, 2], [6, 2]],
  [[0, 2], [3, 1], [4, 3]],
  [[1, 1], [2, 2], [4, 4]],
  [[0, 6]],
  [[0, 2], [2, 6]],
  [[0, 1], [1, 3], [4, 4]],
]
const BUSY_CELLS: Cell[] = [
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2]],
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4]],
  [[0, 2], [2, 1], [3, 3], [6, 2]],
  [[1, 1], [2, 2], [4, 1], [5, 3]],
  [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2]],
  [[0, 1], [1, 3], [4, 1], [5, 3]],
]
/** Ends a phrase: one long note and a breath. */
const CADENCE: Cell = [[0, 6]]
const STEPS = [-3, -2, -2, -1, -1, -1, 0, 1, 1, 1, 2, 2, 3]

interface PlannedBar {
  cell: Cell
  steps: number[]
}

/**
 * The rhythm and contour of a section. Two-bar motifs repeat (M, M', M, …) and the last pair
 * ends on a cadence, which is what makes it sound written rather than random.
 */
function planSection(rng: RngState, bars: number, busy: boolean): PlannedBar[] {
  const cells = busy ? [...BUSY_CELLS, ...CALM_CELLS.slice(0, 4)] : CALM_CELLS
  const bar = (cell: Cell): PlannedBar => ({ cell, steps: cell.map(() => pick(rng, STEPS)) })
  const a = bar(pick(rng, cells))
  const b = bar(pick(rng, cells))
  const b2 = bar(pick(rng, cells))
  const end = bar(pick(rng, cells))
  const out: PlannedBar[] = []
  const pairs = Math.ceil(bars / 2)
  for (let i = 0; i < pairs; i++) {
    if (i === pairs - 1) out.push(end, bar(CADENCE))
    else out.push(a, i % 2 ? b2 : b)
  }
  return out.slice(0, bars)
}

const chordAt = (bar: Bar, beat: number) => bar.slots.find((s) => beat >= s.at && beat < s.at + s.len)!.chord

// ---------------------------------------------------------------------------------------------
// Accompaniment

function comp(spec: SongSpec, bar: Bar, t0: number, out: NoteEvent[]) {
  const voice: Voice = spec.comp === 'pad' ? 'organ' : spec.lead === 'piano' && spec.comp !== 'stride' ? 'epiano' : 'piano'
  const hit = (at: number, dur: number, c: Chord, vel: number) => {
    for (const midi of voicing(c, 55)) out.push({ part: 'comp', time: t0 + at, dur, midi, voice, vel })
  }
  for (const s of bar.slots) {
    const beats = (xs: number[]) => xs.filter((x) => x < s.len)
    switch (spec.comp) {
      case 'charleston':
        hit(s.at, 0.9, s.chord, 0.34)
        if (s.len === 4) hit(s.at + 1.5, 0.45, s.chord, 0.3)
        break
      case 'twoFour':
        for (const x of beats([1, 3])) hit(s.at + x, 0.4, s.chord, 0.3)
        break
      case 'bossa':
        for (const x of beats([0, 1.5, 3])) hit(s.at + x, 0.45, s.chord, 0.3)
        break
      case 'pad':
        hit(s.at, s.len, s.chord, 0.2)
        break
      case 'stride':
        for (const x of beats([0, 1, 2, 3])) {
          if (x % 2 === 0) {
            const tone = x === 0 ? 0 : 7
            out.push({ part: 'comp', time: t0 + s.at + x, dur: 0.8, midi: placeAbove((s.chord.root + tone) % 12, 40), voice: 'piano', vel: 0.45 })
          } else hit(s.at + x, 0.5, s.chord, 0.3)
        }
        break
    }
  }
}

function bass(spec: SongSpec, bar: Bar, next: Chord | undefined, t0: number, rng: RngState, out: NoteEvent[]) {
  const note = (at: number, dur: number, midi: number, vel = 0.6) => out.push({ part: 'bass', time: t0 + at, dur, midi, voice: 'bass', vel })
  bar.slots.forEach((s, i) => {
    const root = placeAbove(s.chord.root, 36)
    const third = root + s.chord.tones[1]
    const fifth = root + s.chord.tones[2]
    const upcoming = bar.slots[i + 1]?.chord ?? next
    switch (spec.bass) {
      case 'walk': {
        const line = s.len === 4 ? [root, third, fifth] : [root]
        if (upcoming) {
          const target = placeAbove(upcoming.root, 36)
          line.push(target + (nextFloat(rng) < 0.5 ? -1 : 1))
        } else line.push(fifth)
        line.forEach((m, k) => note(s.at + k, 0.9, m, k === 0 ? 0.65 : 0.55))
        break
      }
      case 'two':
        note(s.at, Math.min(2, s.len) - 0.1, root)
        if (s.len === 4) note(s.at + 2, 1.9, fifth, 0.55)
        break
      case 'boogie': {
        const degrees = [0, s.chord.tones[1], 7, 9, 10, 9, 7, s.chord.tones[1]].slice(0, s.len * 2)
        degrees.forEach((d, k) => note(s.at + k / 2, 0.45, root + d, k % 2 ? 0.45 : 0.6))
        break
      }
      case 'bossa':
        note(s.at, 1.4, root)
        note(s.at + 1.5, 0.45, fifth, 0.5)
        if (s.len === 4) {
          note(s.at + 2, 1.4, fifth, 0.55)
          note(s.at + 3.5, 0.45, root, 0.5)
        }
        break
      case 'none':
        break
    }
  })
}

type Hits = readonly (readonly [number, number])[]
const EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
const eighths = (on: number, off: number): Hits => EIGHTHS.map((x) => [x, x % 1 ? off : on] as const)

const GROOVES: Record<DrumStyle, Partial<Record<Voice, Hits>>> = {
  swing: {
    ride: [[0, 0.5], [1, 0.6], [1.5, 0.35], [2, 0.5], [3, 0.6], [3.5, 0.35]],
    hat: [[1, 0.3], [3, 0.3]],
    kick: [[0, 0.25], [2, 0.2]],
  },
  brush: {
    ride: [[0, 0.3], [1, 0.3], [2, 0.3], [3, 0.3]],
    snare: [[1, 0.18], [3, 0.18]],
    kick: [[0, 0.2]],
  },
  shuffle: {
    hat: eighths(0.35, 0.2),
    kick: [[0, 0.6], [2, 0.55]],
    snare: [[1, 0.45], [3, 0.45]],
  },
  bossa: {
    hat: eighths(0.22, 0.14),
    kick: [[0, 0.45], [1.5, 0.3], [2, 0.45], [3.5, 0.3]],
    snare: [[0, 0.22], [1.5, 0.22], [3, 0.22]],
  },
  march: {
    hat: eighths(0.22, 0.14),
    kick: [[0, 0.55], [2, 0.5]],
    snare: [[1, 0.42], [3, 0.42]],
  },
}

function drums(spec: SongSpec, bar: Bar, t0: number, out: NoteEvent[]) {
  const groove = GROOVES[spec.drums]
  for (const [voice, hits] of Object.entries(groove) as [Voice, Hits][]) {
    for (const [at, vel] of hits) out.push({ part: 'drums', time: t0 + at, dur: 0.1, midi: 0, voice, vel })
  }
  // A small fill into the next section.
  if (bar.length && bar.index === bar.length - 1) {
    out.push({ part: 'drums', time: t0 + 3, dur: 0.1, midi: 0, voice: 'snare', vel: 0.35 }, { part: 'drums', time: t0 + 3.5, dur: 0.1, midi: 0, voice: 'snare', vel: 0.45 })
  }
}

// ---------------------------------------------------------------------------------------------

/** Maps straight time to swung time: the off-beat eighth lands at `ratio` of the beat. */
function swingTime(t: number, ratio: number): number {
  const beat = Math.floor(t)
  const f = t - beat
  return beat + (f <= 0.5 ? f * 2 * ratio : ratio + (f - 0.5) * 2 * (1 - ratio))
}

export function compose(spec: SongSpec): Score {
  const bars = layout(spec)
  const events: NoteEvent[] = []
  const accRng = createRng(hashString(`${spec.id}:bass`))
  const [lo, hi] = LEAD_RANGE[spec.lead]
  let cur = Math.round((lo + hi) / 2)
  const solo = spec.solo ?? (spec.lead === 'piano' ? 'vibes' : 'piano')

  // One plan per section and pass; the A theme returns unchanged, other sections improvise after pass 1.
  const plans = new Map<string, PlannedBar[]>()
  const planFor = (letter: string, pass: number) => {
    const key = letter === spec.form[0] ? letter : `${letter}${pass}`
    let plan = plans.get(key)
    if (!plan) {
      plan = planSection(createRng(hashString(`${spec.id}:${key}`)), spec.sections[letter].length, !!spec.busy)
      plans.set(key, plan)
    }
    return plan
  }

  bars.forEach((bar, i) => {
    const t0 = i * BEATS_PER_BAR
    comp(spec, bar, t0, events)
    bass(spec, bar, bars[i + 1]?.slots[0].chord ?? parseChord(spec.end), t0, accRng, events)
    drums(spec, bar, t0, events)
    if (!bar.section) return

    const voice = bar.pass > 0 && bar.section !== spec.form[0] ? solo : spec.lead
    const [vlo, vhi] = LEAD_RANGE[voice]
    const planned = planFor(bar.section, bar.pass)[bar.index]
    planned.cell.forEach(([start, len], k) => {
      const at = start / 2
      const c = chordAt(bar, at)
      let step = planned.steps[k]
      // Turn around near the edges of the range instead of jumping an octave.
      if ((cur > vhi - 4 && step > 0) || (cur < vlo + 4 && step < 0)) step = -step
      let midi = stepInScale(cur, step, c)
      const strong = start % 4 === 0 || len >= 3
      if (strong) midi = nearest(midi, (n) => isChordTone(n, c))
      while (midi > vhi) midi -= 12
      while (midi < vlo) midi += 12
      cur = midi
      events.push({ part: 'lead', time: t0 + at, dur: len / 2 - 0.05, midi, voice, vel: strong ? 0.8 : 0.68 })
    })
  })

  // The final chord, held.
  const endAt = bars.length * BEATS_PER_BAR
  const endChord = parseChord(spec.end)
  const [elo, ehi] = LEAD_RANGE[spec.lead]
  let last = nearest(cur, (n) => pc(n) === endChord.root)
  while (last > ehi) last -= 12
  while (last < elo) last += 12
  events.push({ part: 'lead', time: endAt, dur: 3, midi: last, voice: spec.lead, vel: 0.8 })
  for (const midi of voicing(endChord, 55)) events.push({ part: 'comp', time: endAt, dur: 3, midi, voice: spec.comp === 'pad' ? 'organ' : 'piano', vel: 0.3 })
  events.push(
    { part: 'bass', time: endAt, dur: 3, midi: placeAbove(endChord.root, 36), voice: 'bass', vel: 0.65 },
    { part: 'drums', time: endAt, dur: 0.1, midi: 0, voice: 'kick', vel: 0.5 },
    { part: 'drums', time: endAt, dur: 0.1, midi: 0, voice: spec.drums === 'swing' || spec.drums === 'brush' ? 'ride' : 'snare', vel: 0.5 },
  )

  if (spec.swing) {
    const ratio = spec.bpm > 150 ? 0.6 : 0.65
    for (const e of events) {
      const end = swingTime(e.time + e.dur, ratio)
      e.time = swingTime(e.time, ratio)
      e.dur = end - e.time
    }
  }
  events.sort((a, b) => a.time - b.time)
  return { id: spec.id, bpm: spec.bpm, beats: endAt + BEATS_PER_BAR, events }
}
