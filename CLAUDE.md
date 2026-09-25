# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Konsulent Tycoon is a turn-based, retro-styled browser strategy game: run an IT consultancy for 40 quarters (2027–2036) against 24 AI firms. Frontend only (React 19 + Zustand + Vite), no backend, saves to `localStorage`, ships as an offline PWA on Vercel. `README.md` is a short intro for visitors. The Norwegian `docs/utvikling.md` is the detailed developer guide; read the relevant section before larger changes. Game design and open questions live in `docs/spilldesign.md`, decisions for larger systems in `docs/plans/`, and balance history in `docs/balance-log.md`.

## Commands

```bash
npm run dev                  # Vite dev server (service worker is disabled in dev)
npm test                     # Vitest, run once
npx vitest run src/engine/shady.test.ts      # single file
npx vitest run -t "determinism"              # tests matching a name
npm run typecheck            # tsc -b --noEmit (scripts/ are type-checked too)
npm run lint                 # oxlint
npm run build                # tsc -b && vite build -> dist/
npm run build && npm run preview             # the only way to test PWA/offline behaviour
npm run sim -- --games 60 --strategy human,humanPro   # headless balance sim with player bots
npm run sim:market -- 20 -v  # AI market alone over 40 quarters
npm run icons                # regenerate PNG icons from public/icon.svg (commit the output)
```

Before committing, `typecheck`, `test` and `build` should all pass.

## Architecture

Three layers: React UI (`src/ui`, `App.tsx`) → Zustand store (`src/store/gameStore.ts`, a thin bridge) → pure TS engine (`src/engine`) that reads data from `src/content`.

- **Engine is pure TypeScript.** It never imports React, the DOM, or Vite-only features (`import.meta.glob`, `?raw`, …). This applies to `src/content` too. `scripts/sim.ts` runs the engine directly in Node via `tsx`, so breaking this breaks the simulator.
- **The entire game is one JSON-serializable `GameState`** (`engine/types.ts`): no classes, functions, `Date` or `Map`.
- **Public API** (`engine/index.ts`): `createNewGame`, `applyAction(state, action) → { state, error? }` (pure, `structuredClone`s input; on error returns the *original* state plus an i18n key like `'errors.notEnoughCash'`), and `endTurn(state)`. Inside the engine (AI turns, sim) use `applyActionInPlace` on a single draft to avoid hundreds of clones per turn.
- **Player and AI firms are equal.** Both are `Firm`s and mutate the game only through the same `Action`s and reducer (`reducer.ts`). AI decides via `engine/ai/planner.ts` (`planAiTurn`); `ai/humanProxy.ts` is a "sensible human" bot used for balancing.
- **Quarter pipeline** (`turn.ts` `endTurn`) runs in a fixed order that matters: auto-resolve events → AI turns (they answer their crises first) → crisis fallbacks for unanswered stages → per-firm finances/satisfaction/culture/departments/stars/turnover/report/IPO pressure → shady detection and buried-crisis exposure → tender awards → level-ups → contract expiry/renewal and framework call-offs → trends and new tenders → yearly awards after Q4 → player missions and milestones → bankruptcy → `quarter++`, star market, crises advance, events and new crises, announcements, ticker gossip. See "Kvartalspipelinen" in `docs/utvikling.md` before reordering.
- **Tender timeline:** published in q, biddable in q and q+1 (AIs bid at the start of `endTurn`), awarded at end of q+1, contract starts q+2.
- **Store:** `dispatch(action)` rejects actions for any firm but the player's (`actingFirm`), calls `applyAction` and autosaves to the `auto` slot after *every* action (prevents reload-to-retry minigames); `endTurn()` autosaves and opens the quarter report. `auto` is the only slot: manual slots were removed because save-and-reload made every minigame retryable. A `storage` event from another tab marks the game `stale` and blocks play until it is reloaded.

## Rules that are easy to break

- **Seeded RNG lives in `state.rng` and is mutated by `nextFloat` & co.** Only engine code working on a draft may draw from it. Anything the UI calls (`bidQuality`, `bidScoreEstimate`, `employeeThoughts`, `quarterFinancials`, …) must not touch `state.rng`; a test enforces this. Minigames use their own hash RNG: `createRng(hashString(tenderId + firmId))`.
- **No balance numbers in modules.** All tunables go in `engine/constants.ts` with a name and comment; AI personalities in `engine/ai/personalities.ts`.
- **No user-facing text in the engine.** It emits i18n keys + params (e.g. `NewsItem { key, params }`); the UI translates. Param names `customer`, `trend`, `discipline`, `fine`, `amount`, `mission`, `crisis` are auto-resolved to names/formatted amounts (and `weak`/`strong` to the bid-factor sentences in `game:factors`) by `ui/format.ts` (`resolveParams`/`newsText`), so use those names when referencing such ids.
- **i18n:** namespaces `ui`, `game` (everything the engine emits: `errors.*`, `news.*`, `events.*`, …), `content` (entity names/blurbs), `minigames`, under `src/i18n/locales/{nb,en}/`. `src/i18n/i18n.test.ts` requires identical keys in `nb` and `en` and text for every content id, so new content without translations fails the test. Every `game:news.*` key (and crisis gossip) also needs a short story in `game:articles.*` for the ticker modal (`content/articles.ts`), which the test checks too. English should be idiomatic, not literal. Tone: dry, warm, slightly absurd, never mean; at most one joke per screen.
- **Save format:** after launch, a `GameState` shape change needs a `SAVE_VERSION` bump in `constants.ts`, a `migrations[oldVersion]` entry in `save.ts`, and a test in `save.test.ts`. Pre-launch, `SAVE_VERSION` stays 1 and new fields are optional with sensible defaults. On load, `engine/saveShape.ts` checks every required field; saves that fail (or can't be migrated) are deleted at startup and the main menu tells the player to start over. Its key lists are typecheck-enforced, so a new required field must be added there too.
- **TypeScript:** strict with `noUnusedLocals`/`noUnusedParameters` and `erasableSyntaxOnly`, so use union types and `as const`, not `enum` or parameter properties.
- **Performance:** `endTurn` should stay under ~20 ms (one clone per turn). `Firm.history` is capped at 12 quarters, the news log at 200, and old tenders/contracts are pruned after a year.
- **Quarter to-do list** (`engine/todos.ts`, shown on the dashboard and as a warning before ending the quarter): every item must be fixable *this quarter* with one concrete action, or the warning turns into nagging. Check new items by running `planHumanProxy` over a few games: the bot should almost never end a quarter with open items.
- **The player's roster** (`engine/roster.ts`): the player's pools are derived from `Firm.roster`, so change pool size or level only through `addPeople`/`removePeople`/`raiseLevel`, never by writing `pools[d].count` directly (tests that do call `syncRosterToPools`). Roster draws use `rosterRng`, never `state.rng`. Development and promotion live in `engine/development.ts`.
- **Firm levels** (`engine/levels.ts`): features, tender size and backroom tricks unlock by level (`LEVELS`, `FEATURE_LEVEL` in `constants.ts`). Gates live in the reducer so they apply to AI too; planners must filter locked options first, since rejected AI actions fail silently. Tests of level-gated features use `veteranTestGame()`.
- **Analytics** (`src/analytics/`, PostHog, opt-in): only the UI and store call it, never the engine. Every `ActionType` needs an entry in `ACTION_EVENTS` (`gameEvents.ts`). Send content ids and numbers, never text the player typed (firm name). If what is sent changes, update `about.privacy` in both locales. See "Analyse (PostHog)" in `docs/utvikling.md`.
- **Leaderboard** (`docs/plans/2026-09-25-toppliste.md`, "Toppliste (Firebase)" in `docs/utvikling.md`): the store logs every successful action plus `'end'` per quarter, and a Cloud Function (`functions/`) replays weekly games with `replayRun` to rank them. So the engine must play identically in browsers and Node: no `localeCompare`, `Intl`, `Date.now` or `Math.random` in `src/engine`/`src/content` (a test enforces it; sort ids with `compareIds`). Any change to `src/engine` or `src/content` changes `ENGINE_VERSION`, and the server only accepts games from its own version, so the functions and the app must deploy together: `.github/workflows/ci.yml` does both on merge to main (Firebase first, then Vercel; Vercel's own production deploy from main is disabled in `vercel.json`). Firebase is loaded lazily and only from the UI (`src/online/leaderboard.ts`). The reducer is now a trust boundary (logs can be edited before they're sent): handlers must validate ids, clamp numbers, and use `Object.hasOwn` for content-map lookups; `hostile.test.ts` covers this, so add new actions there. `npm run functions:check` runs the backend end to end in the emulators.
- **Parody firm names** are gentle puns on real consultancies; `parodyOf` in `content/firms.ts` is a code comment only and must never be shown in the UI.

## Adding content

Content is data in `src/content/` plus translations in both locales. Events (`content/events.ts`) use an effect DSL (`cash`, `cashPerHead`, `reputation`, `heat`, `fagmiljo`, `sosialt`, `morale`, `brand`, `salaryPremium`, `relationship`, `starLoyalty`, `starPremium`, `special`), with special handlers in `engine/events.ts`; `cooldown: Infinity` makes a one-off. Crises (`content/crises.ts`, `engine/crises.ts`) are multi-quarter: stages with choices, a hidden severity revealed by `reveals` stages, one cost-free `fallback` per stage and severity, and `bury` choices that may resurface as the shared `exposed` stage; `crises.test.ts` checks every def is well-formed. A new shady action needs `ShadyActionId` (`types.ts`), `SHADY_CATALOG` with a `minLevel` + `handleShady` (`shady.ts`), and keys `content:shady.actions.<id>` and `game:news.scandal.<id>`. "Innhold: slik legger du til ting" in `docs/utvikling.md` lists what each content type needs.

## UI conventions

- CSS Modules plus design tokens in `ui/theme/tokens.css`. Always use tokens (`var(--accent)`), never hardcoded colours. Dark theme is the default; light is `:root[data-theme='light']`.
- Retro but calm: rounded corners (`--radius`), soft shadows. Pixel art belongs in illustrations (icons, office, portraits), not in text or controls. Fonts: Press Start 2P for the logo only, Bungee for headings and big buttons, IBM Plex Sans for body, IBM Plex Mono for numbers (`.num`).
- Icons are 8×8 ASCII bitmaps in `ui/components/Icon.tsx` (`#` fill, `o` accent). Add new ones to `ICONS`. No emoji in the UI.
- Sound is synthesized with Web Audio in `ui/sound.ts` (`playSound('win')`; add new sounds as tone lists in `SOUNDS`).
- Background music is synthesized too (`ui/music/`): songs are chord/style data in `songs.ts`, `compose.ts` turns them into notes deterministically, and `player.ts` schedules them on the `AudioContext` shared with effects (`ui/audio.ts`). New songs need a title in `ui:music.songs.<id>`.
- Layout must work down to 360 px. Modals trap focus and close on Escape; honour reduced motion.

## Testing

Tests sit next to the code (`*.test.ts`). Engine tests run in Node; tests needing a DOM start with `// @vitest-environment jsdom`. Use `newTestGame(seed)` and `deepFreeze()` from `src/engine/testUtils.ts` (the latter catches input mutation). For random outcomes, force probabilities to 0 or 1 and restore them in `afterEach` (see `shady.test.ts`). Invariants to keep covered: determinism (same seed → same state), no input mutation, save/load/`endTurn` equal to no save, UI helpers not touching `state.rng`, and i18n parity. There is no Playwright setup, so verify UI changes by clicking through a game in `npm run dev`.

## Balancing workflow

Use a fixed seed set and change one thing per run, with 30–60 games minimum (noise is about ±5 of 60). Fix the AI market (`sim:market`) before tuning the player experience. Log every change and its measured result in `docs/balance-log.md`. Look for structural causes first: past wins came from mechanics (exogenous demand, flex staffing, contract renewal), not from tuning constants. Current targets are in the balance log.
