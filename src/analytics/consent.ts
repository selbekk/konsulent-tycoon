import { useSyncExternalStore } from 'react'

/** `null` until the player has answered the cookie bar. */
export type Consent = 'granted' | 'denied' | null

const CONSENT_KEY = 'kt.consent'
const listeners = new Set<() => void>()

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function writeConsent(consent: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, consent)
  } catch {
    /* no storage: the answer lasts for this visit only */
  }
  current = consent
  listeners.forEach((l) => l())
}

let current: Consent = typeof window === 'undefined' ? null : readConsent()

export function useConsent(): Consent {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => null,
  )
}

export const consentGranted = () => current === 'granted'
