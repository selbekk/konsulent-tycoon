import { useTranslation } from 'react-i18next'
import { PARTNERSHIPS } from '../../content/strategy'
import {
  FEATURE_LEVEL,
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
import { Badge, Button, Hint, Panel } from '../components/ui'
import { formatMoney } from '../format'
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
    </div>
  )
}
