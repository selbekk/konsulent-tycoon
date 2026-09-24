import { useGame } from '../store/gameStore'
import { audioContext } from './audio'

/**
 * Tiny 8-bit sound effects synthesised with Web Audio – no files, no licences.
 * The AudioContext is created lazily on first play (browsers require a user gesture first),
 * and every call is a no-op where Web Audio is unavailable (tests, old browsers).
 */
export type SoundName =
  | 'win'
  | 'lose'
  | 'cash'
  | 'dingdong'
  | 'alert'
  | 'tick'
  | 'blip'
  | 'good'
  | 'bad'
  | 'confirm'
  | 'sneaky'
  | 'scandal'
  | 'fanfare'
  | 'sad'
  | 'siren'

type Wave = OscillatorType
interface Note {
  /** Hz, or [from, to] for a slide. */
  f: number | [number, number]
  /** Start offset in seconds. */
  at: number
  dur: number
  wave?: Wave
  vol?: number
}

// Note frequencies (equal temperament) used below.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5
const C4 = 261.63, E4 = 329.63, G4 = 392, A4 = 440, B3 = 246.94, F4 = 349.23

const SOUNDS: Record<SoundName, Note[]> = {
  win: [
    { f: C5, at: 0, dur: 0.09 },
    { f: E5, at: 0.09, dur: 0.09 },
    { f: G5, at: 0.18, dur: 0.09 },
    { f: C6, at: 0.27, dur: 0.25 },
  ],
  lose: [
    { f: G4, at: 0, dur: 0.12, wave: 'triangle' },
    { f: E4, at: 0.12, dur: 0.25, wave: 'triangle' },
  ],
  cash: [
    { f: 1318.5, at: 0, dur: 0.06 },
    { f: 1975.5, at: 0.06, dur: 0.18 },
  ],
  dingdong: [
    { f: A5, at: 0, dur: 0.35, wave: 'sine', vol: 0.9 },
    { f: F4 * 2, at: 0.3, dur: 0.5, wave: 'sine', vol: 0.9 },
  ],
  alert: [
    { f: A5, at: 0, dur: 0.07 },
    { f: A5, at: 0.11, dur: 0.07 },
  ],
  tick: [{ f: 1800, at: 0, dur: 0.025, wave: 'square', vol: 0.4 }],
  blip: [{ f: [600, 900], at: 0, dur: 0.05, vol: 0.5 }],
  good: [
    { f: E5, at: 0, dur: 0.07 },
    { f: A5, at: 0.07, dur: 0.12 },
  ],
  bad: [{ f: [220, 140], at: 0, dur: 0.22, wave: 'sawtooth', vol: 0.5 }],
  confirm: [
    { f: G5, at: 0, dur: 0.05 },
    { f: C6, at: 0.05, dur: 0.1 },
  ],
  sneaky: [
    { f: E4, at: 0, dur: 0.1, wave: 'triangle' },
    { f: G4, at: 0.14, dur: 0.1, wave: 'triangle' },
    { f: B3 * 2, at: 0.28, dur: 0.18, wave: 'triangle' },
  ],
  scandal: [
    { f: A4, at: 0, dur: 0.18, wave: 'sawtooth', vol: 0.6 },
    { f: F4, at: 0.18, dur: 0.18, wave: 'sawtooth', vol: 0.6 },
    { f: [D5 / 2, B3], at: 0.36, dur: 0.45, wave: 'sawtooth', vol: 0.6 },
  ],
  fanfare: [
    { f: G4, at: 0, dur: 0.12 },
    { f: C5, at: 0.12, dur: 0.12 },
    { f: E5, at: 0.24, dur: 0.12 },
    { f: G5, at: 0.36, dur: 0.2 },
    { f: E5, at: 0.58, dur: 0.1 },
    { f: G5, at: 0.68, dur: 0.1 },
    { f: C6, at: 0.8, dur: 0.45 },
  ],
  // A two-tone siren, short enough not to be annoying.
  siren: [
    { f: [660, 880], at: 0, dur: 0.22, wave: 'square', vol: 0.35 },
    { f: [880, 660], at: 0.22, dur: 0.22, wave: 'square', vol: 0.35 },
    { f: [660, 880], at: 0.44, dur: 0.22, wave: 'square', vol: 0.35 },
  ],
  sad: [
    { f: G4, at: 0, dur: 0.3, wave: 'triangle' },
    { f: F4, at: 0.3, dur: 0.3, wave: 'triangle' },
    { f: E4, at: 0.6, dur: 0.3, wave: 'triangle' },
    { f: [C4, 180], at: 0.9, dur: 0.8, wave: 'triangle' },
  ],
}

const lastPlayed: Partial<Record<SoundName, number>> = {}

export function playSound(name: SoundName) {
  const { sound, soundVolume } = useGame.getState().settings
  if (!sound || soundVolume <= 0) return
  // The same sound twice within 80 ms is a double effect (e.g. React StrictMode), not intent.
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (nowMs - (lastPlayed[name] ?? -Infinity) < 80) return
  lastPlayed[name] = nowMs
  const ac = audioContext()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()
  const master = ac.createGain()
  master.gain.value = soundVolume * 0.18
  master.connect(ac.destination)
  const t0 = ac.currentTime + 0.01
  for (const n of SOUNDS[name]) {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    osc.type = n.wave ?? 'square'
    const start = t0 + n.at
    const end = start + n.dur
    if (Array.isArray(n.f)) {
      osc.frequency.setValueAtTime(n.f[0], start)
      osc.frequency.exponentialRampToValueAtTime(n.f[1], end)
    } else {
      osc.frequency.setValueAtTime(n.f, start)
    }
    // Short attack and release so notes don't click.
    const vol = n.vol ?? 1
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(vol, start + 0.005)
    env.gain.setValueAtTime(vol, Math.max(start + 0.005, end - 0.03))
    env.gain.linearRampToValueAtTime(0, end)
    osc.connect(env).connect(master)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}
