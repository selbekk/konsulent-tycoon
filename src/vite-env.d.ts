/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  /** PostHog project token. Optional: without it, analytics is off. */
  readonly VITE_POSTHOG_KEY?: string
  /** Where events are sent. Defaults to our own proxy path. */
  readonly VITE_POSTHOG_HOST?: string
}
