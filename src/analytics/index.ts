import type { PostHog } from 'posthog-js'
import { storedLocale } from '../i18n'
import { consentGranted, readConsent, writeConsent } from './consent'

/**
 * Product analytics (PostHog), strictly opt-in.
 *
 * Nothing is loaded, stored or sent until the player accepts in the cookie bar. The SDK is a lazy chunk,
 * so players who say no never download it. It's precached by the service worker like everything else,
 * and while offline the SDK keeps events in memory and retries once the network is back.
 *
 * Only the UI and the store call this. The engine never does, so the simulator stays pure.
 */

type Props = Record<string, string | number | boolean | null | undefined | string[]>

const KEY = import.meta.env.VITE_POSTHOG_KEY
/** Our own path, proxied to PostHog EU by vercel.json (and vite.config.ts in dev), so ad blockers leave it alone. */
const HOST = import.meta.env.VITE_POSTHOG_HOST || '/kaffe'

let posthog: PostHog | null = null
let loading: Promise<void> | null = null
/** Events tracked while the SDK chunk is still loading. */
let queue: [string, Props | undefined][] = []
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function superProps(): Props {
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  return { app_env: import.meta.env.MODE, installed_app: !!standalone, language: storedLocale() }
}

function start() {
  if (loading) return loading
  if (!KEY) {
    loading = Promise.resolve()
    if (import.meta.env.DEV) {
      // Loud, but outside the caller: a click or an action must still work without the key.
      setTimeout(() => {
        throw new Error(
          'VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured',
        )
      })
    }
    return loading
  }
  loading = import('posthog-js')
    .then(({ default: ph }) => {
      ph.init(KEY, {
        api_host: HOST,
        ui_host: 'https://eu.posthog.com',
        defaults: '2026-08-30',
        persistence: 'localStorage',
        person_profiles: 'always',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        // Clicked elements' text and labels can include the firm name the player typed; keep only which element it was.
        mask_all_text: true,
        mask_all_element_attributes: true,
        capture_exceptions: true,
        // Not used, and each would be one more request that fails offline.
        disable_surveys: true,
        disable_session_recording: true,
        advanced_disable_flags: true,
      })
      if (ph.has_opted_out_capturing()) ph.opt_in_capturing()
      ph.register(superProps())
      posthog = ph
      for (const [event, props] of queue) ph.capture(event, props)
      queue = []
    })
    .catch(() => {
      // Offline on first visit, or blocked: try again next time the page loads.
      loading = null
      queue = []
    })
  return loading
}

/** Call once at startup: starts PostHog only if the player said yes on an earlier visit. */
export function initAnalytics() {
  if (readConsent() === 'granted') void start()
}

export function track(event: string, props?: Props) {
  if (!consentGranted() || !KEY) return
  if (posthog) posthog.capture(event, props)
  else {
    queue.push([event, props])
    void start()
  }
}

/** For controls that fire on every step (sliders): only the value the player settles on is sent. */
export function trackSettled(key: string, event: string, props: Props, ms = 1500) {
  if (!consentGranted()) return
  clearTimeout(timers.get(key))
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      track(event, props)
    }, ms),
  )
}

/** Properties sent with every later event, e.g. the language. */
export function setAnalyticsContext(props: Props) {
  if (consentGranted()) posthog?.register(props)
}

export function grantConsent() {
  writeConsent('granted')
  // Said no earlier in this visit: the SDK is still loaded, just switched off.
  if (posthog) {
    posthog.set_config({ disable_persistence: false })
    posthog.opt_in_capturing()
  }
  track('analytics_consent_given')
}

/** Stops tracking and removes everything PostHog stored on this device. */
export function denyConsent() {
  const wasGranted = consentGranted()
  if (wasGranted) posthog?.capture('analytics_consent_withdrawn')
  writeConsent('denied')
  queue = []
  timers.forEach(clearTimeout)
  timers.clear()
  if (posthog) {
    posthog.reset()
    // Also stops the SDK's own capture (clicks, errors, page leave), not just our track() calls.
    posthog.opt_out_capturing()
    posthog.set_config({ disable_persistence: true })
  }
  try {
    // The random id and session live under ph_*. PostHog's own opt-out flag (__ph_opt_in_out_*) stays: it isn't an id.
    for (const k of Object.keys(localStorage)) if (k.startsWith('ph_')) localStorage.removeItem(k)
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('ph_')) sessionStorage.removeItem(k)
  } catch {
    /* no storage, nothing stored */
  }
}
