import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled (latin subset) so the installed app works offline.
import '@fontsource/bungee/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-400-italic.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/press-start-2p/latin-400.css'
import { initAnalytics } from './analytics'
import './i18n'
import { listenForInstallPrompt } from './ui/pwa/install'
import './ui/theme/global.css'
import './ui/theme/splash.css'
import App from './App.tsx'

listenForInstallPrompt()
initAnalytics()

const root = document.getElementById('root')!
// Fade the game in over the splash it replaces, once. Later screen changes stay instant.
root.classList.add('entering')
root.addEventListener('animationend', function done(e) {
  if (e.animationName !== 'root-enter') return
  root.classList.remove('entering')
  root.removeEventListener('animationend', done)
})

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
