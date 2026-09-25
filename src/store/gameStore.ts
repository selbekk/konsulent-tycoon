import { create } from 'zustand'
import { setGameId, track, trackSettled } from '../analytics'
import { describeAction, gameContext, quarterSummary, settleKey } from '../analytics/gameEvents'
import {
  actingFirm,
  applyAction,
  createNewGame,
  deleteSlot,
  endTitle,
  firmLevel,
  endTurn as engineEndTurn,
  playerRank,
  purgeIncompatibleSaves,
  quarterTodos,
  readLog,
  readSlot,
  saveLog,
  saveToSlot,
  slotStorageKey,
  valuation,
} from '../engine'
import type { Action, Crisis, GameState, MinigameKind, NewGameOptions, RunLog, SlotId } from '../engine'

export type Screen = 'menu' | 'newGame' | 'settings' | 'about' | 'leaderboard' | 'game'
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
  /** Background music (`ui/music`). */
  music: boolean
  /** 0–1 */
  musicVolume: number
}

/** Analytics id for a playthrough. Only the store makes one; the engine stays deterministic. */
const newGameId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const SETTINGS_KEY = 'kt.settings'
const defaultSettings: Settings = {
  theme: 'dark',
  reducedMotion: false,
  doubleTime: false,
  announcements: true,
  sound: true,
  soundVolume: 0.6,
  music: true,
  musicVolume: 0.4,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

/** Autosave: the game, and its action log for the leaderboard. */
function autosave(game: GameState, log: RunLog | null) {
  const storage = safeStorage()
  if (!storage) return
  saveToSlot(storage, 'auto', game)
  if (log && game.gameId) saveLog(storage, 'auto', game.gameId, log)
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
  /**
   * Every successful action and quarter end of this game, so it can be replayed on the leaderboard server.
   * Null for games saved before the log existed, which can't be submitted.
   */
  log: RunLog | null
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
  /**
   * Another tab has saved since this one loaded the game, so what's in memory is out of date. Playing on
   * would overwrite that tab's moves (and give a second try at minigames), so the game waits for a reload.
   */
  stale: boolean

  go: (screen: Screen) => void
  setTab: (tab: Tab) => void
  /** `meta` only describes the choices for analytics. */
  newGame: (opts: NewGameOptions, meta?: { customSeed: boolean; defaultName: boolean }) => void
  dispatch: (action: Action) => string | undefined
  endTurn: () => void
  /** Loads the autosave. */
  load: () => boolean
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
  log: null,
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
  stale: false,
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
    const game: GameState = { ...createNewGame(opts), gameId: newGameId() }
    setGameId(game.gameId!)
    autosave(game, [])
    set({ game, log: [], stale: false, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: true, ...noCrisis })
    track('game_started', {
      difficulty: opts.difficulty,
      founders: [...opts.founderDisciplines],
      custom_seed: meta?.customSeed,
      weekly: !!opts.weekly,
      default_name: meta?.defaultName,
    })
  },

  dispatch: (action) => {
    const { game, stale } = get()
    if (!game || stale) return 'errors.invalid'
    if (actingFirm(game, action) !== game.playerId) {
      set({ error: 'errors.invalid' })
      return 'errors.invalid'
    }
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
    const log = get().log ? [...get().log!, action] : null
    autosave(result.state, log)
    set({ game: result.state, log, error: null })
    return undefined
  },

  endTurn: () => {
    const { game, stale } = get()
    if (!game || stale || game.status !== 'playing') return
    const next = engineEndTurn(game)
    const log: RunLog | null = get().log ? [...get().log!, 'end'] : null
    autosave(next, log)
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
    set({ game: next, log, report: game.quarter, bidTenderId: null, minigame: null, error: null, levelUp, crisisId: null, crisisTalk: null })
  },

  load: () => {
    const storage = safeStorage()
    if (!storage) return false
    const read = readSlot(storage, 'auto')
    if ('error' in read) {
      track('game_load_failed', { slot: 'auto', error: read.error })
      if (read.error === 'incompatible') {
        deleteSlot(storage, 'auto')
        set({ droppedSaves: ['auto'] })
      }
      return false
    }
    const resumed = get().stale
    get().loadState(read.state)
    set({ log: readLog(storage, 'auto', read.state) })
    track('game_continued', { ...gameContext(read.state), ...(resumed ? { from_other_tab: true } : {}) })
    return true
  },

  loadState: (loaded) => {
    // Saves from before game_id get one now; it's stored with the next autosave.
    // A state from outside the autosave has no log, so it can't be submitted; load() restores the autosave's.
    const game = loaded.gameId ? loaded : { ...loaded, gameId: newGameId() }
    setGameId(game.gameId!)
    set({ game, log: null, stale: false, screen: 'game', tab: 'dashboard', report: null, error: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: false, ...noCrisis })
  },

  quit: () => {
    const { game } = get()
    if (game && game.status === 'playing') track('game_quit', gameContext(game))
    setGameId(null)
    set({ game: null, log: null, stale: false, screen: 'menu', report: null, bidTenderId: null, minigame: null, levelUp: null, onboarding: false, ...noCrisis })
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

// Another tab saved the game: this tab's copy is out of date until it reloads the autosave.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if ((e.key === slotStorageKey('auto') || e.key === null) && useGame.getState().game) useGame.setState({ stale: true })
  })
}

/** Convenience selector – only use inside the game screen. */
export const usePlayer = () => useGame((s) => (s.game ? s.game.firms[s.game.playerId] : null))
