import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates PWA icons from public/icon.svg: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Pixel art: keep hard edges when scaling.
    png: { compressionLevel: 9, quality: 100 },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.1,
      resizeOptions: { background: '#14122b', kernel: 'nearest' },
    },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#14122b', kernel: 'nearest' } },
    transparent: { ...minimal2023Preset.transparent, padding: 0, resizeOptions: { kernel: 'nearest' } },
  },
  images: ['public/icon.svg'],
})
