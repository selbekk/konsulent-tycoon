import { create } from 'zustand'
import { track, trackSettled } from '../analytics'
import { describeAction, gameContext, quarterSummary, settleKey } from '../analytics/gameEvents'
import {
  applyAction,
  createNewGame,
  deleteSlot,
  endTitle,
  firmLevel,
  endTurn as engineEndTurn,
  playerRank,
  purgeIncompatibleSaves,
  quarterTodos,
  readSlot,
  saveToSlot,
  valuation,
} from '../engine'
import type { Action, Crisis, GameState, MinigameKind, NewGameOptions, SlotId } from '../engine'

export type Screen = 'menu' | 'newGame' | 'load' | 'settings' | 'about' | 'game'
export type Tab = 'dashboard' | 'staff' | 'culture' | 'tenders' | 'contracts' | 'strategy' | 'market' | 'backroom'
export const TABS: Tab[] = ['dashboard', 'staff', 'culture', 'tenders', 'contracts', 'strategy', 'market', 'backroom']

export interface Settings {
  theme: 'dark' | 'light'
  reducedMotion: boolean
  doubleTime: boolean
  announcements: boolean
  sound: boolean
  /** 0–1 */
  soundVolume: number
}

const SETTINGS_KEY = 'kt.settings'
const defaultSettings: Settings = {
  theme: 'dark',
  reducedMotion: false,
  doubleTime: false,
  announcements: true,
  sound: true,
  soundVolume: 0.6,
}

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
  /** Levels the player just moved between; shown as a celebration once the report is closed. */
  levelUp: { from: number; to: number } | null
  /** Crisis shown in the crisis dialog. */
  crisisId: string | null
  /** Crisis talk (minigame) being played for a crisis choice. */
  crisisTalk: { crisisId: string; choiceId: string } | null
  /** Crisis stages already shown once (`id:stage:quarter`), so each new stage pops up by itself only once. UI state only. */
  seenCrises: string[]
  /** The intro guide, shown once when a new game starts. UI state only, never saved. */
  onboarding: boolean
  settings: Settings
  /** Saves deleted because this version of the game can't read them; the main menu explains. */
  droppedSaves: SlotId[]

  go: (screen: Screen) => void
  setTab: (tab: Tab) => void
  /** `meta` only describes the choices for analytics. */
  newGame: (opts: NewGameOptions, meta?: { customSeed: boolean; defaultName: boolean }) => void
  dispatch: (action: Action) => string | undefined
  endTurn: () => void
  save: (slot: SlotId) => boolean
  load: (slot: SlotId) => boolean
  loadState: (state: GameState) => void
  quit: () => void
  clearError: () => void
  dismissReport: () => void
  dismissLevelUp: () => void
  dismissOnboarding: () => void
  dismissDroppedSaves: () => void
  openBid: (tenderId: string | null) => void
  openMinigame: (m: { tenderId: string; kind: MinigameKind } | null) => void
  openCrisis: (crisisId: string | null) => void
  openCrisisTalk: (talk: { crisisId: string; choiceId: string } | null) => void
  setSettings: (s: Partial<Settings>) => void
}

const noCrisis = { crisisId: null, crisisTalk: null, seenCrises: [] }

/** Identifies one stage of one crisis, for "has the player seen this yet". */
export const crisisSeenKey = (c: Pick<Crisis, 'id' | 'stage' | 'stageQuarter'>) => `${c.id}:${c.stage}:${c.stageQuarter}`

export const useGame = create<Store>((set, get) => ({
  game: null,
  screen: 'menu',
  previousScreen: 'menu',
  tab: 'dashboard',
  error: null,
  report: null,
  bidTenderId: null,
  minigame: null,
  levelUp: null,
  crisisId: null,
  crisisTalk: null,
  seenCrises: [],
  onboarding: false,
  settings: typeof window === 'undefined' ? defaultSettings : loadSettings(),
  droppedSaves: (() => {
    const storage = safeStorage()
    return storage ? purgeIncompatibleSaves(storage) : []
  })(),

  go: (screen) => {
    if (screen !== get().screen) track('screen_viewed', { screen, from: get().screen })
    set({ screen, previousScreen: get().screen })
  },
  setTab: (tab) => {
    const { game } = get()
    if (tab !== get().tab) track('tab_viewed', { tab, ...(game ? gameContext(game) : {}) })
    set({ tab })
  },

  newGame: (opts, meta) => {
    const game = createNewGame(opts)
    const storage = safeStorage()
    if (storage) saveToSlot(storage, 'auto', game)
    set({ game, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: true, ...noCrisis })
    track('game_started', {
      difficulty: opts.difficulty,
      founders: [...opts.founderDisciplines],
      custom_seed: meta?.customSeed,
      default_name: meta?.defaultName,
    })
  },

  dispatch: (action) => {
    const { game } = get()
    if (!game) return 'errors.invalid'
    const result = applyAction(game, action)
    const { event, props } = describeAction(action, game)
    if (result.error) {
      track('action_failed', { ...props, failed_event: event, error: result.error })
      set({ error: result.error })
      return result.error
    }
    const settle = settleKey(action)
    if (settle) trackSettled(settle, event, props)
    else track(event, props)
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
    const from = firmLevel(game.firms[game.playerId])
    const to = firmLevel(next.firms[next.playerId])
    const levelUp = to > from ? { from, to } : null
    const openTodos = quarterTodos(game, game.playerId).filter((x) => !x.done).length
    track('quarter_ended', quarterSummary(game, next, openTodos))
    if (levelUp) track('level_up', { from, to, quarter: game.quarter })
    if (next.status !== 'playing') {
      const me = next.firms[next.playerId]
      track('game_ended', {
        ...gameContext(next),
        outcome: next.status,
        title: endTitle(next),
        rank: playerRank(next),
        valuation: Math.round(valuation(me)),
        quarters_played: game.quarter + 1,
      })
    }
    set({ game: next, report: game.quarter, bidTenderId: null, minigame: null, error: null, levelUp, crisisId: null, crisisTalk: null })
  },

  save: (slot) => {
    const { game } = get()
    const storage = safeStorage()
    const ok = !!game && !!storage && saveToSlot(storage, slot, game)
    if (game) track('game_saved', { slot, ok, ...gameContext(game) })
    return ok
  },

  load: (slot) => {
    const storage = safeStorage()
    if (!storage) return false
    const read = readSlot(storage, slot)
    if ('error' in read) {
      track('game_load_failed', { slot, error: read.error })
      if (read.error === 'incompatible') {
        deleteSlot(storage, slot)
        set({ droppedSaves: [slot] })
      }
      return false
    }
    const from = get().screen
    get().loadState(read.state)
    track(slot === 'auto' && from === 'menu' ? 'game_continued' : 'game_loaded', { slot, ...gameContext(read.state) })
    return true
  },

  loadState: (game) =>
    set({ game, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: false, ...noCrisis }),

  quit: () => {
    const { game } = get()
    if (game && game.status === 'playing') track('game_quit', gameContext(game))
    set({ game: null, screen: 'menu', report: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: false, ...noCrisis })
  },
  clearError: () => set({ error: null }),
  dismissReport: () => set({ report: null }),
  dismissLevelUp: () => set({ levelUp: null }),
  dismissOnboarding: () => {
    track('onboarding_closed')
    set({ onboarding: false })
  },
  dismissDroppedSaves: () => set({ droppedSaves: [] }),
  openBid: (bidTenderId) => {
    const { game } = get()
    const tender = bidTenderId ? game?.tenders.find((t) => t.id === bidTenderId) : undefined
    if (game && tender) track('bid_form_opened', { customer: tender.customerId, tender_kind: tender.kind, ...gameContext(game) })
    set({ bidTenderId, error: null })
  },
  openMinigame: (minigame) => set({ minigame }),
  openCrisis: (crisisId) => {
    const c = crisisId ? get().game?.crises?.find((x) => x.id === crisisId) : undefined
    const seen = c ? crisisSeenKey(c) : undefined
    if (c) track('crisis_viewed', { crisis: c.defId, stage: c.stage, first_time: !!seen && !get().seenCrises.includes(seen) })
    set({ crisisId, error: null, ...(seen && !get().seenCrises.includes(seen) ? { seenCrises: [...get().seenCrises, seen] } : {}) })
  },
  openCrisisTalk: (crisisTalk) => set({ crisisTalk }),

  setSettings: (s) => {
    const settings = { ...get().settings, ...s }
    trackSettled(`settings:${Object.keys(s).sort().join(',')}`, 'settings_changed', { ...s }, 800)
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
