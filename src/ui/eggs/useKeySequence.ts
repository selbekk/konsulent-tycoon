import { useEffect, useRef } from 'react'
import { useGame } from '../../store/gameStore'

/** Printable keys lower-cased, the rest by name ('ArrowUp'). */
function normalize(key: string) {
  return key.length === 1 ? key.toLowerCase() : key
}

/**
 * Calls `onMatch` when the player types `sequence` (a word, or a list of key names like the Konami code).
 * Ignores typing in text fields, keys held with modifiers or auto-repeat, and anything while a dialog is open,
 * so a secret never fires by accident mid-game. Off with the keyboard shortcuts setting.
 */
export function useKeySequence(sequence: string | readonly string[], onMatch: () => void, enabled = true) {
  const callback = useRef(onMatch)
  useEffect(() => {
    callback.current = onMatch
  })
  const shortcuts = useGame((x) => x.settings.shortcuts)
  const keys = (typeof sequence === 'string' ? [...sequence] : sequence).map(normalize).join('\u0000')
  useEffect(() => {
    if (!enabled || !shortcuts) return
    const target = keys.split('\u0000')
    let typed: string[] = []
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
      if (document.querySelector('[aria-modal="true"]')) return
      typed = [...typed, normalize(e.key)].slice(-target.length)
      if (typed.length === target.length && typed.every((k, i) => k === target[i])) {
        typed = []
        callback.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keys, enabled, shortcuts])
}
