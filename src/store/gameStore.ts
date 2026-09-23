import { create } from 'zustand'
import { applyAction, createNewGame, endTurn as engineEndTurn, loadFromSlot, saveToSlot } from '../engine'
import type { Action, GameState, MinigameKind, NewGameOptions, SlotId } from '../engine'

export type Screen = 'menu' | 'newGame' | 'load' | 'settings' | 'game'
export type Tab = 'dashboard' | 'staff' | 'culture' | 'tenders' | 'contracts' | 'market' | 'backroom'
export const TABS: Tab[] = ['dashboard', 'staff', 'culture', 'tenders', 'contracts', 'market', 'backroom']

export interface Settings {
  theme: 'dark' | 'light'
  reducedMotion: boolean
  doubleTime: boolean
  announcements: boolean
}

const SETTINGS_KEY = 'kt.settings'
const defaultSettings: Settings = { theme: 'dark', reducedMotion: false, doubleTime: false, announcements: true }

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

interface Store {
  game: GameState | null
  screen: Screen
  previousScreen: Screen
  tab: Tab
  error: string | null
  /** Quarter that just ended – shows the quarter report. */
  report: number | null
  bidTenderId: string | null
  minigame: { tenderId: string; kind: MinigameKind } | null
  settings: Settings

  go: (screen: Screen) => void
  setTab: (tab: Tab) => void
  newGame: (opts: NewGameOptions) => void
  dispatch: (action: Action) => string | undefined
  endTurn: () => void
  save: (slot: SlotId) => boolean
  load: (slot: SlotId) => boolean
  loadState: (state: GameState) => void
  quit: () => void
  clearError: () => void
  dismissReport: () => void
  openBid: (tenderId: string | null) => void
  openMinigame: (m: { tenderId: string; kind: MinigameKind } | null) => void
  setSettings: (s: Partial<Settings>) => void
}

export const useGame = create<Store>((set, get) => ({
  game: null,
  screen: 'menu',
  previousScreen: 'menu',
  tab: 'dashboard',
  error: null,
  report: null,
  bidTenderId: null,
  minigame: null,
  settings: typeof window === 'undefined' ? defaultSettings : loadSettings(),

  go: (screen) => set({ screen, previousScreen: get().screen }),
  setTab: (tab) => set({ tab }),

  newGame: (opts) => {
    const game = createNewGame(opts)
    const storage = safeStorage()
    if (storage) saveToSlot(storage, 'auto', game)
    set({ game, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null })
  },

  dispatch: (action) => {
    const { game } = get()
    if (!game) return 'errors.invalid'
    const result = applyAction(game, action)
    if (result.error) {
      set({ error: result.error })
      return result.error
    }
    // Autosave after every action: closing the tab never loses bids, and minigames can't be replayed by reloading.
    const storage = safeStorage()
    if (storage) saveToSlot(storage, 'auto', result.state)
    set({ game: result.state, error: null })
    return undefined
  },

  endTurn: () => {
    const { game } = get()
    if (!game || game.status !== 'playing') return
    const next = engineEndTurn(game)
    const storage = safeStorage()
    if (storage) saveToSlot(storage, 'auto', next)
    set({ game: next, report: game.quarter, bidTenderId: null, minigame: null, error: null })
  },

  save: (slot) => {
    const { game } = get()
    const storage = safeStorage()
    return !!game && !!storage && saveToSlot(storage, slot, game)
  },

  load: (slot) => {
    const storage = safeStorage()
    const game = storage ? loadFromSlot(storage, slot) : null
    if (!game) return false
    get().loadState(game)
    return true
  },

  loadState: (game) => set({ game, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null }),

  quit: () => set({ game: null, screen: 'menu', report: null, bidTenderId: null, minigame: null }),
  clearError: () => set({ error: null }),
  dismissReport: () => set({ report: null }),
  openBid: (bidTenderId) => set({ bidTenderId, error: null }),
  openMinigame: (minigame) => set({ minigame }),

  setSettings: (s) => {
    const settings = { ...get().settings, ...s }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
    set({ settings })
  },
}))

/** Convenience selector – only use inside the game screen. */
export const usePlayer = () => useGame((s) => (s.game ? s.game.firms[s.game.playerId] : null))
