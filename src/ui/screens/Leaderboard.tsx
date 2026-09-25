import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NAME_NOUNS, NAME_SUFFIXES } from '../../content/leaderboardNames'
import type { LeaderboardName, NameNoun, NameSuffix } from '../../content/leaderboardNames'
import { isoWeek, readLog, readSlot, weekOpen } from '../../engine'
import type { GameState, RunLog } from '../../engine'
import { track } from '../../analytics'
import {
  SubmitFailed,
  deleteAccount,
  hallOfFame,
  isOptedIn,
  myHistory,
  myUid,
  optIn,
  savedName,
  savedResult,
  submitRun,
  weekBoard,
} from '../../online/leaderboard'
import type { BoardEntry, HistoryEntry, SubmitFailure } from '../../online/leaderboard'
import { buildSubmission } from '../../online/submission'
import type { SubmitResult } from '../../online/submission'
import { ENGINE_VERSION } from '../../online/version'
import { useGame } from '../../store/gameStore'
import { Button, Hint, Panel } from '../components/ui'
import { formatMoney } from '../format'
import { nameText, weekText } from '../leaderboardText'
import m from './menu.module.css'
import s from './screens.module.css'

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]

function randomName(): LeaderboardName {
  const a = pick(NAME_NOUNS)
  let b = pick(NAME_NOUNS)
  while (b === a) b = pick(NAME_NOUNS)
  return [a, b, pick(NAME_SUFFIXES)]
}

function NamePicker({ value, onChange }: { value: LeaderboardName; onChange: (n: LeaderboardName) => void }) {
  const { t } = useTranslation()
  const noun = (i: 0 | 1) => (
    <select
      className={s.input}
      aria-label={t(i === 0 ? 'leaderboard.nameFirst' : 'leaderboard.nameSecond')}
      value={value[i]}
      onChange={(e) => {
        const next = [...value] as LeaderboardName
        next[i] = e.target.value as NameNoun
        if (next[0] === next[1]) next[i === 0 ? 1 : 0] = value[i]
        onChange(next)
      }}
    >
      {NAME_NOUNS.map((n) => (
        <option key={n} value={n}>
          {t(`content:leaderboardNames.nouns.${n}`)}
        </option>
      ))}
    </select>
  )
  return (
    <div className={s.field}>
      <span className={s.fieldLabel}>{t('leaderboard.name')}</span>
      <div className={s.row}>
        {noun(0)}
        <span aria-hidden>&amp;</span>
        {noun(1)}
        <select
          className={s.input}
          aria-label={t('leaderboard.nameSuffix')}
          value={value[2]}
          onChange={(e) => onChange([value[0], value[1], e.target.value as NameSuffix])}
        >
          {NAME_SUFFIXES.map((n) => (
            <option key={n} value={n}>
              {t(`content:leaderboardNames.suffixes.${n}`)}
            </option>
          ))}
        </select>
        <Button size="small" variant="ghost" onClick={() => onChange(randomName())}>
          {t('leaderboard.randomName')}
        </Button>
      </div>
      <Hint>{t('leaderboard.nameHint')}</Hint>
    </div>
  )
}

function ResultSummary({ result }: { result: SubmitResult }) {
  const { t } = useTranslation()
  return (
    <div className={s.stackSm} role="status">
      <p>
        <strong>
          {t('leaderboard.result.place', {
            place: result.place,
            players: result.players,
            week: weekText(t, result.week),
          })}
        </strong>
      </p>
      <p>
        {result.players > 1
          ? t('leaderboard.result.percentile', { percentile: result.percentile })
          : t('leaderboard.result.first')}
      </p>
      {!result.best && <p className={s.muted}>{t('leaderboard.result.notBest')}</p>}
    </div>
  )
}

/**
 * Join and send a finished weekly game to the leaderboard: on the end screen, and on the leaderboard
 * screen for an autosaved game that wasn't sent (offline at the end, or went back to the menu first).
 */
export function SubmitPanel({
  game,
  log,
  onSeeBoard,
}: {
  game: GameState
  log: RunLog | null
  onSeeBoard?: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState<LeaderboardName>(() => savedName() ?? randomName())
  const [joined, setJoined] = useState(isOptedIn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SubmitFailure | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(() => (game.gameId ? savedResult(game.gameId) : null))
  if (!game.weekly) return null

  const submission = buildSubmission(game, log, name, ENGINE_VERSION)
  const send = async () => {
    if (!submission) return
    setBusy(true)
    setError(null)
    try {
      if (!joined) {
        await optIn(name)
        setJoined(true)
        track('leaderboard_joined', { from: 'end_screen' })
      } else {
        await optIn(name) // remembers a changed name
      }
      const r = await submitRun(submission)
      setResult(r)
      track('run_submitted', {
        week: r.week,
        valuation: r.valuation,
        place: r.place,
        players: r.players,
        percentile: r.percentile,
        best: r.best,
      })
    } catch (e) {
      const reason = e instanceof SubmitFailed ? e.reason : 'offline'
      setError(reason)
      track('run_rejected', { reason })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title={t('leaderboard.submit.title', { week: weekText(t, game.weekly.week) })} icon="trophy">
      <div className={s.stack}>
        {result ? (
          <>
            <ResultSummary result={result} />
            {onSeeBoard && <Button onClick={onSeeBoard}>{t('leaderboard.submit.see')}</Button>}
          </>
        ) : !submission ? (
          <p className={s.muted}>{t('leaderboard.submit.noLog')}</p>
        ) : (
          <>
            <p>{t(joined ? 'leaderboard.submit.bodyJoined' : 'leaderboard.submit.body')}</p>
            <NamePicker value={name} onChange={setName} />
            {!joined && <Hint>{t('leaderboard.join.privacy')}</Hint>}
            {error && (
              <p className={s.bad} role="alert">
                {t(`leaderboard.errors.${error}`)}
              </p>
            )}
            <Button variant="primary" disabled={busy} onClick={() => void send()}>
              {busy
                ? t('leaderboard.submit.sending')
                : t(joined ? 'leaderboard.submit.send' : 'leaderboard.submit.joinAndSend')}
            </Button>
          </>
        )}
      </div>
    </Panel>
  )
}

type BoardTab = 'week' | 'fame' | 'mine'
const loadFame = () => hallOfFame()
const loadMine = () => myHistory()

/** Loads once when mounted; give it a `key` to load again. */
function Loaded<T>({ load, children }: { load: () => Promise<T>; children: (data: T) => ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<{ data: T } | 'loading' | 'failed'>('loading')
  useEffect(() => {
    let live = true
    load().then(
      (data) => live && setState({ data }),
      () => live && setState('failed'),
    )
    return () => {
      live = false
    }
  }, [load])
  if (state === 'failed')
    return (
      <p className={s.muted} role="alert">
        {t('leaderboard.loadFailed')}
      </p>
    )
  if (state === 'loading') return <p className={s.muted}>{t('leaderboard.loading')}</p>
  return <>{children(state.data)}</>
}

function BoardTable({ entries, me, showWeek }: { entries: BoardEntry[]; me: string | null; showWeek?: boolean }) {
  const { t, i18n } = useTranslation()
  if (entries.length === 0) return <p className={s.empty}>{t('leaderboard.empty')}</p>
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.num}>#</th>
            <th>{t('leaderboard.cols.firm')}</th>
            {showWeek && <th>{t('leaderboard.cols.week')}</th>}
            <th className={s.num}>{t('leaderboard.cols.value')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.week}:${e.uid}`} data-me={e.uid === me}>
              <td className={s.num}>{i + 1}</td>
              <td>
                {nameText(t, e.name)}
                <div className={`${s.small} ${s.muted}`}>{t(`content:endTitles.${e.title}.title`)}</div>
              </td>
              {showWeek && <td className={s.small}>{weekText(t, e.week)}</td>}
              <td className={s.num}>{formatMoney(e.valuation, i18n.language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  const { t, i18n } = useTranslation()
  if (entries.length === 0) return <p className={s.empty}>{t('leaderboard.noHistory')}</p>
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('leaderboard.cols.week')}</th>
            <th>{t('leaderboard.cols.title')}</th>
            <th className={s.num}>{t('leaderboard.cols.value')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className={s.small}>{weekText(t, e.week)}</td>
              <td>{t(`content:endTitles.${e.title}.title`)}</td>
              <td className={s.num}>{formatMoney(e.valuation, i18n.language)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LeaderboardScreen() {
  const { t } = useTranslation()
  const go = useGame((x) => x.go)
  const previous = useGame((x) => x.previousScreen)
  const game = useGame((x) => x.game)
  const [tab, setTab] = useState<BoardTab>('week')
  const [week] = useState(() => isoWeek(Date.now()))
  const [joined] = useState(isOptedIn)
  const [me, setMe] = useState<string | null>(null)
  useEffect(() => {
    myUid().then(setMe, () => undefined)
  }, [])
  const loadWeek = useCallback(() => weekBoard(week), [week])
  const [unsent] = useState(unsentWeeklyGame)

  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('leaderboard.title')} icon="trophy">
          <div className={s.stack}>
            <p>{t('leaderboard.intro', { week: weekText(t, week) })}</p>
            {unsent && <SubmitPanel game={unsent.game} log={unsent.log} />}
            <div className={s.segmented} role="group" aria-label={t('leaderboard.title')}>
              {(['week', 'fame', ...(joined ? ['mine' as const] : [])] as BoardTab[]).map((id) => (
                <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                  {t(`leaderboard.tabs.${id}`)}
                </button>
              ))}
            </div>
            {tab === 'week' ? (
              <Loaded key="week" load={loadWeek}>
                {(entries) => <BoardTable entries={entries} me={me} />}
              </Loaded>
            ) : tab === 'fame' ? (
              <Loaded key="fame" load={loadFame}>
                {(entries) => <BoardTable entries={entries} me={me} showWeek />}
              </Loaded>
            ) : (
              <Loaded key="mine" load={loadMine}>
                {(entries) => <HistoryTable entries={entries} />}
              </Loaded>
            )}
            <Hint>{t('leaderboard.fairPlay')}</Hint>
            <div className={s.row} style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => go(game && previous === 'game' ? 'game' : 'menu')}>{t('common.back')}</Button>
              {!game && (
                <Button variant="primary" onClick={() => go('newGame')}>
                  {t('leaderboard.playWeekly')}
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

/** The autosaved weekly game, if it's over, has a log, hasn't been sent and its week is still open. */
function unsentWeeklyGame(): { game: GameState; log: RunLog } | null {
  try {
    const read = readSlot(localStorage, 'auto')
    if (!('state' in read)) return null
    const game = read.state
    if (!game.weekly || game.status === 'playing' || !game.gameId || savedResult(game.gameId)) return null
    if (!weekOpen(game.weekly.week, Date.now())) return null
    const log = readLog(localStorage, 'auto', game)
    return log ? { game, log } : null
  } catch {
    return null
  }
}

/** In settings, for players who have joined: what's stored, and a way to delete it. */
export function AccountSection() {
  const { t } = useTranslation()
  const [joined, setJoined] = useState(isOptedIn)
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed' | 'deleted'>('idle')
  if (!joined && status !== 'deleted') return null
  const name = savedName()

  const remove = async () => {
    setStatus('busy')
    try {
      await deleteAccount()
      track('leaderboard_account_deleted')
      setJoined(false)
      setStatus('deleted')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className={s.field}>
      <span className={s.fieldLabel}>{t('leaderboard.account.title')}</span>
      {status === 'deleted' ? (
        <p role="status">{t('leaderboard.account.deleted')}</p>
      ) : (
        <>
          <Hint>{t('leaderboard.account.body', { name: name ? nameText(t, name) : '–' })}</Hint>
          {status === 'failed' && (
            <p className={s.bad} role="alert">
              {t('leaderboard.account.failed')}
            </p>
          )}
          {confirming ? (
            <div className={s.row}>
              <Button variant="danger" disabled={status === 'busy'} onClick={() => void remove()}>
                {t('leaderboard.account.confirm')}
              </Button>
              <Button onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
            </div>
          ) : (
            <Button variant="danger" size="small" onClick={() => setConfirming(true)}>
              {t('leaderboard.account.delete')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
