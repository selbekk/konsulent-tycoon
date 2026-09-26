// Runs before the first paint, so the loading splash already has the player's theme, motion setting and
// language. React sets the same attributes again on mount (App.tsx, i18n/index.ts); keep the keys in step
// with SETTINGS_KEY in store/gameStore.ts and LOCALE_KEY in i18n/index.ts.
// A plain file rather than an inline script so it passes the CSP (script-src 'self').
;(function () {
  var root = document.documentElement
  try {
    var settings = JSON.parse(localStorage.getItem('kt.settings') || '{}') || {}
    if (settings.theme === 'light' || settings.theme === 'dark') root.dataset.theme = settings.theme
    if (settings.reducedMotion) root.dataset.motion = 'reduced'
  } catch {
    /* no storage, or a broken value: the defaults are fine */
  }
  try {
    if (localStorage.getItem('kt.locale') === 'en') root.lang = 'en'
  } catch {
    /* no storage */
  }
})()
