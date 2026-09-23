import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enContent from './locales/en/content.json'
import enGame from './locales/en/game.json'
import enMinigames from './locales/en/minigames.json'
import enUi from './locales/en/ui.json'
import nbContent from './locales/nb/content.json'
import nbGame from './locales/nb/game.json'
import nbMinigames from './locales/nb/minigames.json'
import nbUi from './locales/nb/ui.json'

export const LOCALES = ['nb', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const NAMESPACES = ['ui', 'game', 'content', 'minigames'] as const

export const resources = {
  nb: { ui: nbUi, game: nbGame, content: nbContent, minigames: nbMinigames },
  en: { ui: enUi, game: enGame, content: enContent, minigames: enMinigames },
}

const LOCALE_KEY = 'kt.locale'

export function storedLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY)
    if (v === 'nb' || v === 'en') return v
  } catch {
    /* no storage */
  }
  return 'nb'
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = locale
  void i18n.changeLanguage(locale)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: typeof window === 'undefined' ? 'nb' : storedLocale(),
  fallbackLng: 'nb',
  ns: [...NAMESPACES],
  defaultNS: 'ui',
  interpolation: { escapeValue: false },
  returnObjects: false,
})

export default i18n
