declare const __ENGINE_VERSION__: string | undefined

/**
 * Fingerprint of the engine and content this build plays by (scripts/engineVersion.ts), set by Vite's
 * `define` for the app, the tests and the Cloud Function. 'dev' where nothing sets it (tsx scripts).
 */
export const ENGINE_VERSION: string = typeof __ENGINE_VERSION__ === 'string' ? __ENGINE_VERSION__ : 'dev'
