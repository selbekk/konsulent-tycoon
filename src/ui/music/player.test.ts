// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const created = vi.fn()
const started = vi.fn()
class FakeParam {
  value = 0
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode {
  gain = new FakeParam()
  frequency = new FakeParam()
  type = ''
  buffer: unknown = null
  connect(n: unknown) {
    return n
  }
  disconnect() {}
  start() {
    started()
  }
  stop() {}
}
class FakeAudioContext {
  state = 'running'
  currentTime = 0
  sampleRate = 100
  destination = {}
  constructor() {
    created()
  }
  createGain() {
    return new FakeNode()
  }
  createOscillator() {
    return new FakeNode()
  }
  createBiquadFilter() {
    return new FakeNode()
  }
  createDynamicsCompressor() {
    return new FakeNode()
  }
  createBufferSource() {
    return new FakeNode()
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(100) }
  }
  resume() {
    return Promise.resolve()
  }
  suspend() {
    return Promise.resolve()
  }
}

describe('music player', () => {
  let cleanup: (() => void) | undefined
  beforeEach(() => {
    vi.resetModules()
    created.mockClear()
    started.mockClear()
    ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  })
  afterEach(() => cleanup?.())

  it('waits for a user gesture before making a sound', async () => {
    const { useGame } = await import('../../store/gameStore')
    useGame.getState().setSettings({ music: true, musicVolume: 0.5 })
    const { installMusic } = await import('./player')
    cleanup = installMusic()
    expect(created).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pointerup'))
    expect(created).toHaveBeenCalledTimes(1)
    expect(started).toHaveBeenCalled()
  })

  it('stays silent when music is off, and starts when it is turned on', async () => {
    const { useGame } = await import('../../store/gameStore')
    useGame.getState().setSettings({ music: false })
    const { installMusic, getNowPlaying } = await import('./player')
    cleanup = installMusic()
    window.dispatchEvent(new Event('pointerup'))
    expect(started).not.toHaveBeenCalled()
    expect(getNowPlaying()).toBeNull()
    useGame.getState().setSettings({ music: true, musicVolume: 0.5 })
    expect(started).toHaveBeenCalled()
    expect(getNowPlaying()).not.toBeNull()
    useGame.getState().setSettings({ music: false })
    expect(getNowPlaying()).toBeNull()
  })
})
