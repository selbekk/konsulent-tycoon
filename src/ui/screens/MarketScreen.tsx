import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TREND_MAP } from '../../content/trends'
import { averageMorale, employerBrand, hasIntel, headcount, rankings } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, FirmGlyph, Panel } from '../components/ui'
import { firmColors, firmDef } from '../firms'
import { formatMoney, formatPercent } from '../format'
import s from './screens.module.css'

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
            <span>{t('market.brand', { value: Math.round(employerBrand(me)) })}</span>
            <span>{t('market.relations')}</span>
            <div className={s.seats}>
              {Object.values(game.customers)
                .sort((a, b) => (b.relationships[me.id] ?? 0) - (a.relationships[me.id] ?? 0))
                .map((c) => (
                  <Badge key={c.id} tone={(c.relationships[me.id] ?? 0) >= 50 ? 'good' : (c.relationships[me.id] ?? 0) < 20 ? 'bad' : undefined}>
                    {t(`content:customers.${c.id}.name`)} {Math.round(c.relationships[me.id] ?? 0)}
                  </Badge>
                ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
