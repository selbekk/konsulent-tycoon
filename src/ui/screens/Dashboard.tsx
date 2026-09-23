import { useTranslation } from 'react-i18next'
import { activeContracts, openTenders, playerRank, quarterFinancials, valuation } from '../../engine'
import { useGame } from '../../store/gameStore'
import { bjornKey } from '../bjorn'
import { Bjorn } from '../components/Bjorn'
import { Button, Panel, Sparkline, Stat } from '../components/ui'
import { formatMoney, formatPercent, formatQuarter, newsText } from '../format'
import { OfficeView } from '../office/OfficeView'
import s from './screens.module.css'

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const setTab = useGame((x) => x.setTab)
  const me = game.firms[game.playerId]
  const fin = quarterFinancials(game, me.id)
  const last = me.history[me.history.length - 1]
  const open = openTenders(game)
  const myBids = open.filter((tn) => tn.bids.some((b) => b.firmId === me.id)).length
  const contracts = activeContracts(game, me.id)
  const ending = contracts.filter((c) => c.endQuarter === game.quarter + 1)
  const personal = game.news.filter((n) => n.personal).slice(-6).reverse()
  const cashHistory = [...me.valuationHistory.slice(-12), valuation(me)]

  return (
    <div className={s.grid}>
      <Panel title={t('dashboard.thisQuarter', { quarter: formatQuarter(game.quarter) })} icon="chart" className={s.span8}>
        <div className={s.kpis}>
          <Stat label={t('dashboard.expectedRevenue')} value={formatMoney(fin.revenue, lng)} />
          <Stat label={t('dashboard.expectedCosts')} value={formatMoney(fin.total, lng)} />
          <Stat label={t('dashboard.expectedResult')} value={formatMoney(fin.ebitda, lng)} tone={fin.ebitda >= 0 ? 'good' : 'bad'} />
          <Stat label={t('dashboard.utilization')} value={formatPercent(fin.utilization, lng)} />
          <Stat label={t('dashboard.valuation')} value={formatMoney(valuation(me), lng)} />
          <Stat label={t('dashboard.rank')} value={`#${playerRank(game)} / ${game.firmOrder.filter((id) => !game.firms[id].bankrupt).length}`} />
        </div>
        <div style={{ marginTop: 12 }}>
          <span className={`${s.small} ${s.muted}`}>{t('dashboard.valuationTrend')}</span>
          <Sparkline values={cashHistory} />
        </div>
        {last && (
          <p className={`${s.small} ${s.muted}`}>
            {t('dashboard.lastQuarter', {
              revenue: formatMoney(last.revenue, lng),
              result: formatMoney(last.ebitda, lng),
              hires: last.hires,
              leavers: last.leavers,
            })}
          </p>
        )}
      </Panel>

      <div className={`${s.span4} ${s.stack}`}>
        <Bjorn text={t(bjornKey(game))} />
        <Panel title={t('dashboard.todo')} icon="calendar">
          <ul className={s.newsList}>
            <li>
              <span className={s.newsDot} data-tone={open.length - myBids > 0 ? 'good' : undefined} />
              <span>
                {t('dashboard.openTenders', { count: open.length, mine: myBids })}{' '}
                <Button size="small" onClick={() => setTab('tenders')}>
                  {t('dashboard.goTenders')}
                </Button>
              </span>
            </li>
            {ending.length > 0 && (
              <li>
                <span className={s.newsDot} data-tone="bad" />
                <span>{t('dashboard.endingSoon', { count: ending.length })}</span>
              </li>
            )}
            {game.starMarket.length > 0 && (
              <li>
                <span className={s.newsDot} data-tone="sassy" />
                <span>
                  {t('dashboard.starsAvailable', { count: game.starMarket.length })}{' '}
                  <Button size="small" onClick={() => setTab('staff')}>
                    {t('dashboard.goStaff')}
                  </Button>
                </span>
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title={t('dashboard.office')} icon="people" className={s.span7}>
        <OfficeView firm={me} />
      </Panel>

      <Panel title={t('dashboard.news')} icon="news" className={s.span5}>
        {personal.length ? (
          <ul className={s.newsList}>
            {personal.map((n) => (
              <li key={n.id}>
                <span className={s.newsDot} data-tone={n.tone} />
                <span>
                  <span className={s.muted}>{formatQuarter(n.quarter)}</span> {newsText(n, t, lng)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t('dashboard.noNews')}</p>
        )}
      </Panel>
    </div>
  )
}
