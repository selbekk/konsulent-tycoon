import { describe, expect, it } from 'vitest'
import { resumeAudio, suspendAudio } from './audio'

const failing = {
  resume: () => Promise.reject(new DOMException('Failed to start the audio device', 'InvalidStateError')),
  suspend: () => Promise.reject(new DOMException('Failed to suspend', 'InvalidStateError')),
} as unknown as AudioContext

describe('resumeAudio / suspendAudio', () => {
  it('swallow the rejection iOS gives when the audio device is unavailable', async () => {
    await expect(resumeAudio(failing)).resolves.toBeUndefined()
    await expect(suspendAudio(failing)).resolves.toBeUndefined()
  })
})
