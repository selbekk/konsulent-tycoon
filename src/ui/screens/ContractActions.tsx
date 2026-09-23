import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISCIPLINES,
  FEATURE_LEVEL,
  NURTURE_MAX_SATISFACTION,
  NURTURE_SATISFACTION,
  RATE_MAX,
  RENEGOTIATE_RATE_GAIN,
  UPSELL_COOLDOWN,
  cancelFee,
  contractMoveBlock,
  disciplineSupply,
  hasFeature,
  nurtureCost,
  renegotiateChance,
  staffFirm,
  upsellChance,
  upsellRoom,
} from '../../engine'
import type { Contract, ContractMove, Discipline, Feature } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal, Stepper } from '../components/ui'
import { formatMoney, formatPercent } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

/** What you can do with a signed contract: care, renegotiate, upsell, cancel. */
export function ContractActions({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  // Read the live contract so outcomes show up right after an action.
  const c = game.contracts.find((x) => x.id === contract.id) ?? contract
  const customer = t(`content:customers.${c.customerId}.name`)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string>()

  const demand = staffFirm(game, me).demand
  const bench = (d: Discipline) => Math.max(0, disciplineSupply(me, d) - (demand[d] ?? 0))
  const benchDisciplines = DISCIPLINES.filter((d) => bench(d) > 0)
  const [discipline, setDiscipline] = useState<Discipline>(benchDisciplines[0] ?? DISCIPLINES.find((d) => c.activeSeats[d]) ?? 'backend')
  const room = upsellRoom(me, c)
  const [count, setCount] = useState(1)
  const seats = Math.max(1, Math.min(count, room))

  const act = (move: ContractMove) => {
    const base = { firmId: me.id, contractId: c.id }
    const err = dispatch(
      move === 'renegotiate'
        ? { type: 'renegotiateContract', ...base }
        : move === 'cancel'
          ? { type: 'cancelContract', ...base }
          : move === 'nurture'
            ? { type: 'nurtureContract', ...base }
            : { type: 'upsellContract', ...base, discipline, count: seats },
    )
    setError(err)
    if (err) return playSound('bad')
    const after = useGame.getState().game!.contracts.find((x) => x.id === c.id)
    const won = move === 'renegotiate' ? after?.renegotiated === 'won' : move === 'upsell' ? after?.upsell?.won : true
    playSound(won ? 'confirm' : 'bad')
    if (move === 'cancel') onClose()
  }

  const blocked = (move: ContractMove) => contractMoveBlock(game, me, c, move, seats)
  const reason = (move: ContractMove) => {
    const err = blocked(move)
    return err && err !== 'errors.levelTooLow' ? <p className={`${s.small} ${s.muted}`}>{t(`game:${err}`)}</p> : null
  }
  const locked = (feature: Feature) =>
    hasFeature(me, feature) ? null : <p className={`${s.small} ${s.muted}`}>{t('strategy.locked', { level: FEATURE_LEVEL[feature] })}</p>

  return (
    <Modal icon="handshake" title={customer} onClose={onClose}>
      <div className={s.stack}>
        <section className={s.card}>
          <h3>{t('contracts.actions.nurture.title')}</h3>
          <p className={s.small}>
            {t('contracts.actions.nurture.body', { points: NURTURE_SATISFACTION, max: NURTURE_MAX_SATISFACTION })}
          </p>
          <div className={s.row}>
            <Button onClick={() => act('nurture')} disabled={!!blocked('nurture')}>
              {t('contracts.actions.nurture.go', { cost: formatMoney(nurtureCost(me, c), lng) })}
            </Button>
          </div>
          {c.nurtureQuarter === game.quarter ? <p className={`${s.small} ${s.good}`}>{t('contracts.actions.nurture.done')}</p> : reason('nurture')}
        </section>

        <section className={s.card}>
          <h3>{t('contracts.actions.renegotiate.title')}</h3>
          {locked('renegotiate') ?? (
            <>
              <p className={s.small}>
                {t('contracts.actions.renegotiate.body', {
                  from: c.rateMultiplier.toFixed(2),
                  to: Math.min(RATE_MAX, c.rateMultiplier + RENEGOTIATE_RATE_GAIN).toFixed(2),
                })}
              </p>
              {c.renegotiated ? (
                <p className={`${s.small} ${c.renegotiated === 'won' ? s.good : s.bad}`}>{t(`contracts.actions.renegotiate.${c.renegotiated}`)}</p>
              ) : (
                <>
                  <div className={s.row}>
                    <Button onClick={() => act('renegotiate')} disabled={!!blocked('renegotiate')}>
                      {t('contracts.actions.renegotiate.go', { chance: formatPercent(renegotiateChance(game, c), lng) })}
                    </Button>
                  </div>
                  {reason('renegotiate')}
                </>
              )}
            </>
          )}
        </section>

        <section className={s.card}>
          <h3>{t('contracts.actions.upsell.title')}</h3>
          {locked('upsell') ?? (
            <>
              <p className={s.small}>{t('contracts.actions.upsell.body', { quarters: UPSELL_COOLDOWN })}</p>
              {c.upsell && c.upsell.quarter === game.quarter ? (
                <p className={`${s.small} ${c.upsell.won ? s.good : s.bad}`}>
                  {t(c.upsell.won ? 'contracts.actions.upsell.won' : 'contracts.actions.upsell.lost', { count: c.upsell.seats })}
                </p>
              ) : (
                <>
                  {c.kind === 'project' && room > 0 && (
                    <div className={s.row}>
                      <div className={s.field}>
                        <label htmlFor="upsell-discipline">{t('contracts.actions.upsell.discipline')}</label>
                        <select
                          id="upsell-discipline"
                          className={s.input}
                          value={discipline}
                          onChange={(e) => setDiscipline(e.target.value as Discipline)}
                        >
                          {DISCIPLINES.map((d) => (
                            <option key={d} value={d}>
                              {t(`disciplines.${d}`)} · {t('contracts.actions.upsell.free', { count: bench(d) })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={s.field}>
                        <span className={s.fieldLabel}>{t('contracts.actions.upsell.seats')}</span>
                        <Stepper value={seats} min={1} max={room} onChange={setCount} label={t('contracts.actions.upsell.seats')} />
                      </div>
                    </div>
                  )}
                  <div className={s.row}>
                    <Button onClick={() => act('upsell')} disabled={!!blocked('upsell')}>
                      {t('contracts.actions.upsell.go', { chance: formatPercent(upsellChance(c, seats), lng) })}
                    </Button>
                  </div>
                  {reason('upsell')}
                </>
              )}
            </>
          )}
        </section>

        <section className={s.card}>
          <h3>{t('contracts.actions.cancel.title')}</h3>
          <p className={s.small}>{t('contracts.actions.cancel.body', { fee: formatMoney(cancelFee(me, c), lng) })}</p>
          <div className={s.row}>
            {confirmCancel ? (
              <>
                <Button onClick={() => setConfirmCancel(false)}>{t('common.cancel')}</Button>
                <Button variant="danger" onClick={() => act('cancel')} disabled={!!blocked('cancel')}>
                  {t('contracts.actions.cancel.confirm', { customer })}
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={!!blocked('cancel')}>
                {t('contracts.actions.cancel.go')}
              </Button>
            )}
          </div>
          {reason('cancel')}
        </section>

        {error && <p className={s.bad}>{t(`game:${error}`)}</p>}
      </div>
    </Modal>
  )
}
