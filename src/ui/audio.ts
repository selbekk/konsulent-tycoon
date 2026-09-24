/**
 * The one AudioContext shared by sound effects and music. Created lazily, because browsers
 * only let it make noise after a user gesture, and null where Web Audio is unavailable.
 */
let ctx: AudioContext | null = null

export function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    ctx = null
  }
  return ctx
}
