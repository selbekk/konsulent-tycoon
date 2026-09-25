import { useTranslation } from 'react-i18next'
import { BANKRUPT_AFTER_QUARTERS, MAX_QUARTERS, financeOverview, firmLevel, hasFeature, headcount, valuation } from '../../engine'
import type { KpiPoint, LedgerRow } from '../../engine'
import { useGame } from '../../store/gameStore'
import type { Tab } from '../../store/gameStore'
import { Delta, KpiTile, TrendLine } from '../components/metrics'
import m from '../components/metrics.module.css'
import { Button, Panel, Stat } from '../components/ui'
import { formatMoney, formatNumber, formatPercent, formatQuarter } from '../format'
import { visibleTabs } from '../tabs'
import s from './screens.module.css'

export function FinanceScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const setTab = useGame((x) => x.setTab)
  const me = game.firms[game.playerId]
  const fo = financeOverview(game, me.id)
  const { budget, ledger } = fo
  const last = ledger[ledger.length - 1]
  const tabs = visibleTabs(firmLevel(me))
  const money = (v: number) => formatMoney(v, lng)
  const pct = (v: number) => formatPercent(v, lng)

  // Cost lines link to the tab where they are set, when that tab is open to the player.
  const link = (tab: Tab) =>
    tabs.includes(tab) ? (
      <Button size="small" variant="ghost" onClick={() => setTab(tab)}>
        {t(`tabs.${tab}`)} →
      </Button>
    ) : null
  const costs: { key: string; value: number; tab?: Tab; always?: boolean }[] = [
    // The salary slider lives in the culture tab; before that, headcount is the only lever.
    { key: 'salary', value: budget.salaryCost, tab: tabs.includes('culture') ? 'culture' : 'staff', always: true },
    { key: 'overhead', value: budget.overhead, always: true },
    { key: 'culture', value: budget.cultureCost, tab: 'culture', always: true },
    { key: 'freelance', value: budget.freelanceCost, tab: 'contracts' },
    { key: 'offshore', value: budget.offshoreCost, tab: 'contracts' },
    { key: 'strategy', value: budget.strategyCost, tab: 'strategy' },
  ]

  // Past quarters plus where this one stands now (or is expected to end up).
  const series = (pick: (r: LedgerRow) => number | undefined, now: number): KpiPoint[] => [
    ...ledger.flatMap((r) => {
      const value = pick(r)
      return value === undefined ? [] : [{ quarter: r.quarter, value }]
    }),
    { quarter: game.quarter, value: now },
  ]

  const overdrawn = fo.cash < -fo.creditLimit
  const quartersLeft = MAX_QUARTERS - game.quarter

  return (
    <div className={s.grid}>
      <Panel title={t('finance.budget.title', { quarter: formatQuarter(game.quarter) })} icon="coin" className={s.span7}>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('finance.budget.line')}</th>
                <th className={s.num}>{t('finance.budget.thisQuarter')}</th>
                <th className={s.num}>{t('finance.budget.lastQuarter')}</th>
                <th aria-label={t('finance.budget.adjust')} />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{t('finance.budget.revenue')}</strong>
                </td>
                <td className={s.num}>
                  <strong>{money(budget.revenue)}</strong>
                </td>
                <td className={s.num}>{last ? money(last.revenue) : '–'}</td>
                <td>{link('contracts')}</td>
              </tr>
              {costs
                .filter((c) => c.always || c.value > 0)
                .map((c) => (
                  <tr key={c.key}>
                    <td className={s.muted}>{t(`finance.budget.${c.key}`)}</td>
                    <td className={s.num}>{money(-c.value)}</td>
                    <td />
                    <td>{c.tab && link(c.tab)}</td>
                  </tr>
                ))}
              <tr>
                <td>
                  <strong>{t('finance.budget.costs')}</strong>
                </td>
                <td className={s.num}>
                  <strong>{money(-budget.total)}</strong>
                </td>
                <td className={s.num}>{last ? money(-last.costs) : '–'}</td>
                <td />
              </tr>
              <tr>
                <td>
                  <strong>{t('finance.budget.result')}</strong>
                </td>
                <td className={`${s.num} ${budget.ebitda >= 0 ? s.good : s.bad}`}>
                  <strong>{money(budget.ebitda)}</strong>
                </td>
                <td className={s.num}>{last ? money(last.ebitda) : '–'}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
          {t('finance.budget.explain')}
          {last && (
            <>
              {' '}
              {t('finance.budget.vsLast')} <Delta diff={budget.ebitda - last.ebitda} format={money} />
            </>
          )}
        </p>
      </Panel>

      <Panel title={t('finance.cash.title')} icon="flame" className={s.span5}>
        <div className={s.kpis}>
          <Stat label={t('finance.cash.cash')} value={money(fo.cash)} tone={fo.cash < 0 ? 'bad' : undefined} />
          <Stat label={t('finance.cash.credit')} value={money(fo.creditLimit)} />
          <Stat label={t('finance.cash.headroom')} value={money(fo.headroom)} tone={fo.headroom <= 0 ? 'bad' : undefined} />
          <Stat label={t('finance.cash.burn')} value={fo.burn > 0 ? money(fo.burn) : '–'} tone={fo.burn > 0 ? 'bad' : undefined} />
          <Stat
            label={t('finance.cash.runway')}
            value={
              fo.runway === undefined || fo.runway >= quartersLeft ? t('finance.cash.allGame') : t('finance.cash.quarters', { count: Math.floor(fo.runway) })
            }
            tone={fo.runway !== undefined && fo.runway < 2 ? 'bad' : undefined}
          />
        </div>
        <p className={`${s.small} ${overdrawn ? s.bad : s.muted}`} style={{ marginBottom: 0 }}>
          {overdrawn
            ? t('finance.cash.overdrawn', { count: BANKRUPT_AFTER_QUARTERS - fo.overdrawnQuarters })
            : fo.burn > 0
              ? t('finance.cash.burning')
              : t('finance.cash.earning')}
        </p>
      </Panel>

      {hasFeature(me, 'kpis') && (
        <Panel title={t('finance.trends.title')} icon="chart" className={s.span12}>
          <div className={m.tiles}>
            <KpiTile
              abbr={t('finance.trends.cashAbbr')}
              name={t('finance.trends.cash')}
              value={money(fo.cash)}
              trend={<TrendLine points={series((r) => r.cash, fo.cash)} format={money} label={t('finance.trends.cash')} baseline={0} />}
              lines={[]}
            />
            <KpiTile
              abbr={t('finance.trends.valueAbbr')}
              name={t('finance.trends.value')}
              value={money(valuation(me))}
              trend={<TrendLine points={series((r) => r.valuation, valuation(me))} format={money} label={t('finance.trends.value')} />}
              lines={[]}
            />
            <KpiTile
              abbr={t('finance.trends.revenueAbbr')}
              name={t('finance.trends.revenue')}
              value={money(budget.revenue)}
              trend={<TrendLine points={series((r) => r.revenue, budget.revenue)} format={money} label={t('finance.trends.revenue')} />}
              lines={[]}
            />
            <KpiTile
              abbr={t('finance.trends.resultAbbr')}
              name={t('finance.trends.result')}
              value={money(budget.ebitda)}
              trend={<TrendLine points={series((r) => r.ebitda, budget.ebitda)} format={money} label={t('finance.trends.result')} baseline={0} />}
              lines={[]}
            />
            <KpiTile
              abbr={t('finance.trends.utilizationAbbr')}
              name={t('finance.trends.utilization')}
              value={pct(budget.utilization)}
              trend={<TrendLine points={series((r) => r.utilization, budget.utilization)} format={pct} label={t('finance.trends.utilization')} />}
              lines={[]}
            />
            <KpiTile
              abbr={t('finance.trends.headcountAbbr')}
              name={t('finance.trends.headcount')}
              value={formatNumber(headcount(me), lng)}
              trend={
                <TrendLine
                  points={series((r) => r.headcount, headcount(me))}
                  format={(v) => t('kpi.people', { count: v })}
                  label={t('finance.trends.headcount')}
                />
              }
              lines={[]}
            />
          </div>
          <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
            {t('finance.trends.explain')}
          </p>
        </Panel>
      )}

      <Panel title={t('finance.ledger.title')} icon="calendar" className={s.span12}>
        {ledger.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('finance.ledger.quarter')}</th>
                  <th className={s.num}>{t('finance.ledger.revenue')}</th>
                  <th className={s.num}>{t('finance.ledger.costs')}</th>
                  <th className={s.num}>{t('finance.ledger.result')}</th>
                  <th className={s.num}>{t('finance.ledger.other')}</th>
                  <th className={s.num}>{t('finance.ledger.cash')}</th>
                </tr>
              </thead>
              <tbody>
                {[...ledger].reverse().map((r) => (
                  <tr key={r.quarter}>
                    <td>{formatQuarter(r.quarter)}</td>
                    <td className={s.num}>{money(r.revenue)}</td>
                    <td className={s.num}>{money(-r.costs)}</td>
                    <td className={`${s.num} ${r.ebitda >= 0 ? '' : s.bad}`}>{money(r.ebitda)}</td>
                    <td className={s.num} title={r.fines ? t('finance.ledger.fines', { fine: money(r.fines) }) : undefined}>
                      {r.other === undefined ? '–' : money(r.other)}
                    </td>
                    <td className={s.num}>{r.cash === undefined ? '–' : money(r.cash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={s.empty}>{t('finance.ledger.empty')}</p>
        )}
        <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
          {t('finance.ledger.explain')}
        </p>
      </Panel>
    </div>
  )
}
