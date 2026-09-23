import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEPARTMENTS, PARTNERSHIPS } from '../../content/strategy'
import {
  IPO_SHARE,
  ipoProceeds,
  ACADEMY_MAX_LEVEL,
  ACQUIRE_MAX_SIZE_RATIO,
  acquisitionBlock,
  acquisitionPrice,
  FEATURE_LEVEL,
  FREELANCER_MARKUP,
  NEARSHORE_FREELANCER_MARKUP,
  SALES_BID_BONUS,
  departmentFee,
  headcount,
  LOBBY_COOLDOWN,
  LOBBY_COST,
  LOBBY_RELATION,
  MAX_PARTNERSHIPS,
  PARTNER_BONUS,
  SPECIALTIES,
  SPECIALTY_CHANGE_COST,
  SPECIALTY_DISCIPLINE_BONUS,
  SPECIALTY_SECTOR_BONUS,
  hasFeature,
  lobbyReadyIn,
  specialtyChangeCost,
} from '../../engine'
import type { Feature, Firm, Specialty } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, FirmGlyph, Hint, Modal, Panel } from '../components/ui'
import { firmColors } from '../firms'
import { formatMoney, formatPercent, formatQuarter } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

function specialtyName(t: (k: string) => string, sp: Specialty) {
  return sp === 'public' || sp === 'private' ? t(`strategy.specialty.${sp}`) : t(`disciplines.${sp}`)
}

/** A section that only opens at a level: shown as a teaser until then. */
function Locked({ firm, feature, children }: { firm: Firm; feature: Feature; children: React.ReactNode }) {
  const { t } = useTranslation()
  if (hasFeature(firm, feature)) return <>{children}</>
  return <p className={s.empty}>{t('strategy.locked', { level: FEATURE_LEVEL[feature] })}</p>
}

export function StrategyScreen() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const error = useGame((x) => x.error)
  const me = game.firms[game.playerId]
  const run = (action: Parameters<typeof dispatch>[0]) => playSound(dispatch(action) ? 'bad' : 'confirm')
  const changeCost = specialtyChangeCost(me)
  const partners = me.partnerships ?? []
  const lobbyWait = lobbyReadyIn(game, me)
  const departments = me.departments ?? []
  const [buying, setBuying] = useState<string | null>(null)
  const [listing, setListing] = useState(false)
  const proceeds = formatMoney(ipoProceeds(me), lng)
  const targets = game.firmOrder
    .map((id) => game.firms[id])
    .filter((f) => !f.isPlayer && !f.bankrupt && headcount(f) <= hc * ACQUIRE_MAX_SIZE_RATIO)
    .sort((a, b) => acquisitionPrice(a) - acquisitionPrice(b))
  const buyingFirm = buying ? game.firms[buying] : undefined
  const hc = headcount(me)
  const departmentParams = {
    max: ACADEMY_MAX_LEVEL,
    bonus: SALES_BID_BONUS,
    pct: formatPercent(NEARSHORE_FREELANCER_MARKUP, lng),
    normal: formatPercent(FREELANCER_MARKUP, lng),
  }

  return (
    <div className={s.grid}>
      <Panel title={t('strategy.title')} icon="flag" className={s.span12}>
        <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{t('strategy.intro')}</p>
        {error && <p className={s.bad}>{t(`game:${error}`)}</p>}
      </Panel>

      <Panel title={t('strategy.specialty.title')} icon="star" className={s.span12}>
        <div className={s.stack}>
          <Hint>
            {t('strategy.specialty.hint', {
              sector: SPECIALTY_SECTOR_BONUS,
              discipline: SPECIALTY_DISCIPLINE_BONUS,
              cost: formatMoney(SPECIALTY_CHANGE_COST, lng),
            })}
          </Hint>
          <strong className={s.small}>
            {me.specialty ? t('strategy.specialty.current', { name: specialtyName(t, me.specialty) }) : t('strategy.specialty.none')}
          </strong>
          <div className={s.row} style={{ flexWrap: 'wrap' }}>
            {SPECIALTIES.map((sp) => (
              <Button
                key={sp}
                size="small"
                variant={me.specialty === sp ? 'primary' : undefined}
                aria-pressed={me.specialty === sp}
                disabled={me.specialty === sp || me.cash < changeCost}
                onClick={() => run({ type: 'chooseSpecialty', firmId: me.id, specialty: sp })}
              >
                {specialtyName(t, sp)}
                {me.specialty && me.specialty !== sp ? ` · ${formatMoney(changeCost, lng)}` : ''}
              </Button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title={t('strategy.partners.title')} icon="handshake" className={s.span8}>
        <Locked firm={me} feature="partnerships">
          <div className={s.stack}>
            <Hint>{t('strategy.partners.hint', { bonus: PARTNER_BONUS, max: MAX_PARTNERSHIPS })}</Hint>
            <div className={s.cards}>
              {PARTNERSHIPS.map((p) => {
                const on = partners.includes(p.id)
                return (
                  <article key={p.id} className={s.card} data-highlight={on || undefined}>
                    <strong>{t(`content:partnerships.${p.id}.name`)}</strong>
                    <span className={s.small}>{t(`content:partnerships.${p.id}.desc`)}</span>
                    <div className={`${s.row} ${s.between}`}>
                      <Badge>{t(`disciplines.${p.discipline}`)}</Badge>
                      <span className={`${s.small} num`}>{t('strategy.partners.fee', { fee: formatMoney(p.fee, lng) })}</span>
                    </div>
                    <Button
                      size="small"
                      variant={on ? 'ghost' : 'primary'}
                      disabled={!on && partners.length >= MAX_PARTNERSHIPS}
                      onClick={() => run({ type: 'setPartnership', firmId: me.id, partnershipId: p.id, on: !on })}
                    >
                      {on ? t('strategy.partners.leave') : t('strategy.partners.join')}
                    </Button>
                  </article>
                )
              })}
            </div>
          </div>
        </Locked>
      </Panel>

      <Panel title={t('strategy.lobby.title')} icon="coffee" className={s.span4}>
        <Locked firm={me} feature="partnerships">
          <div className={s.stack}>
            <Hint>{t('strategy.lobby.hint', { rel: LOBBY_RELATION, cooldown: LOBBY_COOLDOWN })}</Hint>
            <Button
              variant="primary"
              disabled={lobbyWait > 0 || me.cash < LOBBY_COST}
              onClick={() => run({ type: 'lobby', firmId: me.id })}
            >
              {lobbyWait > 0 ? t('strategy.lobby.wait', { count: lobbyWait }) : t('strategy.lobby.do', { cost: formatMoney(LOBBY_COST, lng) })}
            </Button>
          </div>
        </Locked>
      </Panel>

      <Panel title={t('strategy.departments.title')} icon="people" className={s.span12}>
        <Locked firm={me} feature="departments">
          <div className={s.stack}>
            <Hint>{t('strategy.departments.hint')}</Hint>
            <div className={s.cards}>
              {DEPARTMENTS.map((d) => {
                const on = departments.includes(d.id)
                return (
                  <article key={d.id} className={s.card} data-highlight={on || undefined}>
                    <strong>{t(`content:departments.${d.id}.name`)}</strong>
                    <span className={s.small}>{t(`content:departments.${d.id}.desc`, departmentParams)}</span>
                    <span className={`${s.small} num`}>{t('strategy.departments.fee', { fee: formatMoney(departmentFee(d.id, hc), lng) })}</span>
                    <Button
                      size="small"
                      variant={on ? 'ghost' : 'primary'}
                      onClick={() => run({ type: 'setDepartment', firmId: me.id, departmentId: d.id, on: !on })}
                    >
                      {on ? t('strategy.departments.close') : t('strategy.departments.open')}
                    </Button>
                  </article>
                )
              })}
            </div>
          </div>
        </Locked>
      </Panel>

      <Panel title={t('strategy.acquisitions.title')} icon="briefcase" className={s.span12}>
        <Locked firm={me} feature="acquisitions">
          <div className={s.stack}>
            <Hint>{t('strategy.acquisitions.hint')}</Hint>
            {targets.length === 0 ? (
              <p className={s.empty}>{t('strategy.acquisitions.none')}</p>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{t('strategy.acquisitions.firm')}</th>
                      <th className={s.num}>{t('strategy.acquisitions.people')}</th>
                      <th className={s.num}>{t('strategy.acquisitions.price')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div className={s.row}>
                            <FirmGlyph name={f.name} colors={firmColors(f.id)} size={20} />
                            {f.name}
                          </div>
                        </td>
                        <td className={s.num}>{headcount(f)}</td>
                        <td className={s.num}>{formatMoney(acquisitionPrice(f), lng)}</td>
                        <td>
                          <Button size="small" disabled={!!acquisitionBlock(me, f)} onClick={() => setBuying(f.id)}>
                            {t('strategy.acquisitions.buy')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Locked>
      </Panel>

      <Panel title={t('strategy.ipo.title')} icon="chart" className={s.span12}>
        <Locked firm={me} feature="ipo">
          {me.listed ? (
            <p className={s.small}>
              {t('strategy.ipo.listed', { quarter: formatQuarter(me.listed.quarter), owners: formatPercent(1 - me.listed.share, lng) })}
            </p>
          ) : (
            <div className={s.stack}>
              <Hint>{t('strategy.ipo.hint', { share: formatPercent(IPO_SHARE, lng), proceeds })}</Hint>
              <Button variant="primary" onClick={() => setListing(true)}>
                {t('strategy.ipo.do', { proceeds })}
              </Button>
            </div>
          )}
        </Locked>
      </Panel>

      {listing && (
        <Modal
          icon="chart"
          title={t('strategy.ipo.title')}
          onClose={() => setListing(false)}
          actions={
            <>
              <Button onClick={() => setListing(false)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const err = dispatch({ type: 'ipo', firmId: me.id })
                  playSound(err ? 'bad' : 'fanfare')
                  setListing(false)
                }}
              >
                {t('strategy.ipo.yes')}
              </Button>
            </>
          }
        >
          <p>{t('strategy.ipo.confirm', { firm: me.name, proceeds })}</p>
        </Modal>
      )}

      {buyingFirm && (
        <Modal
          icon="briefcase"
          title={t('strategy.acquisitions.title')}
          onClose={() => setBuying(null)}
          actions={
            <>
              <Button onClick={() => setBuying(null)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const err = dispatch({ type: 'acquireFirm', firmId: me.id, targetFirmId: buyingFirm.id })
                  playSound(err ? 'bad' : 'fanfare')
                  setBuying(null)
                }}
              >
                {t('strategy.acquisitions.yes')}
              </Button>
            </>
          }
        >
          <p>{t('strategy.acquisitions.confirm', { firm: buyingFirm.name, price: formatMoney(acquisitionPrice(buyingFirm), lng) })}</p>
        </Modal>
      )}
    </div>
  )
}
