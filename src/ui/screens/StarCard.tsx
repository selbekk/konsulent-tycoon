import { useTranslation } from 'react-i18next'
import { ambitionMet, headcount, starSigningCost } from '../../engine'
import type { Firm, GameState, Star } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Levels } from '../components/Levels'
import { Portrait } from '../components/Portrait'
import { Badge, Button, Meter } from '../components/ui'
import { formatMoney, formatPercent } from '../format'
import s from './screens.module.css'

export function StarCard({ star, firm, game, market }: { star: Star; firm: Firm; game: GameState; market?: boolean }) {
  const { t, i18n } = useTranslation()
  const dispatch = useGame((x) => x.dispatch)
  const contract = star.assignedContractId ? game.contracts.find((c) => c.id === star.assignedContractId) : undefined
  const met = ambitionMet(firm, star, headcount(firm))
  const cost = starSigningCost(star, firm)
  const mentee = firm.roster?.find((e) => e.mentorStarId === star.id)
  return (
    <article className={s.card}>
      <div className={s.cardTitle}>
        <Portrait seed={star.id} size={32} />
        <span>{star.name}</span>
        {star.founder && <Badge tone="accent">{t('staff.founder')}</Badge>}
        {star.homegrown && <Badge tone="good">{t('staff.homegrown')}</Badge>}
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
        {!market && !star.founder && (
          <span className={met ? s.good : s.bad}> · {met ? t('staff.ambitionMet') : t('staff.ambitionUnmet')}</span>
        )}
      </span>
      {!market && (
        <>
          <Meter label={t('staff.morale')} value={star.morale} />
          {!star.founder && <Meter label={t('staff.loyalty')} value={star.loyalty} />}
          {mentee && <span className={s.small}>{t('staff.mentoring', { name: mentee.name })}</span>}
          <span className={`${s.small} ${s.muted}`}>
            {contract
              ? t('staff.assignedTo', { customer: t(`content:customers.${contract.customerId}.name`) })
              : t('staff.unassigned')}
          </span>
        </>
      )}
      <span className={`${s.small} ${s.muted}`}>
        {t('staff.premium', { premium: formatPercent(star.salaryPremium, i18n.language) })}
      </span>
      {market ? (
        <Button
          variant="primary"
          size="small"
          disabled={firm.cash < cost}
          onClick={() => dispatch({ type: 'hireStar', firmId: firm.id, starId: star.id })}
        >
          {t('staff.hireStar', { cost: formatMoney(cost, i18n.language) })}
        </Button>
      ) : (
        !star.founder && (
          <Button
            size="small"
            onClick={() => dispatch({ type: 'giveRaise', firmId: firm.id, starId: star.id, amount: 0.05 })}
          >
            {t('staff.raise')}
          </Button>
        )
      )}
    </article>
  )
}
