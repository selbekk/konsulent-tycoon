import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISCIPLINES,
  SMALL_TENDER_MAX_SEATS,
  bidQuality,
  capacity,
  disciplineSupply,
  hasIntel,
  isKeyTender,
  openTenders,
  quickBid,
  seatTotal,
  staffFirm,
  tenderLevel,
  tenderLock,
} from '../../engine'
import type { GameState, Tender } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Panel } from '../components/ui'
import { formatQuarter } from '../format'
import { playSound } from '../sound'
import { BenchView } from './Bench'
import { bidChance, chanceTone } from './bidChance'
import s from './screens.module.css'

export function SeatBadges({ tender, game }: { tender: Tender; game: GameState }) {
  const { t } = useTranslation()
  const me = game.firms[game.playerId]
  const committed = staffFirm(game, me, tender.dueQuarter + 1).demand
  return (
    <div className={s.seats}>
      {DISCIPLINES.filter((d) => tender.seats[d]).map((d) => {
        const free = Math.max(0, disciplineSupply(me, d) - (committed[d] ?? 0))
        const n = tender.seats[d]!
        return (
          <span key={d} title={t('tenders.freeHint', { free })}>
            <Badge tone={free >= n ? 'good' : free > 0 ? 'warn' : undefined}>
              {n}× {t(`disciplines.${d}`)}
            </Badge>
          </span>
        )
      })}
    </div>
  )
}

export function WeightBar({ tender }: { tender: Tender }) {
  const { t } = useTranslation()
  return (
    <div>
      <div className={`${s.row} ${s.between} ${s.small}`}>
        <span>{t('tenders.price', { pct: Math.round(tender.priceWeight * 100) })}</span>
        <span>{t('tenders.quality', { pct: Math.round(tender.qualityWeight * 100) })}</span>
      </div>
      <div className={s.bar} aria-hidden>
        <span style={{ width: `${tender.priceWeight * 100}%`, background: 'var(--warn)' }} />
        <span style={{ flex: 1, background: 'var(--info)' }} />
      </div>
    </div>
  )
}

/** One-click standard offer on routine tenders, with the same estimate the bid form shows. */
function QuickBid({ tender, game, onCustomise }: { tender: Tender; game: GameState; onCustomise: () => void }) {
  const { t } = useTranslation()
  const dispatch = useGame((x) => x.dispatch)
  const offer = quickBid(game, game.playerId, tender)
  const { quality, tooWeak, chance } = bidChance(game, offer, tender)
  return (
    <div className={s.stackSm}>
      <span className={s.small}>
        {t('tenders.quickBidHint', { rate: offer.rateMultiplier.toFixed(2) })} · {t('tenders.qualityShort', { q: Math.round(quality) })}{' '}
        <Badge tone={chanceTone(chance)}>{t(`bid.chances.${chance}`)}</Badge>
      </span>
      {tooWeak && <span className={`${s.small} ${s.bad}`}>{t('tenders.quickBidTooWeak')}</span>}
      <div className={`${s.row} ${s.between}`}>
        <Button
          variant="primary"
          disabled={tooWeak}
          onClick={() => playSound(dispatch({ type: 'placeBid', tenderId: tender.id, bid: offer }) ? 'bad' : 'confirm')}
        >
          {t('tenders.quickBid')}
        </Button>
        <Button size="small" onClick={onCustomise}>
          {t('tenders.customise')}
        </Button>
      </div>
    </div>
  )
}

type Filter = 'all' | 'mine' | 'fits'

export function TenderBoard() {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)!
  const openBid = useGame((x) => x.openBid)
  const [filter, setFilter] = useState<Filter>('all')
  const me = game.firms[game.playerId]
  const all = openTenders(game).sort((a, b) => a.dueQuarter - b.dueQuarter || seatTotal(a.seats) - seatTotal(b.seats))
  const fits = (tn: Tender) => {
    if (tenderLock(me, tn)) return false
    const committed = staffFirm(game, me, tn.dueQuarter + 1).demand
    const free = DISCIPLINES.reduce((sum, d) => sum + Math.min(tn.seats[d] ?? 0, Math.max(0, disciplineSupply(me, d) - (committed[d] ?? 0))), 0)
    return free / seatTotal(tn.seats) >= 0.5
  }
  // Tenders the firm is too small for stay off the board, so a new player sees only what they can act on.
  const tooBig = all.filter((tn) => !tn.bids.some((b) => b.firmId === me.id) && tenderLock(me, tn))
  const shown = all
    .filter((tn) => !tooBig.includes(tn))
    .filter((tn) => (filter === 'mine' ? tn.bids.some((b) => b.firmId === me.id) : filter === 'fits' ? fits(tn) : true))

  return (
    <div className={s.stack}>
      <Panel title={t('bench.title')} icon="people">
        <BenchView game={game} />
      </Panel>
      <Panel
        title={t('tenders.title')}
        icon="briefcase"
        actions={
          <div className={s.segmented} role="group" aria-label={t('tenders.filter')}>
            {(['all', 'fits', 'mine'] as Filter[]).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {t(`tenders.filters.${f}`)}
              </button>
            ))}
          </div>
        }
      >
        <p className={`${s.small} ${s.muted}`}>{t('tenders.intro')}</p>
        {(() => {
          const cap = capacity(game, me.id)
          return (
            <p className={s.small}>
              <strong>{t('capacity.next')}:</strong>{' '}
              {t('tenders.capacityLine', { free: cap.next.offered + cap.next.idle, offered: cap.next.offered, idle: cap.next.idle, seats: cap.next.seatsInBids, later: cap.next.laterSeatsInBids })}
            </p>
          )
        })()}
        {tooBig.length > 0 && (
          <p className={`${s.small} ${s.muted}`}>{t('level.hiddenTenders', { count: tooBig.length, level: Math.min(...tooBig.map(tenderLevel)) })}</p>
        )}
        {shown.length === 0 ? (
          <p className={s.empty}>{t('tenders.none')}</p>
        ) : (
          <div className={s.cards}>
            {shown.map((tn) => {
              const myBid = tn.bids.find((b) => b.firmId === me.id)
              const customer = game.customers[tn.customerId]
              const intel = hasIntel(game, me.id, 'bids', tn.id)
              const lastChance = tn.dueQuarter === game.quarter
              return (
                <article key={tn.id} className={s.card}>
                  <div className={`${s.row} ${s.between}`}>
                    <strong>{t(`content:customers.${tn.customerId}.name`)}</strong>
                    <span className={s.row} style={{ gap: 4 }}>
                      {isKeyTender(tn) && <Badge tone="warn">{t('tenders.key')}</Badge>}
                      {seatTotal(tn.seats) <= SMALL_TENDER_MAX_SEATS && <Badge tone="good">{t('tenders.small')}</Badge>}
                      <Badge tone={tn.kind === 'framework' ? 'accent' : undefined}>{t(`tenders.kind.${tn.kind}`)}</Badge>
                    </span>
                  </div>
                  <span className={`${s.small} ${s.muted}`}>
                    {t(`tenders.sector.${customer.sector}`)} · {t('tenders.duration', { count: tn.duration })} ·{' '}
                    {t('tenders.relation', { value: Math.round(customer.relationships[me.id] ?? 20) })}
                  </span>
                  <SeatBadges tender={tn} game={game} />
                  <WeightBar tender={tn} />
                  <span className={`${s.small} ${lastChance ? s.warn : s.muted}`}>
                    {lastChance ? t('tenders.lastChance') : t('tenders.due', { quarter: formatQuarter(tn.dueQuarter) })}
                  </span>
                  {intel && (
                    <span className={s.small}>
                      <Badge tone="bad">{t('tenders.intel')}</Badge>{' '}
                      {tn.bids.filter((b) => b.firmId !== me.id).length
                        ? tn.bids
                            .filter((b) => b.firmId !== me.id)
                            .map((b) => `${game.firms[b.firmId].name} ${b.rateMultiplier.toFixed(2)}`)
                            .join(', ')
                        : t('tenders.noCompetitors')}
                    </span>
                  )}
                  {myBid ? (
                    <div className={`${s.row} ${s.between}`}>
                      <span className={s.small}>
                        <Badge tone="good">{t('tenders.bidPlaced')}</Badge> ×{myBid.rateMultiplier.toFixed(2)} · {t('tenders.qualityShort', { q: Math.round(bidQuality(game, myBid, tn)) })}
                      </span>
                      <Button size="small" onClick={() => openBid(tn.id)}>
                        {t('tenders.edit')}
                      </Button>
                    </div>
                  ) : isKeyTender(tn) ? (
                    <Button variant="primary" onClick={() => openBid(tn.id)}>
                      {t('tenders.bid')}
                    </Button>
                  ) : (
                    <QuickBid tender={tn} game={game} onCustomise={() => openBid(tn.id)} />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
