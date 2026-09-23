import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DISCIPLINES, contractRevenue, isActive, seatTotal, staffFirm } from '../../engine'
import type { Contract } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Meter, Panel } from '../components/ui'
import { ContractActions } from './ContractActions'
import { formatMoney, formatQuarter } from '../format'
import s from './screens.module.css'

export function ContractsScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const [open, setOpen] = useState<Contract | null>(null)
  const me = game.firms[game.playerId]
  const staffing = staffFirm(game, me)
  const byContract = new Map(staffing.contracts.map((c) => [c.contractId, c]))
  const mine = game.contracts
    .filter((c) => c.firmId === me.id && !c.terminated && c.endQuarter > game.quarter)
    .sort((a, b) => a.endQuarter - b.endQuarter)
  const ended = game.contracts.filter((c) => c.firmId === me.id && (c.terminated || c.endQuarter <= game.quarter)).slice(-6)

  return (
    <div className={s.stack}>
      <Panel title={t('contracts.title')} icon="handshake">
        {mine.length === 0 ? (
          <p className={s.empty}>{t('contracts.none')}</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('contracts.customer')}</th>
                  <th>{t('contracts.seats')}</th>
                  <th className={s.num}>{t('contracts.rate')}</th>
                  <th className={s.num}>{t('contracts.revenue')}</th>
                  <th style={{ minWidth: 120 }}>{t('contracts.satisfaction')}</th>
                  <th>{t('contracts.period')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((c) => {
                  const active = isActive(c, game.quarter)
                  const st = byContract.get(c.id)
                  const freelance = st ? seatTotal(st.freelance) : 0
                  const offshore = st ? seatTotal(st.offshore) : 0
                  const flex = st ? seatTotal(st.flex) : 0
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{t(`content:customers.${c.customerId}.name`)}</strong>
                        <div className={s.row}>
                          <Badge tone={c.kind === 'framework' ? 'accent' : undefined}>
                            {c.kind === 'framework' ? t('contracts.frameworkRank', { rank: c.rank }) : t('tenders.kind.project')}
                          </Badge>
                          {!active && <Badge tone="info">{t('contracts.upcoming')}</Badge>}
                          {c.outsourcedShare > 0 && <Badge tone="bad">{t('contracts.offshore', { pct: Math.round(c.outsourcedShare * 100) })}</Badge>}
                          {(c.fraud.cvPad || c.fraud.ghostCv || c.fraud.baitAndSwitch) && <Badge tone="bad">{t('contracts.fraud')}</Badge>}
                        </div>
                        <Button size="small" onClick={() => setOpen(c)} aria-label={t('contracts.actions.openFor', { customer: t(`content:customers.${c.customerId}.name`) })}>
                          {t('contracts.actions.open')}
                        </Button>
                      </td>
                      <td>
                        <div className={s.seats}>
                          {DISCIPLINES.filter((d) => c.activeSeats[d]).map((d) => (
                            <Badge key={d}>
                              {c.activeSeats[d]}× {t(`disciplines.${d}`)}
                            </Badge>
                          ))}
                        </div>
                        {active && (freelance > 0 || offshore > 0 || flex > 0) && (
                          <span className={`${s.small} ${s.warn}`}>
                            {flex > 0 && t('contracts.flexSeats', { count: flex })} {freelance > 0 && t('contracts.freelancers', { count: freelance })}{' '}
                            {offshore > 0 && t('contracts.offshoreSeats', { count: offshore })}
                          </span>
                        )}
                      </td>
                      <td className={s.num}>×{c.rateMultiplier.toFixed(2)}</td>
                      <td className={s.num}>{active ? formatMoney(contractRevenue(me, c, st), lng) : '–'}</td>
                      <td>
                        <Meter label="" value={c.satisfaction} />
                      </td>
                      <td className={s.small}>
                        {formatQuarter(c.startQuarter)} – {formatQuarter(c.endQuarter - 1)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className={`${s.small} ${s.muted}`}>{t('contracts.explain')}</p>
      </Panel>
      {ended.length > 0 && (
        <Panel title={t('contracts.history')} icon="calendar">
          <ul className={s.newsList}>
            {ended.map((c) => (
              <li key={c.id}>
                <span className={s.newsDot} data-tone={c.cancelled ? 'neutral' : c.terminated ? 'bad' : 'good'} />
                <span>
                  {t(`content:customers.${c.customerId}.name`)} · {c.cancelled ? t('contracts.cancelled') : c.terminated ? t('contracts.terminated') : t('contracts.completed')} ·{' '}
                  {t('contracts.finalSatisfaction', { value: Math.round(c.satisfaction) })}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {open && <ContractActions contract={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
