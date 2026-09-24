import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BILLABLE_HOURS,
  DISCIPLINES,
  PROMISES,
  MIN_AWARD_QUALITY,
  RATE_MAX,
  RATE_MIN,
  bidQuality,
  customerNeeds,
  customerWants,
  hasFeature,
  isKeyTender,
  disciplineLevel,
  effortCost,
  hasIntel,
  listRate,
  seatTotal,
  spendable,
  starBusyThrough,
} from '../../engine'
import type { Bid, PromiseId } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Hint, Modal, Slider } from '../components/ui'
import { formatMoney, formatQuarter } from '../format'
import { playSound } from '../sound'
import { bidChance, chanceTone } from './bidChance'
import s from './screens.module.css'
import { SeatBadges, WeightBar } from './TenderBoard'

export function BidForm({ tenderId }: { tenderId: string }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const openBid = useGame((x) => x.openBid)
  const openMinigame = useGame((x) => x.openMinigame)
  const error = useGame((x) => x.error)
  const me = game.firms[game.playerId]
  const tender = game.tenders.find((x) => x.id === tenderId)
  const existing = tender?.bids.find((b) => b.firmId === me.id)
  const [rate, setRate] = useState(existing?.rateMultiplier ?? 1)
  const budget = spendable(me)
  const costOf = (e: number) => Math.max(0, effortCost(e) - (existing ? effortCost(existing.effort) : 0))
  const affordable = (e: number) => costOf(e) === 0 || costOf(e) <= budget
  const [effort, setEffort] = useState<0 | 1 | 2 | 3>(existing?.effort ?? (affordable(1) ? 1 : 0))
  const [starIds, setStarIds] = useState<string[]>(existing?.starIds ?? [])
  const [promise, setPromise] = useState<PromiseId | undefined>(existing?.promise)

  const promisedElsewhere = useMemo(
    () =>
      new Set(
        game.tenders
          .filter((x) => x.id !== tenderId && !x.resolved)
          .flatMap((x) => x.bids.filter((b) => b.firmId === me.id).flatMap((b) => b.starIds)),
      ),
    [game.tenders, tenderId, me.id],
  )

  if (!tender) return null
  const key = isKeyTender(tender)
  const draft: Bid = {
    firmId: me.id,
    rateMultiplier: rate,
    starIds,
    effort,
    cvPad: existing?.cvPad ?? false,
    ghostCv: existing?.ghostCv ?? false,
    ...(key && promise ? { promise } : {}),
  }
  const wants = customerWants(tender.customerId)
  const { quality, tooWeak, chance } = bidChance(game, draft, tender)
  const revenue = DISCIPLINES.reduce(
    (sum, d) => sum + (tender.seats[d] ?? 0) * BILLABLE_HOURS * listRate(disciplineLevel(me, d)) * rate,
    0,
  )
  const effortDelta = costOf(effort)
  const canAfford = affordable(effort)
  const minigame = tender.minigameResults[me.id]
  const intel = hasIntel(game, me.id, 'bids', tender.id)
  const competitors = tender.bids.filter((b) => b.firmId !== me.id)

  const submit = () => {
    const err = dispatch({ type: 'placeBid', tenderId: tender.id, bid: draft })
    playSound(err ? 'bad' : 'confirm')
    if (!err) openBid(null)
  }
  const withdraw = () => {
    if (!dispatch({ type: 'withdrawBid', firmId: me.id, tenderId: tender.id })) openBid(null)
  }

  return (
    <Modal
      wide
      icon="briefcase"
      title={t('bid.title', { customer: t(`content:customers.${tender.customerId}.name`) })}
      onClose={() => openBid(null)}
      actions={
        <>
          {existing && (
            <Button variant="ghost" onClick={withdraw}>
              {t('bid.withdraw')}
            </Button>
          )}
          <Button onClick={() => openBid(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={!canAfford}>
            {existing ? t('bid.update') : t('bid.submit')}
          </Button>
        </>
      }
    >
      <div className={s.grid}>
        <div className={`${s.span7} ${s.stack}`}>
          <div className={s.row}>
            <Badge tone={tender.kind === 'framework' ? 'accent' : undefined}>{t(`tenders.kind.${tender.kind}`)}</Badge>
            <span className={s.small}>{t('tenders.duration', { count: tender.duration })}</span>
            {tender.kind === 'framework' && <span className={`${s.small} ${s.muted}`}>{t('bid.frameworkInfo')}</span>}
          </div>
          <SeatBadges tender={tender} game={game} />
          <WeightBar tender={tender} />

          <Slider
            label={t('bid.rate')}
            value={Math.round(rate * 100)}
            min={RATE_MIN * 100}
            max={RATE_MAX * 100}
            step={1}
            onChange={(v) => setRate(v / 100)}
            display={`×${rate.toFixed(2)} · ${formatMoney(listRate(3) * rate, lng, { compact: false })}${t('bid.perHour')}`}
            hint={t('bid.rateHint', { revenue: formatMoney(revenue, lng) })}
          />

          <div className={s.stackSm}>
            <span className={s.fieldLabel}>{t('bid.effort')}</span>
            <div className={s.segmented} role="group" aria-label={t('bid.effort')}>
              {([0, 1, 2, 3] as const).map((e) => (
                <button key={e} aria-pressed={effort === e} onClick={() => setEffort(e)} disabled={(existing && e < existing.effort) || !affordable(e)}>
                  {t(`bid.efforts.${e}`)}
                </button>
              ))}
            </div>
            <Hint>
              {t('bid.effortCost', { cost: formatMoney(effortCost(effort), lng) })}
              {effortDelta > Math.max(0, me.cash) && canAfford && ` ${t('bid.effortFromCredit')}`}
            </Hint>
            {!canAfford && <p className={s.bad}>{t('bid.cantAfford', { cost: formatMoney(effortDelta, lng) })}</p>}
          </div>

          <div className={s.stackSm}>
            <span className={s.fieldLabel}>{t('bid.stars')}</span>
            {me.stars.length === 0 && <Hint>{t('bid.noStars')}</Hint>}
            {me.stars.map((star) => {
              const promised = promisedElsewhere.has(star.id)
              const busyThrough = starBusyThrough(game, me, star.id, tender)
              // An already placed bid keeps its star so the player can still untick them.
              const busy = !starIds.includes(star.id) && (promised || busyThrough !== undefined)
              const relevant = (tender.seats[star.discipline] ?? 0) > 0
              return (
                <label key={star.id} className={s.checkRow} style={{ opacity: busy ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={starIds.includes(star.id)}
                    onChange={(e) => setStarIds((ids) => (e.target.checked ? [...ids, star.id] : ids.filter((x) => x !== star.id)))}
                  />
                  <span>
                    {star.name} · {t(`disciplines.${star.discipline}`)} {'★'.repeat(star.level)}
                    {!relevant && <span className={s.muted}> ({t('bid.notRelevant')})</span>}
                    {promised && <span className={s.muted}> ({t('bid.promised')})</span>}
                    {!promised && busyThrough !== undefined && (
                      <span className={s.muted}> ({t('bid.busyThrough', { quarter: formatQuarter(busyThrough) })})</span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>

          {key && (
            <div className={s.stackSm}>
              <span className={s.fieldLabel}>{t('bid.promise')}</span>
              <div className={s.promises} role="radiogroup" aria-label={t('bid.promise')}>
                {([undefined, ...PROMISES] as const).map((p) => {
                  const id = p ?? 'none'
                  return (
                    <label key={id} className={s.promiseOption} data-selected={promise === p || undefined}>
                      <input type="radio" name="promise" checked={promise === p} onChange={() => setPromise(p)} />
                      <span className={s.stackSm}>
                        <strong>
                          {t(`bid.promises.${id}.label`)}
                          {p && p === wants && <Badge tone="good">{t('bid.wanted')}</Badge>}
                        </strong>
                        <span className={s.small}>+ {t(`bid.promises.${id}.pro`)}</span>
                        <span className={`${s.small} ${s.muted}`}>− {t(`bid.promises.${id}.con`)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <Hint>{t('bid.promiseHint')}</Hint>
            </div>
          )}
        </div>

        <div className={`${s.span5} ${s.stack}`}>
          {key && (
            <div className={s.card}>
              <h3>{t('bid.needs')}</h3>
              <ul className={s.newsList}>
                {customerNeeds(game, tender, me.id).map((n) => (
                  <li key={n}>
                    <span className={s.newsDot} data-tone={n === 'styleUnknown' ? 'neutral' : 'sassy'} />
                    <span>{t(`bid.needItems.${n}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={s.card}>
            <h3>{t('bid.pitch')}</h3>
            {!key ? (
              <Hint>{t('bid.routineInfo')}</Hint>
            ) : minigame ? (
              <span>{minigame.provisional ? t('bid.pitchAbandoned') : t('bid.pitchDone', { score: minigame.score })}</span>
            ) : (
              <>
                <Hint>{t('bid.pitchHint')}</Hint>
                <div className={s.row}>
                  <Button icon="handshake" onClick={() => openMinigame({ tenderId: tender.id, kind: 'meeting' })}>
                    {t('minigames:meeting.title')}
                  </Button>
                  {hasFeature(me, 'bingo') && (
                    <Button icon="brain" onClick={() => openMinigame({ tenderId: tender.id, kind: 'bingo' })}>
                      {t('minigames:bingo.title')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className={s.card}>
            <h3>{t('bid.estimate')}</h3>
            <div className={`${s.row} ${s.between}`}>
              <span>{t('bid.quality')}</span>
              <strong className="num">{Math.round(quality)} / 100</strong>
            </div>
            <div className={`${s.row} ${s.between}`}>
              <span>{t('bid.chance')}</span>
              <Badge tone={chanceTone(chance)}>{t(`bid.chances.${chance}`)}</Badge>
            </div>
            {tooWeak && <p className={s.bad}>{t('bid.belowMinimum', { min: MIN_AWARD_QUALITY })}</p>}
            {(existing?.cvPad || existing?.ghostCv) && <Badge tone="bad">{t('bid.fraudActive')}</Badge>}
            <Hint>{t('bid.estimateHint')}</Hint>
          </div>

          {intel && (
            <div className={s.card}>
              <h3>{t('tenders.intel')}</h3>
              {competitors.length ? (
                <ul className={s.newsList}>
                  {competitors.map((b) => (
                    <li key={b.firmId}>
                      <span className={s.newsDot} data-tone="sassy" />
                      <span>
                        {game.firms[b.firmId].name}: ×{b.rateMultiplier.toFixed(2)} · {t('tenders.qualityShort', { q: Math.round(bidQuality(game, b, tender)) })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Hint>{t('tenders.noCompetitors')}</Hint>
              )}
            </div>
          )}
          {error && <p className={s.bad}>{t(`game:${error}`)}</p>}
          <p className={`${s.small} ${s.muted}`}>{t('bid.seatsTotal', { count: seatTotal(tender.seats) })}</p>
        </div>
      </div>
    </Modal>
  )
}
