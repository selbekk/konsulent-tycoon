// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../store/gameStore'
import { playSound } from './sound'

const created = vi.fn()
class FakeParam {
  value = 0
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  type = 'square'
  connect(n: unknown) { return n }
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  constructor() { created() }
  createGain() { return new FakeNode() }
  createOscillator() { return new FakeNode() }
  resume() { return Promise.resolve() }
}

describe('playSound', () => {
  beforeEach(() => {
    created.mockClear()
    ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  })

  it('stays silent when sound is turned off', () => {
    useGame.getState().setSettings({ sound: false })
    playSound('win')
    expect(created).not.toHaveBeenCalled()
  })

  it('plays through Web Audio when on, and never throws', () => {
    useGame.getState().setSettings({ sound: true, soundVolume: 0.5 })
    expect(() => playSound('fanfare')).not.toThrow()
    expect(created).toHaveBeenCalledTimes(1)
    expect(() => playSound('tick')).not.toThrow()
  })
})
