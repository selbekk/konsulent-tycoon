import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SHADY_CATALOG,
  SHADY_IDS,
  averageMorale,
  detectionChance,
  headcount,
  isActive,
  openTenders,
  poachChance,
  riskLevel,
  shadyRepeatBlock,
  shadyUnlocked,
} from '../../engine'
import type { ShadyActionId, ShadyDef } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Hint, Modal, Panel, Slider } from '../components/ui'
import { formatMoney, formatPercent, formatQuarter } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

const CATEGORIES: ShadyDef['category'][] = ['espionage', 'outsourcing', 'cv', 'pr']

function HeatMeter({ heat }: { heat: number }) {
  const on = Math.round(heat / 10)
  return (
    <div className={s.heatMeter} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(heat)}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} data-on={i < on} />
      ))}
    </div>
  )
}

function ActionDialog({ actionId, onClose }: { actionId: ShadyActionId; onClose: (done: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const error = useGame((x) => x.error)
  const me = game.firms[game.playerId]
  const def = SHADY_CATALOG[actionId]
  const rivals = game.firmOrder.filter((id) => id !== me.id && !game.firms[id].bankrupt).map((id) => game.firms[id])
  const tenders = openTenders(game).filter((tn) =>
    def.requires.includes('ownBid') ? tn.bids.some((b) => b.firmId === me.id) : true,
  )
  const contracts = game.contracts.filter(
    (c) =>
      c.firmId === me.id &&
      !c.terminated &&
      c.endQuarter > game.quarter &&
      (actionId !== 'bait_and_switch' || (c.starIds.length > 0 && !c.fraud.baitAndSwitch)),
  )
  const [target, setTarget] = useState(rivals[0]?.id ?? '')
  const [tenderId, setTenderId] = useState(tenders[0]?.id ?? '')
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '')
  const targetStars = game.firms[target]?.stars.filter((x) => !x.founder) ?? []
  const [starId, setStarId] = useState('')
  const star = targetStars.find((x) => x.id === starId) ?? targetStars[0]
  const currentShare = game.contracts.find((c) => c.id === contractId)?.outsourcedShare ?? 0
  const [share, setShare] = useState(Math.round((currentShare || 0.4) * 100))
  const [confirming, setConfirming] = useState(false)

  const needs = def.requires
  const missing =
    (needs.includes('target') && !target) ||
    (needs.includes('tender') && !tenderId) ||
    (needs.includes('contract') && !contractId) ||
    (needs.includes('star') && !star)
  const repeat = shadyRepeatBlock(game, me, actionId, needs.includes('target') ? target : undefined)

  const run = () => {
    const err = dispatch({
      type: 'shady',
      firmId: me.id,
      actionId,
      targetFirmId: needs.includes('target') ? target : undefined,
      tenderId: needs.includes('tender') ? tenderId : undefined,
      contractId: needs.includes('contract') ? contractId : undefined,
      starId: needs.includes('star') ? star?.id : undefined,
      share: needs.includes('share') ? share / 100 : undefined,
    })
    playSound(err ? 'bad' : 'sneaky')
    if (!err) onClose(true)
    else setConfirming(false)
  }

  return (
    <Modal
      title={t(`content:shady.actions.${actionId}.name`)}
      icon="door"
      onClose={() => onClose(false)}
      actions={
        confirming ? (
          <>
            <Button onClick={() => setConfirming(false)}>{t('backroom.chicken')}</Button>
            <Button variant="danger" onClick={run}>
              {t('backroom.doIt')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => onClose(false)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              disabled={!!missing || !!repeat || me.cash < def.cost}
              onClick={() => setConfirming(true)}
            >
              {t('backroom.next')}
            </Button>
          </>
        )
      }
    >
      <div className={s.stack}>
        <p>{t(`content:shady.actions.${actionId}.desc`)}</p>
        {confirming ? (
          <p className={s.warn}>{t('backroom.confirm')}</p>
        ) : (
          <>
            {needs.includes('target') && (
              <div className={s.field}>
                <label htmlFor="shady-target">{t('backroom.target')}</label>
                <select
                  id="shady-target"
                  className={s.input}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {rivals.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {needs.includes('star') && (
              <div className={s.field}>
                <label htmlFor="shady-star">{t('backroom.star')}</label>
                {targetStars.length ? (
                  <select
                    id="shady-star"
                    className={s.input}
                    value={star?.id}
                    onChange={(e) => setStarId(e.target.value)}
                  >
                    {targetStars.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {t(`disciplines.${x.discipline}`)} {'★'.repeat(x.level)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Hint>{t('backroom.noStars')}</Hint>
                )}
                {star && (
                  <Hint>
                    {t('backroom.poachChance', {
                      pct: formatPercent(poachChance(game, me, game.firms[target], star.id), lng),
                    })}
                  </Hint>
                )}
              </div>
            )}
            {needs.includes('tender') && (
              <div className={s.field}>
                <label htmlFor="shady-tender">{t('backroom.tender')}</label>
                {tenders.length ? (
                  <select
                    id="shady-tender"
                    className={s.input}
                    value={tenderId}
                    onChange={(e) => setTenderId(e.target.value)}
                  >
                    {tenders.map((tn) => (
                      <option key={tn.id} value={tn.id}>
                        {t(`content:customers.${tn.customerId}.name`)} · {t(`tenders.kind.${tn.kind}`)} ·{' '}
                        {formatQuarter(tn.dueQuarter)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Hint>{t(needs.includes('ownBid') ? 'backroom.noOwnBids' : 'backroom.noTenders')}</Hint>
                )}
              </div>
            )}
            {needs.includes('contract') && (
              <div className={s.field}>
                <label htmlFor="shady-contract">{t('backroom.contract')}</label>
                {contracts.length ? (
                  <select
                    id="shady-contract"
                    className={s.input}
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                  >
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(`content:customers.${c.customerId}.name`)}{' '}
                        {c.outsourcedShare > 0 ? `(${Math.round(c.outsourcedShare * 100)} % offshore)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Hint>{t('backroom.noContracts')}</Hint>
                )}
              </div>
            )}
            {needs.includes('share') && (
              <Slider
                label={t('backroom.share')}
                value={share}
                min={0}
                max={80}
                step={10}
                onChange={setShare}
                display={`${share} %`}
                hint={t('backroom.shareHint')}
              />
            )}
            <div className={`${s.row} ${s.between}`}>
              <span>{t('backroom.cost', { cost: formatMoney(def.cost, lng) })}</span>
              <Badge
                tone={
                  riskLevel(me, actionId) === 'high' ? 'bad' : riskLevel(me, actionId) === 'medium' ? 'warn' : 'good'
                }
              >
                {t(`content:shady.risk.${riskLevel(me, actionId)}`)}
              </Badge>
            </div>
          </>
        )}
        {repeat && !confirming && !error && <Hint>{t(`game:${repeat}`)}</Hint>}
        {error && <p className={s.bad}>{t(`game:${error}`)}</p>}
      </div>
    </Modal>
  )
}

export function BackroomScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const clearError = useGame((x) => x.clearError)
  const me = game.firms[game.playerId]
  const [open, setOpen] = useState<ShadyActionId | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const intel = me.intel.filter((i) => i.untilQuarter >= game.quarter)
  const log = [...me.shadyLog].reverse().slice(0, 12)
  const outsourcing = game.contracts.filter(
    (c) => c.firmId === me.id && c.outsourcedShare > 0 && isActive(c, game.quarter),
  )

  return (
    <div className={s.noir}>
      <div className={s.grid}>
        <Panel title={t('backroom.title')} icon="door" className={s.span8}>
          <p className={s.small}>{t('backroom.intro')}</p>
          <div className={`${s.row} ${s.between}`} style={{ margin: '8px 0 16px' }}>
            <span>
              <strong>{t('backroom.heat')}</strong> {Math.round(me.heat)} / 100 ·{' '}
              <span className={s.muted}>
                {t('backroom.heatHint', {
                  pct: formatPercent(detectionChance(me, SHADY_CATALOG.rumor) - SHADY_CATALOG.rumor.baseDetection, lng),
                })}
              </span>
            </span>
            <HeatMeter heat={me.heat} />
          </div>
          {flash && <p className={s.good}>{flash}</p>}
          <div className={s.stack}>
            {CATEGORIES.map((cat) => (
              <section key={cat}>
                <h3 style={{ margin: '0 0 8px' }}>{t(`content:shady.categories.${cat}`)}</h3>
                <div className={s.cards}>
                  {SHADY_IDS.filter((id) => SHADY_CATALOG[id].category === cat).map((id) => {
                    const risk = riskLevel(me, id)
                    const locked = !shadyUnlocked(me, id)
                    return (
                      <article key={id} className={`${s.card} ${locked ? s.locked : ''}`}>
                        <strong>{t(`content:shady.actions.${id}.name`)}</strong>
                        <span className={s.small}>{t(`content:shady.actions.${id}.desc`)}</span>
                        <div className={`${s.row} ${s.between}`}>
                          <span className={s.small}>
                            {SHADY_CATALOG[id].cost ? formatMoney(SHADY_CATALOG[id].cost, lng) : t('backroom.free')}
                          </span>
                          <Badge tone={risk === 'high' ? 'bad' : risk === 'medium' ? 'warn' : 'good'}>
                            {t(`content:shady.risk.${risk}`)}
                          </Badge>
                        </div>
                        {locked ? (
                          <Button size="small" disabled>
                            {t('level.lockedHint', { level: SHADY_CATALOG[id].minLevel })}
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="danger"
                            onClick={() => {
                              clearError()
                              setFlash(null)
                              setOpen(id)
                            }}
                          >
                            {t('backroom.do')}
                          </Button>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <div className={`${s.span4} ${s.stack}`}>
          <Panel title={t('backroom.intel')} icon="eye">
            {intel.length === 0 ? (
              <p className={s.empty}>{t('backroom.noIntel')}</p>
            ) : (
              <ul className={s.newsList}>
                {intel.map((i, idx) => {
                  if (i.kind === 'bids') {
                    const tn = game.tenders.find((x) => x.id === i.tenderId)
                    return (
                      <li key={idx}>
                        <span className={s.newsDot} data-tone="sassy" />
                        <span>
                          {t('backroom.intelBids', {
                            customer: tn ? t(`content:customers.${tn.customerId}.name`) : '?',
                          })}
                        </span>
                      </li>
                    )
                  }
                  const f = game.firms[i.targetFirmId]
                  return (
                    <li key={idx}>
                      <span className={s.newsDot} data-tone="sassy" />
                      <span>
                        <strong>{f.name}</strong>
                        {i.kind === 'mole' && ` (${t('backroom.mole')})`}:{' '}
                        {t('backroom.intelFirm', {
                          morale: Math.round(averageMorale(f)),
                          premium: Math.round(f.budgets.salaryPremium * 100),
                          fag: Math.round(f.fagmiljo),
                          hc: headcount(f),
                        })}
                        {i.kind === 'mole' &&
                          ` ${t('backroom.intelMole', { cash: formatMoney(f.cash, lng), heat: Math.round(f.heat) })}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
          {outsourcing.length > 0 && (
            <Panel title={t('backroom.ongoing')} icon="flame">
              <ul className={s.newsList}>
                {outsourcing.map((c) => (
                  <li key={c.id}>
                    <span className={s.newsDot} data-tone="bad" />
                    <span>
                      {t('backroom.outsourcingAt', {
                        customer: t(`content:customers.${c.customerId}.name`),
                        pct: Math.round(c.outsourcedShare * 100),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={t('backroom.log')} icon="news">
            {log.length === 0 ? (
              <p className={s.empty}>{t('backroom.cleanRecord')}</p>
            ) : (
              <ul className={s.newsList}>
                {log.map((e) => (
                  <li key={e.id}>
                    <span className={s.newsDot} data-tone={e.detected ? 'bad' : 'good'} />
                    <span>
                      {formatQuarter(e.quarter)} · {t(`content:shady.actions.${e.actionId}.name`)} ·{' '}
                      <span className={e.detected ? s.bad : s.muted}>
                        {e.detected ? t('backroom.caught') : e.active ? t('backroom.active') : t('backroom.unnoticed')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      {open && (
        <ActionDialog
          actionId={open}
          onClose={(done) => {
            setOpen(null)
            if (done) setFlash(t('backroom.done'))
          }}
        />
      )}
    </div>
  )
}
