import { useTranslation } from 'react-i18next'
import { BUDGET_MAX_PER_HEAD, PREMIUM_MAX, PREMIUM_MIN, acceptRate, cultureEquilibrium, employerBrand, headcount, moraleTarget, portfolioBrand, quarterFinancials, salaryCost } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Meter, Panel, Slider, Stat } from '../components/ui'
import { formatMoney, formatPercent } from '../format'
import s from './screens.module.css'

function budgetHint(v: number) {
  if (v === 0) return 'zero'
  if (v < 8_000) return 'low'
  if (v < 20_000) return 'mid'
  if (v < 30_000) return 'high'
  return 'max'
}

export function CultureScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const hc = headcount(me)
  const b = me.budgets
  const fin = quarterFinancials(game, me.id)
  const brandFromCustomers = portfolioBrand(game, me)
  const set = (budgets: Partial<typeof b>) => dispatch({ type: 'setBudgets', firmId: me.id, budgets })

  return (
    <div className={s.grid}>
      <Panel title={t('culture.budgets')} icon="coffee" className={s.span7}>
        <div className={s.stack}>
          <Slider
            label={t('culture.fagmiljo')}
            value={b.fagmiljoPerHead}
            min={0}
            max={BUDGET_MAX_PER_HEAD}
            step={1000}
            onChange={(v) => set({ fagmiljoPerHead: v })}
            display={t('culture.perHead', { amount: formatMoney(b.fagmiljoPerHead, lng) })}
            hint={`${t(`culture.fagHints.${budgetHint(b.fagmiljoPerHead)}`)} ${t('culture.equilibrium', { level: Math.round(cultureEquilibrium(b.fagmiljoPerHead)) })}`}
          />
          <Slider
            label={t('culture.sosialt')}
            value={b.sosialtPerHead}
            min={0}
            max={BUDGET_MAX_PER_HEAD}
            step={1000}
            onChange={(v) => set({ sosialtPerHead: v })}
            display={t('culture.perHead', { amount: formatMoney(b.sosialtPerHead, lng) })}
            hint={`${t(`culture.sosHints.${budgetHint(b.sosialtPerHead)}`)} ${t('culture.equilibrium', { level: Math.round(cultureEquilibrium(b.sosialtPerHead)) })}`}
          />
          <Slider
            label={t('culture.salary')}
            value={Math.round(b.salaryPremium * 100)}
            min={PREMIUM_MIN * 100}
            max={PREMIUM_MAX * 100}
            step={1}
            onChange={(v) => set({ salaryPremium: v / 100 })}
            display={`${b.salaryPremium > 0 ? '+' : ''}${Math.round(b.salaryPremium * 100)} %`}
            hint={t(b.salaryPremium < 0 ? 'culture.salaryHints.low' : b.salaryPremium >= 0.1 ? 'culture.salaryHints.high' : 'culture.salaryHints.mid')}
          />
        </div>
      </Panel>

      <Panel title={t('culture.effect')} icon="chart" className={s.span5}>
        <div className={s.stack}>
          <Meter label={t('culture.fagmiljoLevel')} value={me.fagmiljo} />
          <Meter label={t('culture.sosialtLevel')} value={me.sosialt} />
          <Meter label={t('culture.brand')} value={employerBrand(game, me)} />
          <span className={`${s.small} ${s.muted}`}>{t('customer.portfolio', { value: `${brandFromCustomers >= 0 ? '+' : '−'}${Math.abs(Math.round(brandFromCustomers))}` })}</span>
          <div className={s.kpis}>
            <Stat label={t('culture.cultureCost')} value={formatMoney(fin.cultureCost, lng)} />
            <Stat label={t('culture.salaryCost')} value={formatMoney(salaryCost(me), lng)} />
            <Stat label={t('culture.acceptRate')} value={formatPercent(acceptRate(game, me), lng)} />
            <Stat label={t('culture.moraleTarget')} value={Math.round(moraleTarget(me, fin.utilization))} />
          </div>
          <p className={`${s.small} ${s.muted}`}>{t('culture.explain', { hc })}</p>
        </div>
      </Panel>
    </div>
  )
}
