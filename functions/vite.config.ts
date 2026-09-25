import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { engineVersion } from '../scripts/engineVersion.ts'

/**
 * Bundles the Cloud Functions with the game engine inlined, so the server replays games with exactly the
 * code the app ships. Firebase's own packages stay external and are installed from functions/package.json.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: { __ENGINE_VERSION__: JSON.stringify(engineVersion()) },
  build: {
    ssr: 'src/index.ts',
    outDir: 'lib',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rolldownOptions: {
      external: [/^firebase-admin/, /^firebase-functions/],
      output: { format: 'es', entryFileNames: 'index.js' },
    },
  },
})
