import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TREND_MAP } from '../../content/trends'
import { CUSTOMER_MAP } from '../../content/customers'
import { averageMorale, customerAppeal, employerBrand, hasIntel, headcount, portfolioBrand, rankings } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, FirmGlyph, Panel } from '../components/ui'
import { firmColors, firmDef } from '../firms'
import { formatMoney, formatPercent } from '../format'
import { CustomerName } from './CustomerProfile'
import s from './screens.module.css'

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))}`

export function MarketScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const [showAll, setShowAll] = useState(false)
  const me = game.firms[game.playerId]
  const ranks = rankings(game)
  const myIdx = ranks.findIndex((r) => r.firmId === me.id)
  const visible = showAll ? ranks : ranks.filter((r, i) => i < 10 || r.firmId === me.id)
  const totalHc = Object.values(game.firms).reduce((sum, f) => sum + (f.bankrupt ? 0 : headcount(f)), 0)

  return (
    <div className={s.grid}>
      <Panel
        title={t('market.league')}
        icon="trophy"
        className={s.span8}
        actions={
          <Button size="small" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t('market.showTop') : t('market.showAll', { count: ranks.length })}
          </Button>
        }
      >
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.num}>#</th>
                <th>{t('market.firm')}</th>
                <th className={s.num}>{t('market.value')}</th>
                <th className={s.num}>{t('market.headcount')}</th>
                <th className={s.num}>{t('market.share')}</th>
                <th className={s.num}>{t('market.reputation')}</th>
                <th className={s.num}>{t('market.morale')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const f = game.firms[r.firmId]
                const idx = ranks.indexOf(r)
                const known = f.isPlayer || hasIntel(game, me.id, 'salaries', f.id)
                const def = firmDef(f.id)
                return (
                  <tr key={f.id} data-me={f.isPlayer}>
                    <td className={s.num}>{f.bankrupt ? '†' : idx + 1}</td>
                    <td>
                      <div className={s.row} title={def ? t(`content:firms.${f.id}.blurb`) : undefined}>
                        <FirmGlyph name={f.name} colors={firmColors(f.id)} size={24} />
                        <span>
                          {f.name}
                          {def && (
                            <span className={`${s.small} ${s.muted}`} style={{ display: 'block' }}>
                              {t(`content:firms.${f.id}.tagline`)}
                            </span>
                          )}
                        </span>
                        {def?.rival && <Badge tone="accent">{t('market.rival')}</Badge>}
                        {f.acquiredBy ? (
                          <Badge tone="info">{t('market.acquiredBy', { buyer: game.firms[f.acquiredBy]?.name })}</Badge>
                        ) : (
                          f.bankrupt && <Badge tone="bad">{t('market.bankrupt')}</Badge>
                        )}
                      </div>
                    </td>
                    <td className={s.num}>{formatMoney(r.value, lng)}</td>
                    <td className={s.num}>{f.bankrupt ? '–' : headcount(f)}</td>
                    <td className={s.num}>{f.bankrupt ? '–' : formatPercent(headcount(f) / Math.max(1, totalHc), lng, 1)}</td>
                    <td className={s.num}>{Math.round(f.reputation)}</td>
                    <td className={s.num}>{known ? Math.round(averageMorale(f)) : '???'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className={`${s.small} ${s.muted}`}>{t('market.explain', { rank: myIdx + 1 })}</p>
      </Panel>

      <div className={`${s.span4} ${s.stack}`}>
        <Panel title={t('market.trends')} icon="chart">
          {game.trends.length ? (
            <ul className={s.newsList}>
              {game.trends.map((tr) => (
                <li key={tr.id}>
                  <span className={s.newsDot} data-tone="sassy" />
                  <span>
                    <strong>{t(`content:trends.${tr.id}.name`)}</strong> – {t(`content:trends.${tr.id}.desc`)}
                    {TREND_MAP[tr.id] && <span className={`${s.small} ${s.muted}`}> {t('market.trendUntil', { count: tr.untilQuarter - game.quarter })}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{t('market.noTrends')}</p>
          )}
        </Panel>
        <Panel title={t('market.you')} icon="star">
          <div className={s.stackSm}>
            <span>{t('market.brand', { value: Math.round(employerBrand(game, me)) })}</span>
            <span className={`${s.small} ${s.muted}`}>{t('customer.portfolio', { value: signed(portfolioBrand(game, me)) })}</span>
          </div>
        </Panel>
        <Panel title={t('customer.list')} icon="briefcase" className={s.span12}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('customer.name')}</th>
                  <th className={s.num}>{t('customer.appealShort')}</th>
                  <th className={s.num}>{t('customer.relationShort')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(game.customers)
                  .sort((a, b) => (b.relationships[me.id] ?? 0) - (a.relationships[me.id] ?? 0))
                  .map((c) => {
                    const rel = Math.round(c.relationships[me.id] ?? 0)
                    const def = CUSTOMER_MAP[c.id]
                    return (
                      <tr key={c.id}>
                        <td>
                          <CustomerName id={c.id} />
                        </td>
                        <td className={s.num}>{def ? Math.round(customerAppeal(def)) : '–'}</td>
                        <td className={s.num}>
                          <Badge tone={rel >= 50 ? 'good' : rel < 20 ? 'bad' : undefined}>{rel}</Badge>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
