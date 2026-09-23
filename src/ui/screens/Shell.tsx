import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FEATURE_LEVEL, averageMorale, creditLimit, firmLevel, headcount, quarterTodos } from '../../engine'
import type { Feature } from '../../engine'
import { TABS, useGame } from '../../store/gameStore'
import type { Tab } from '../../store/gameStore'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Button, Modal, Stat } from '../components/ui'
import { formatMoney, formatQuarter, newsText } from '../format'
import { playSound } from '../sound'
import { BackroomScreen } from './BackroomScreen'
import { BidForm } from './BidForm'
import { ContractsScreen } from './ContractsScreen'
import { CultureScreen } from './CultureScreen'
import { Dashboard } from './Dashboard'
import { EndGame } from './EndGame'
import { EventModal } from './EventModal'
import { MarketScreen } from './MarketScreen'
import { MinigameHost } from '../minigames/MinigameHost'
import { QuarterReport } from './QuarterReport'
import { SaveDialog } from './SaveDialog'
import { StaffScreen } from './StaffScreen'
import { TenderBoard } from './TenderBoard'
import { TodoList } from './TodoList'
import s from './shell.module.css'

const TAB_ICONS: Record<Tab, IconName> = {
  dashboard: 'chart',
  staff: 'people',
  culture: 'coffee',
  tenders: 'briefcase',
  contracts: 'handshake',
  market: 'trophy',
  backroom: 'door',
}

/** Tabs that only show up once the firm reaches the level for them. */
const TAB_FEATURE: Partial<Record<Tab, Feature>> = { culture: 'culture', backroom: 'backroom' }
const visibleTabs = (level: number) => TABS.filter((id) => !TAB_FEATURE[id] || level >= FEATURE_LEVEL[TAB_FEATURE[id]])

const SCREENS: Record<Tab, () => React.ReactNode> = {
  dashboard: Dashboard,
  staff: StaffScreen,
  culture: CultureScreen,
  tenders: TenderBoard,
  contracts: ContractsScreen,
  market: MarketScreen,
  backroom: BackroomScreen,
}

export function Shell() {
  const { t, i18n } = useTranslation()
  const game = useGame((x) => x.game)!
  const tab = useGame((x) => x.tab)
  const setTab = useGame((x) => x.setTab)
  const endTurn = useGame((x) => x.endTurn)
  const report = useGame((x) => x.report)
  const bidTenderId = useGame((x) => x.bidTenderId)
  const minigame = useGame((x) => x.minigame)
  const settings = useGame((x) => x.settings)
  const go = useGame((x) => x.go)
  const [saving, setSaving] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [hideAnnouncement, setHideAnnouncement] = useState<number | null>(null)
  const me = game.firms[game.playerId]
  const pending = game.pendingEvents.filter((e) => e.firmId === me.id)
  const modalOpen =
    report !== null || !!bidTenderId || !!minigame || pending.length > 0 || saving || confirmEnd || game.status !== 'playing'
  const lng = i18n.language
  const level = firmLevel(me)
  const tabs = useMemo(() => visibleTabs(level), [level])
  const openTodos = quarterTodos(game, me.id).filter((x) => !x.done)

  // Both the button and the Enter shortcut go through here, so neither skips the warning.
  const hasOpenTodos = openTodos.length > 0
  const tryEndTurn = useCallback(() => (hasOpenTodos ? setConfirmEnd(true) : endTurn()), [hasOpenTodos, endTurn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (modalOpen || el.closest('input, textarea, select, [role="dialog"]')) return
      if (e.key === 'Enter' && el.tagName !== 'BUTTON') tryEndTurn()
      const n = Number(e.key)
      if (n >= 1 && n <= tabs.length) setTab(tabs[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, tryEndTurn, setTab, tabs])

  // PA chime when a new quarter's announcement becomes visible.
  const showAnnouncement = settings.announcements && !!game.announcement && hideAnnouncement !== game.quarter
  useEffect(() => {
    if (showAnnouncement && report === null && game.quarter > 0) playSound('dingdong')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.quarter, report === null])

  const Screen = SCREENS[tabs.includes(tab) ? tab : 'dashboard']
  const hc = headcount(me)
  const credit = creditLimit(me)
  const ticker = useMemo(() => {
    const market = game.news.filter((n) => !n.personal)
    return (market.length ? market : game.news).slice(-12).reverse()
  }, [game.news])

  return (
    <div className={s.shell}>
      <header className={s.topbar}>
        <div className={s.brand}>
          <span className={s.logo}>
            KONSULENT
            <br />
            TYCOON
          </span>
          <div>
            <div className={s.firmName}>{me.name}</div>
            <div className={s.quarter}>
              {formatQuarter(game.quarter)} · {t('shell.quarterOf', { n: game.quarter + 1, total: game.maxQuarters })}
            </div>
            <div className={s.quarter}>
              {t('level.label', { level })} · {t(`level.names.${level}`)}
            </div>
          </div>
        </div>
        <div className={s.stats}>
          <Stat
            icon="coin"
            label={me.cash < 0 ? t('shell.cashCredit', { limit: formatMoney(credit, lng) }) : t('shell.cash')}
            value={formatMoney(me.cash, lng)}
            tone={me.cash < 0 ? 'bad' : undefined}
          />
          <Stat icon="people" label={t('shell.headcount')} value={hc} />
          <Stat icon="star" label={t('shell.reputation')} value={Math.round(me.reputation)} />
          <Stat icon="coffee" label={t('shell.morale')} value={Math.round(averageMorale(me))} />
          {me.heat > 0 && <Stat icon="flame" label={t('shell.heat')} value={Math.round(me.heat)} tone={me.heat > 40 ? 'bad' : undefined} />}
        </div>
        <div className={s.topActions}>
          <Button size="small" icon="disk" onClick={() => setSaving(true)}>
            {t('shell.save')}
          </Button>
          <Button size="small" variant="ghost" icon="gear" onClick={() => go('settings')} aria-label={t('menu.settings')} />
        </div>
      </header>

      {showAnnouncement && game.announcement ? (
        <div className={s.announce} role="status">
          <Icon name="news" />
          <span>
            <strong>{t('shell.announcement')}</strong> {t(`game:${game.announcement.key}`, game.announcement.params)}
          </span>
          <button onClick={() => setHideAnnouncement(game.quarter)} aria-label={t('common.close')}>
            ×
          </button>
        </div>
      ) : (
        <div />
      )}

      <nav className={s.nav} aria-label={t('shell.nav')}>
        {tabs.map((id, i) => (
          <button
            key={id}
            className={s.navItem}
            aria-current={(tabs.includes(tab) ? tab : 'dashboard') === id ? 'page' : undefined}
            data-noir={id === 'backroom'}
            onClick={() => setTab(id)}
          >
            <Icon name={TAB_ICONS[id]} size={14} />
            {t(`tabs.${id}`)}
            <span className={s.navKey}>{i + 1}</span>
          </button>
        ))}
      </nav>

      <main className={s.main}>
        <Screen />
      </main>

      <div className={s.endTurn}>
        {pending.length > 0 && <span className={s.endTurnHint}>{t('shell.pendingEvents', { count: pending.length })}</span>}
        <Button variant="primary" size="big" onClick={tryEndTurn} disabled={pending.length > 0 || game.status !== 'playing'}>
          {t('shell.endTurn')} ▶
        </Button>
      </div>

      <div className={s.ticker} aria-label={t('shell.ticker')}>
        <span className={s.tickerLabel}>{t('shell.news')}</span>
        <div className={s.tickerViewport}>
          {settings.reducedMotion ? (
            <span className={s.tickerStatic}>{ticker[0] ? newsText(ticker[0], t, lng) : ''}</span>
          ) : (
            <div className={s.tickerTrack} key={game.quarter}>
              {[...ticker, ...ticker].map((n, i) => (
                <span key={`${n.id}-${i}`} aria-hidden={i >= ticker.length}>
                  {formatQuarter(n.quarter)} · {newsText(n, t, lng)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {report !== null && <QuarterReport />}
      {report === null && pending.length > 0 && game.status === 'playing' && <EventModal event={pending[0]} />}
      {bidTenderId && (
        // Kept mounted (but hidden) during the minigame so the draft bid survives.
        <div style={minigame ? { display: 'none' } : undefined}>
          <BidForm tenderId={bidTenderId} />
        </div>
      )}
      {minigame && <MinigameHost />}
      {saving && <SaveDialog onClose={() => setSaving(false)} />}
      {confirmEnd && (
        <Modal
          icon="warn"
          title={t('todo.confirm.title')}
          onClose={() => setConfirmEnd(false)}
          actions={
            <>
              <Button onClick={() => setConfirmEnd(false)}>{t('todo.confirm.back')}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmEnd(false)
                  endTurn()
                }}
              >
                {t('todo.confirm.endAnyway')} ▶
              </Button>
            </>
          }
        >
          <p>{t('todo.confirm.body')}</p>
          <TodoList todos={openTodos} onGo={() => setConfirmEnd(false)} />
        </Modal>
      )}
      {game.status !== 'playing' && report === null && <EndGame />}
    </div>
  )
}
