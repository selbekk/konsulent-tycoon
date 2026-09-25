import { useTranslation } from 'react-i18next'
import {
  DISCIPLINES,
  FEATURE_LEVEL,
  HIRE_COST,
  SEVERANCE_QUARTERS,
  acceptRate,
  disciplineSupply,
  employeeThoughts,
  hasFeature,
  pricingPremium,
  quarterlySalaryCost,
  staffFirm,
} from '../../engine'
import type { Discipline } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Meter, Panel, Stepper } from '../components/ui'
import { formatMoney, formatNumber, formatPercent } from '../format'
import { Levels } from '../components/Levels'
import { PeoplePanel } from './People'
import { StarCard } from './StarCard'
import s from './screens.module.css'

export function StaffScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const next = staffFirm(game, me, game.quarter + 1)
  const rate = acceptRate(game, me)
  const ordered = DISCIPLINES.reduce((sum, d) => sum + (me.hiringOrders[d] ?? 0), 0)
  const thoughts = employeeThoughts(game, me.id)
  // "Let one go" picks the weakest person, so the severance is theirs.
  const weakest = (d: Discipline) => Math.min(...(me.roster ?? []).filter((e) => e.discipline === d).map((e) => e.level), me.pools[d].level)

  return (
    <div className={s.grid}>
      <Panel title={t('staff.pools')} icon="people" className={s.span8}>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('staff.discipline')}</th>
                <th className={s.num}>{t('staff.people')}</th>
                <th>{t('staff.level')}</th>
                <th style={{ minWidth: 110 }}>{t('staff.morale')}</th>
                <th className={s.num}>{t('staff.demandNext')}</th>
                <th>{t('staff.recruit')}</th>
                <th className={s.num}>{t('staff.incoming')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {DISCIPLINES.map((d) => {
                const p = me.pools[d]
                const supply = disciplineSupply(me, d)
                const demand = next.demand[d] ?? 0
                return (
                  <tr key={d}>
                    <td>{t(`disciplines.${d}`)}</td>
                    <td className={s.num}>
                      {p.count}
                      {supply > p.count && <span className={s.muted}> +{supply - p.count}★</span>}
                    </td>
                    <td>{p.count ? <Levels level={p.level} /> : '–'}</td>
                    <td>{p.count ? <Meter label="" value={p.morale} /> : '–'}</td>
                    <td className={`${s.num} ${demand > supply ? s.bad : ''}`}>{demand || '–'}</td>
                    <td>
                      <Stepper
                        label={t('staff.recruit')}
                        value={me.hiringOrders[d] ?? 0}
                        max={30}
                        onChange={(v) => dispatch({ type: 'orderHires', firmId: me.id, discipline: d, count: v })}
                      />
                    </td>
                    <td className={s.num}>{me.hiringOrders[d] ? `≈${formatNumber((me.hiringOrders[d] ?? 0) * rate, lng, 1)}` : '–'}</td>
                    <td>
                      <Button
                        size="small"
                        variant="ghost"
                        disabled={!p.count}
                        title={t('staff.fireHint', { cost: formatMoney(quarterlySalaryCost(weakest(d), pricingPremium(me)) * SEVERANCE_QUARTERS, lng) })}
                        onClick={() => dispatch({ type: 'fire', firmId: me.id, discipline: d, count: 1 })}
                      >
                        {t('staff.fire')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className={`${s.small} ${s.muted}`}>
          {t('staff.recruitInfo', {
            rate: formatPercent(rate, lng),
            expected: formatNumber(ordered * rate, lng, 1),
            cost: formatMoney(HIRE_COST, lng),
          })}
        </p>
      </Panel>

      <Panel title={t('staff.thoughts')} icon="brain" className={s.span4}>
        <ul className={s.thoughts}>
          {thoughts.map((th) => (
            <li key={th.key} className={s.thought} data-mood={th.mood}>
              {t(`game:${th.key}`, th.params)}
            </li>
          ))}
        </ul>
      </Panel>

      <PeoplePanel game={game} firm={me} />

      <Panel title={t('staff.stars')} icon="star" className={s.span12}>
        <div className={s.cards}>
          {me.stars.map((star) => (
            <StarCard key={star.id} star={star} firm={me} game={game} />
          ))}
        </div>
      </Panel>

      <Panel title={t('staff.market')} icon="eye" className={s.span12}>
        {!hasFeature(me, 'stars') ? (
          <p className={s.empty}>{t('level.starsLocked', { level: FEATURE_LEVEL.stars })}</p>
        ) : game.starMarket.length ? (
          <div className={s.cards}>
            {game.starMarket.map((star) => (
              <StarCard key={star.id} star={star} firm={me} game={game} market />
            ))}
          </div>
        ) : (
          <p className={s.empty}>{t('staff.marketEmpty')}</p>
        )}
      </Panel>
    </div>
  )
}
