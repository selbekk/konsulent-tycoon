import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CUSTOMER_MAP, CUSTOMER_METRICS } from '../../content/customers'
import { NEEDS_STYLE_RELATION, activeContracts, customerAppeal, relationship } from '../../engine'
import type { GameState } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Meter, Modal } from '../components/ui'
import s from './screens.module.css'

/** 1–5 as filled squares. */
export function Pips({ value, label }: { value: number; label: string }) {
  const { t } = useTranslation()
  return (
    <span className={s.pips} role="img" aria-label={`${label}: ${t('customer.outOf', { value })}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} data-on={i <= value || undefined} />
      ))}
    </span>
  )
}

/** priceWeight 0.35–0.9 and budgetFactor 0.6–1.4 as 1–5, for the profile. */
const priceFocus = (w: number) => Math.max(1, Math.min(5, Math.round((w - 0.3) / 0.12) + 1))
const budgetLevel = (f: number) => Math.max(1, Math.min(5, Math.round((f - 0.6) / 0.2) + 1))

export function CustomerProfileModal({
  game,
  customerId,
  onClose,
}: {
  game: GameState
  customerId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const def = CUSTOMER_MAP[customerId]
  const customer = game.customers[customerId]
  if (!def || !customer) return null
  const rel = relationship(game, customerId, game.playerId)
  const mine = activeContracts(game, game.playerId).filter((c) => c.customerId === customerId).length
  const rows: [string, number][] = [
    ...CUSTOMER_METRICS.map((m) => [m, def.profile[m]] as [string, number]),
    ['priceFocus', priceFocus(def.priceWeight)],
    ['budget', budgetLevel(def.budgetFactor)],
  ]
  return (
    <Modal title={t(`content:customers.${customerId}.name`)} icon="briefcase" onClose={onClose} wide>
      <div className={s.stack}>
        <p className={s.muted} style={{ margin: 0 }}>
          <em>{t(`content:customers.${customerId}.blurb`)}</em>
        </p>
        <p style={{ margin: 0 }}>{t(`content:customers.${customerId}.about`)}</p>
        <div className={s.seats}>
          <Badge>{t(`tenders.sector.${def.sector}`)}</Badge>
          {def.favours.map((d) => (
            <Badge key={d} tone="info">
              {t(`disciplines.${d}`)}
            </Badge>
          ))}
        </div>
        <dl className={s.profile}>
          {rows.map(([m, v]) => (
            <div key={m}>
              <dt>{t(`customer.metrics.${m}.label`)}</dt>
              <dd>
                <Pips value={v} label={t(`customer.metrics.${m}.label`)} />
                <span className={`${s.small} ${s.muted}`}>{t(`customer.metrics.${m}.hint`)}</span>
              </dd>
            </div>
          ))}
        </dl>
        <Meter label={t('customer.appeal')} value={customerAppeal(def)} />
        <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
          {t('customer.appealHint')}
        </p>
        <div className={s.stackSm}>
          <span className={s.small}>{t(`bid.needItems.${def.wants}`)}</span>
          <span className={s.small}>
            {rel >= NEEDS_STYLE_RELATION
              ? t(`bid.needItems.${def.meetingPreference}`)
              : t('bid.needItems.styleUnknown')}
          </span>
          <span className={s.small}>
            {t('customer.relation', { value: Math.round(rel) })} · {t('customer.contracts', { count: mine })}
          </span>
        </div>
      </div>
    </Modal>
  )
}

/** A customer's name that opens their profile. */
export function CustomerName({ id, strong }: { id: string; strong?: boolean }) {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)
  const [open, setOpen] = useState(false)
  const name = t(`content:customers.${id}.name`)
  return (
    <>
      <button
        type="button"
        className={s.newsLink}
        onClick={() => setOpen(true)}
        aria-label={t('customer.open', { customer: name })}
      >
        {strong ? <strong>{name}</strong> : name}
      </button>
      {/* Portalled: tender cards and table rows may be dimmed or animated, which would trap the modal inside them. */}
      {open &&
        game &&
        createPortal(
          <CustomerProfileModal game={game} customerId={id} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}
