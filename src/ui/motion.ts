import { useSyncExternalStore } from 'react'
import { useGame } from '../store/gameStore'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const mq = matchMedia(QUERY)
  mq.addEventListener?.('change', onChange)
  return () => mq.removeEventListener?.('change', onChange)
}

const systemPrefersReduced = () => typeof matchMedia === 'function' && matchMedia(QUERY).matches

/** True when the player asked for less motion, in the game's settings or in the operating system. */
export function useReducedMotion(): boolean {
  const setting = useGame((x) => x.settings.reducedMotion)
  const system = useSyncExternalStore(subscribe, systemPrefersReduced, () => false)
  return setting || system
}
