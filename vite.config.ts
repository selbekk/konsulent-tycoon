/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Same as the rewrites in vercel.json: PostHog behind our own path, for `dev` and `preview`. */
const posthogProxy = {
  '/kaffe/static': { target: 'https://eu-assets.i.posthog.com', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/kaffe/, '') },
  '/kaffe/array': { target: 'https://eu-assets.i.posthog.com', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/kaffe/, '') },
  '/kaffe': { target: 'https://eu.i.posthog.com', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/kaffe/, '') },
}

export default defineConfig({
  server: { proxy: posthogProxy },
  preview: { proxy: posthogProxy },
  plugins: [
    react(),
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
        navigateFallback: '/index.html',
        // Analytics goes to PostHog through this path; never answer it with the app shell.
        navigateFallbackDenylist: [/^\/kaffe\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely: keep them in their own chunk so game updates stay small.
        // PostHog stays out of it: it's only loaded once the player accepts analytics.
        codeSplitting: { groups: [{ name: 'vendor', test: /node_modules\/(?!posthog-js|@posthog)/ }] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
