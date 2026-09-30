/**
 * The one AudioContext shared by sound effects and music. Created lazily, because browsers
 * only let it make noise after a user gesture, and null where Web Audio is unavailable.
 */
let ctx: AudioContext | null = null

export function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}

/**
 * Resumes the context without an unhandled rejection. iOS rejects with "Failed to start the
 * audio device" when it can't have the audio session right now (backgrounded, a phone call);
 * we stay silent and try again on the next sound or gesture.
 */
export function resumeAudio(ac: AudioContext): Promise<void> {
  return ac.resume().catch(() => {})
}

/** Suspends the context without an unhandled rejection. */
export function suspendAudio(ac: AudioContext): Promise<void> {
  return ac.suspend().catch(() => {})
}
