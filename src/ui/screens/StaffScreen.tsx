import { useTranslation } from 'react-i18next'
import {
  DISCIPLINES,
  HIRE_COST,
  SEVERANCE_QUARTERS,
  acceptRate,
  ambitionMet,
  disciplineSupply,
  employeeThoughts,
  headcount,
  quarterlySalaryCost,
  staffFirm,
  starSigningCost,
} from '../../engine'
import type { Firm, GameState, Star } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Meter, Panel, Stepper } from '../components/ui'
import { formatMoney, formatNumber, formatPercent } from '../format'
import s from './screens.module.css'

function Levels({ level }: { level: number }) {
  const full = Math.round(level)
  return (
    <span aria-label={`${level.toFixed(1)} / 5`} title={level.toFixed(1)} style={{ letterSpacing: 1, color: 'var(--warn)' }}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

export function StarCard({ star, firm, game, market }: { star: Star; firm: Firm; game: GameState; market?: boolean }) {
  const { t, i18n } = useTranslation()
  const dispatch = useGame((x) => x.dispatch)
  const contract = star.assignedContractId ? game.contracts.find((c) => c.id === star.assignedContractId) : undefined
  const met = ambitionMet(firm, star, headcount(firm))
  const cost = starSigningCost(star, firm)
  return (
    <article className={s.card}>
      <div className={s.cardTitle}>
        <span>{star.name}</span>
        {star.founder && <Badge tone="accent">{t('staff.founder')}</Badge>}
      </div>
      <div className={s.row}>
        <Badge>{t(`disciplines.${star.discipline}`)}</Badge>
        <Levels level={star.level} />
      </div>
      <div className={s.seats}>
        {star.traits.map((tr) => (
          <span key={tr} title={t(`content:traits.${tr}.desc`)}>
            <Badge tone="info">{t(`content:traits.${tr}.name`)}</Badge>
          </span>
        ))}
      </div>
      <span className={s.small}>
        {t(`content:ambitions.${star.ambition}`)}
        {!market && !star.founder && <span className={met ? s.good : s.bad}> · {met ? t('staff.ambitionMet') : t('staff.ambitionUnmet')}</span>}
      </span>
      {!market && (
        <>
          <Meter label={t('staff.morale')} value={star.morale} />
          {!star.founder && <Meter label={t('staff.loyalty')} value={star.loyalty} />}
          <span className={`${s.small} ${s.muted}`}>
            {contract ? t('staff.assignedTo', { customer: t(`content:customers.${contract.customerId}.name`) }) : t('staff.unassigned')}
          </span>
        </>
      )}
      <span className={`${s.small} ${s.muted}`}>
        {t('staff.premium', { premium: formatPercent(star.salaryPremium, i18n.language) })}
      </span>
      {market ? (
        <Button variant="primary" size="small" disabled={firm.cash < cost} onClick={() => dispatch({ type: 'hireStar', firmId: firm.id, starId: star.id })}>
          {t('staff.hireStar', { cost: formatMoney(cost, i18n.language) })}
        </Button>
      ) : (
        !star.founder && (
          <Button size="small" onClick={() => dispatch({ type: 'giveRaise', firmId: firm.id, starId: star.id, amount: 0.05 })}>
            {t('staff.raise')}
          </Button>
        )
      )}
    </article>
  )
}

export function StaffScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const next = staffFirm(game, me, game.quarter + 1)
  const rate = acceptRate(me)
  const ordered = DISCIPLINES.reduce((sum, d) => sum + (me.hiringOrders[d] ?? 0), 0)
  const thoughts = employeeThoughts(game, me.id)

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
                    <td className={s.num}>{me.pendingHires[d] ?? '–'}</td>
                    <td>
                      <Button
                        size="small"
                        variant="ghost"
                        disabled={!p.count}
                        title={t('staff.fireHint', { cost: formatMoney(quarterlySalaryCost(p.level, me.budgets.salaryPremium) * SEVERANCE_QUARTERS, lng) })}
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

      <Panel title={t('staff.stars')} icon="star" className={s.span12}>
        <div className={s.cards}>
          {me.stars.map((star) => (
            <StarCard key={star.id} star={star} firm={me} game={game} />
          ))}
        </div>
      </Panel>

      <Panel title={t('staff.market')} icon="eye" className={s.span12}>
        {game.starMarket.length ? (
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
