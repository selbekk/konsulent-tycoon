import { useGame } from '../../store/gameStore'
import { audioContext } from '../audio'
import { isChristmas } from '../eggs/clock'
import { compose, type NoteEvent, type Score, type SongSpec, type Voice } from './compose'
import { HIDDEN_SONGS, SONGS, type HiddenSongId } from './songs'

/**
 * Background music: plays the composed songs back to back in shuffled order with Web Audio.
 * A lookahead scheduler queues notes a little ahead of time; everything runs through one bus
 * gain per song, so stopping is a fade on that gain rather than hunting down oscillators.
 * Starts only after the first user gesture (browsers block audio before that).
 */

/** How far ahead notes are queued (s), and how often the queue is topped up (ms). */
const LOOKAHEAD = 0.3
const TICK_MS = 80
/** Silence between songs (s). */
const GAP = 2
/** Music bus level at full volume. Many voices sum on this bus, so keep it below the effects' 0.18. */
const BUS_LEVEL = 0.16
/** Level per part, so the melody sits on top of the accompaniment. */
const PART_GAIN: Record<NoteEvent['part'], number> = { lead: 1.3, comp: 0.65, bass: 1, drums: 1 }
const FADE = 0.12

interface Tone {
  osc: [OscillatorType, number, number][]
  attack: number
  /** Fraction of the level left at the end of the note (1 = sustained). */
  decayTo: number
  release: number
  gain: number
  /** Lowpass cutoff for the reedy voices. */
  cutoff?: number
}

const TONES: Record<Exclude<Voice, 'kick' | 'snare' | 'hat' | 'ride'>, Tone> = {
  piano: {
    osc: [
      ['triangle', 1, 1],
      ['sine', 2, 0.25],
    ],
    attack: 0.004,
    decayTo: 0.2,
    release: 0.12,
    gain: 0.55,
  },
  epiano: {
    osc: [
      ['sine', 1, 1],
      ['sine', 4, 0.08],
    ],
    attack: 0.004,
    decayTo: 0.3,
    release: 0.2,
    gain: 0.6,
  },
  vibes: {
    osc: [
      ['sine', 1, 1],
      ['sine', 4, 0.12],
    ],
    attack: 0.003,
    decayTo: 0.35,
    release: 0.4,
    gain: 0.7,
  },
  organ: {
    osc: [
      ['sine', 1, 1],
      ['sine', 2, 0.4],
    ],
    attack: 0.03,
    decayTo: 1,
    release: 0.1,
    gain: 0.3,
  },
  bass: { osc: [['triangle', 1, 1]], attack: 0.005, decayTo: 0.45, release: 0.06, gain: 0.9 },
  square: { osc: [['square', 1, 1]], attack: 0.01, decayTo: 0.8, release: 0.06, gain: 0.22, cutoff: 2400 },
  clarinet: { osc: [['square', 1, 1]], attack: 0.025, decayTo: 0.9, release: 0.08, gain: 0.35, cutoff: 1300 },
  flute: {
    osc: [
      ['sine', 1, 1],
      ['triangle', 2, 0.1],
    ],
    attack: 0.05,
    decayTo: 0.85,
    release: 0.1,
    gain: 0.6,
  },
  brass: { osc: [['sawtooth', 1, 1]], attack: 0.035, decayTo: 0.8, release: 0.08, gain: 0.22, cutoff: 1700 },
}

interface Playback {
  score: Score
  bus: GainNode
  /** Context time of beat 0. */
  t0: number
  secPerBeat: number
  cursor: number
}

let current: Playback | null = null
let timer: ReturnType<typeof setInterval> | null = null
let unlocked = false
let out: { ctx: AudioContext; node: AudioNode; noise: AudioBuffer } | null = null
let queue: SongSpec[] = []
let lastSong: SongSpec | null = null
/** A hidden song asked for by an easter egg, played next instead of the queue. */
let requested: SongSpec | null = null
let nowPlaying: string | null = null
const listeners = new Set<() => void>()

const settings = () => useGame.getState().settings
const musicOn = () => settings().music && settings().musicVolume > 0
const level = () => settings().musicVolume * BUS_LEVEL

function setNowPlaying(id: string | null) {
  nowPlaying = id
  listeners.forEach((l) => l())
}

/** For `useSyncExternalStore`: the id of the song playing, or null. */
export const subscribeNowPlaying = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getNowPlaying = () => nowPlaying

function output(ac: AudioContext) {
  if (out?.ctx === ac) return out
  // Soften the top end a little and catch peaks when many notes stack.
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 6500
  const comp = ac.createDynamicsCompressor()
  lp.connect(comp).connect(ac.destination)
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  out = { ctx: ac, node: lp, noise }
  return out
}

/** The next song from a shuffled queue, never the same song twice in a row. December adds a Christmas song. */
function nextSpec(): SongSpec {
  if (requested) {
    const song = requested
    requested = null
    return song
  }
  if (!queue.length) {
    const pool = isChristmas() ? [...SONGS, HIDDEN_SONGS.officePartySleighRide] : SONGS
    queue = [...pool].sort(() => Math.random() - 0.5)
    if (queue[0] === lastSong && queue.length > 1) queue.push(queue.shift()!)
  }
  lastSong = queue.shift()!
  return lastSong
}

function startSong(ac: AudioContext) {
  const score = compose(nextSpec())
  const bus = ac.createGain()
  bus.gain.value = 0
  bus.gain.setTargetAtTime(level(), ac.currentTime, FADE / 3)
  bus.connect(output(ac).node)
  current = { score, bus, t0: ac.currentTime + 0.15, secPerBeat: 60 / score.bpm, cursor: 0 }
  setNowPlaying(score.id)
}

function fadeOut(pb: Playback, ac: AudioContext) {
  pb.bus.gain.cancelScheduledValues(ac.currentTime)
  pb.bus.gain.setTargetAtTime(0, ac.currentTime, FADE / 3)
  setTimeout(() => pb.bus.disconnect(), FADE * 1000 * 5)
}

function tick() {
  const ac = audioContext()
  if (!ac || !current) return
  const pb = current
  const horizon = ac.currentTime + LOOKAHEAD
  const { events } = pb.score
  while (pb.cursor < events.length) {
    const ev = events[pb.cursor]
    const when = pb.t0 + ev.time * pb.secPerBeat
    if (when > horizon) break
    // Notes that are already late (after a stall) are skipped rather than played in a heap.
    if (when >= ac.currentTime - 0.05) play(ac, pb.bus, ev, when, ev.dur * pb.secPerBeat)
    pb.cursor++
  }
  if (pb.cursor >= events.length && ac.currentTime > pb.t0 + pb.score.beats * pb.secPerBeat + GAP) {
    fadeOut(pb, ac)
    startSong(ac)
  }
}

function play(ac: AudioContext, dest: AudioNode, ev: NoteEvent, when: number, dur: number) {
  if (ev.voice === 'kick' || ev.voice === 'snare' || ev.voice === 'hat' || ev.voice === 'ride')
    return drum(ac, dest, ev.voice, ev.vel * PART_GAIN.drums, when)
  const tone = TONES[ev.voice]
  const freq = 440 * 2 ** ((ev.midi - 69) / 12)
  const env = ac.createGain()
  const peak = ev.vel * tone.gain * PART_GAIN[ev.part]
  const end = when + Math.max(dur, tone.attack + 0.02)
  env.gain.setValueAtTime(0.0001, when)
  env.gain.linearRampToValueAtTime(peak, when + tone.attack)
  env.gain.exponentialRampToValueAtTime(Math.max(peak * tone.decayTo, 0.0001), end)
  env.gain.linearRampToValueAtTime(0, end + tone.release)
  let target: AudioNode = dest
  if (tone.cutoff) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = tone.cutoff
    f.connect(dest)
    target = f
  }
  env.connect(target)
  for (const [type, mult, vol] of tone.osc) {
    const osc = ac.createOscillator()
    osc.type = type
    osc.frequency.value = freq * mult
    if (vol === 1) osc.connect(env)
    else {
      const g = ac.createGain()
      g.gain.value = vol
      osc.connect(g).connect(env)
    }
    osc.start(when)
    osc.stop(end + tone.release + 0.02)
  }
}

function drum(ac: AudioContext, dest: AudioNode, voice: 'kick' | 'snare' | 'hat' | 'ride', vel: number, when: number) {
  const env = ac.createGain()
  env.connect(dest)
  if (voice === 'kick') {
    const osc = ac.createOscillator()
    osc.frequency.setValueAtTime(140, when)
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12)
    env.gain.setValueAtTime(vel * 0.9, when)
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.2)
    osc.connect(env)
    osc.start(when)
    osc.stop(when + 0.22)
    return
  }
  const [type, freq, peak, decay] = (
    {
      snare: ['bandpass', 1800, 0.5, 0.14],
      hat: ['highpass', 7000, 0.3, 0.04],
      ride: ['highpass', 5000, 0.16, 0.3],
    } as const
  )[voice]
  const src = ac.createBufferSource()
  src.buffer = output(ac).noise
  const f = ac.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  env.gain.setValueAtTime(vel * peak, when)
  env.gain.exponentialRampToValueAtTime(0.0001, when + decay)
  src.connect(f).connect(env)
  src.start(when)
  src.stop(when + decay + 0.02)
}

function stop() {
  const ac = audioContext()
  if (timer) clearInterval(timer)
  timer = null
  if (current && ac) fadeOut(current, ac)
  current = null
  setNowPlaying(null)
}

/** Starts, stops or re-levels the music to match the settings. Safe to call any number of times. */
function sync() {
  if (!unlocked) return
  if (!musicOn()) return stop()
  const ac = audioContext()
  if (!ac) return
  try {
    if (ac.state === 'suspended' && !document.hidden) void ac.resume()
    if (!current) startSong(ac)
    else current.bus.gain.setTargetAtTime(level(), ac.currentTime, 0.05)
    if (!timer) timer = setInterval(tick, TICK_MS)
    tick()
  } catch {
    // An incomplete Web Audio implementation (old browsers, test fakes): stay silent.
    stop()
  }
}

/** Skips to another song. */
export function nextSong() {
  const ac = audioContext()
  if (!ac || !unlocked || !musicOn()) return
  if (current) fadeOut(current, ac)
  current = null
  sync()
}

/** Skips straight to one of the hidden songs. */
export function playHiddenSong(id: HiddenSongId) {
  requested = HIDDEN_SONGS[id]
  nextSong()
}

/**
 * Wires the music to the page: first gesture unlocks audio, settings changes start/stop it and
 * a hidden tab suspends it. Returns a cleanup function (for a React effect).
 */
export function installMusic(): () => void {
  // Touch only counts as a gesture on pointerup/touchend, not pointerdown, so listen broadly and
  // keep listening until the context is actually running. Remember the gesture even with music
  // off, so turning it on later starts right away.
  const gestures = ['pointerup', 'touchend', 'keydown'] as const
  const unlock = () => {
    unlocked = true
    const ac = audioContext()
    if (!ac) return removeGestures()
    if (ac.state === 'suspended')
      void ac.resume().then(
        () => ac.state === 'running' && removeGestures(),
        () => {},
      )
    else removeGestures()
    sync()
  }
  const removeGestures = () => gestures.forEach((g) => window.removeEventListener(g, unlock))
  const onVisibility = () => {
    const ac = audioContext()
    if (!ac || !unlocked) return
    if (document.hidden) void ac.suspend()
    else void ac.resume()
  }
  const unsubscribe = useGame.subscribe((s, prev) => {
    if (s.settings.music !== prev.settings.music || s.settings.musicVolume !== prev.settings.musicVolume) sync()
  })
  gestures.forEach((g) => window.addEventListener(g, unlock))
  document.addEventListener('visibilitychange', onVisibility)
  sync()
  return () => {
    removeGestures()
    document.removeEventListener('visibilitychange', onVisibility)
    unsubscribe()
    stop()
  }
}
