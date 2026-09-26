/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { engineVersion } from './scripts/engineVersion.ts'

/** Same as the rewrites in vercel.json: PostHog behind our own path, for `dev` and `preview`. */
const posthogProxy = {
  '/kaffe/static': {
    target: 'https://eu-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/kaffe/, ''),
  },
  '/kaffe/array': {
    target: 'https://eu-assets.i.posthog.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/kaffe/, ''),
  },
  '/kaffe': {
    target: 'https://eu.i.posthog.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/kaffe/, ''),
  },
}

/**
 * Preload the fonts the loading splash and main menu show first (logo, headings, body text), so they are there
 * for the first paint instead of swapping in afterwards. Build only: the file names carry a content hash.
 */
function preloadFirstFonts(): Plugin {
  const first =
    /^assets\/(press-start-2p-latin-400-normal|bungee-latin-400-normal|ibm-plex-sans-latin-400-normal)-[\w-]+\.woff2$/
  return {
    name: 'preload-first-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, ctx) =>
        Object.keys(ctx.bundle ?? {})
          .filter((file) => first.test(file))
          .map((file) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          })),
    },
  }
}

export default defineConfig({
  // Which rules this build plays by; the leaderboard only replays games from the same version.
  define: { __ENGINE_VERSION__: JSON.stringify(engineVersion()) },
  server: { proxy: posthogProxy },
  preview: { proxy: posthogProxy },
  plugins: [
    react(),
    preloadFirstFonts(),
    VitePWA({
      // Ask before updating: a reload in the middle of a minigame would cost the attempt.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Konsulent Tycoon',
        short_name: 'Tycoon',
        description: 'Bygg ditt eget IT-konsulentselskap. Et turbasert, litt retro strategispill.',
        lang: 'nb',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#14122b',
        theme_color: '#14122b',
        categories: ['games', 'strategy'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything is local (fonts included), so the whole game works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Only link previews fetch the share image; it has no business in every player's offline cache.
        globIgnores: ['og-image.png'],
        navigateFallback: '/index.html',
        // Analytics goes to PostHog through this path, and the crawler files are plain text:
        // never answer them with the app shell.
        navigateFallbackDenylist: [/^\/kaffe\//, /^\/(robots\.txt|sitemap\.xml|llms\.txt|og-image\.png)$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely: keep them in their own chunk so game updates stay small.
        // PostHog and Firebase stay out of it: they're only loaded once the player opts in.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules\/(?!posthog-js|@posthog|firebase|@firebase)/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    // Some tests play whole 40-quarter games; CI runners are a lot slower than a laptop.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
