import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  STAKE_AXES,
  crisisChoicePreview,
  crisisChoices,
  crisisDef,
  crisisProgress,
  crisisStage,
  openCrises,
} from '../../engine'
import type { ChoicePreview, Crisis, Stake, StakeAxis } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Icon } from '../components/Icon'
import { Badge, Button, Modal } from '../components/ui'
import { crisisTitle, stageKey } from '../crisisText'
import { formatMoney, formatQuarter, resolveParams } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

export function CrisisSteps({ c }: { c: Crisis }) {
  const { t } = useTranslation()
  const { step, total } = crisisProgress(c)
  const done = c.status === 'active' ? step - 1 : step
  return (
    <span className={s.crisisSteps} role="img" aria-label={t('crisis.step', { step: Math.max(1, step), total })}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={s.crisisStep}
          data-state={i < done ? 'done' : i === done && c.status === 'active' ? 'now' : 'todo'}
        />
      ))}
    </span>
  )
}

function StakeRow({ stakes }: { stakes: Record<StakeAxis, Stake> }) {
  const { t } = useTranslation()
  const shown = STAKE_AXES.filter((a) => stakes[a] !== 0)
  if (!shown.length) return null
  return (
    <span className={s.crisisStakes}>
      {shown.map((a) => {
        const v = stakes[a]
        // More risk is bad news, so it points the other way.
        const tone = v === '?' ? 'unknown' : (a === 'risk' ? -v : v) > 0 ? 'good' : 'bad'
        const word =
          v === '?'
            ? t('crisis.stakeValue.unknown')
            : a === 'risk'
              ? t(v > 0 ? 'crisis.stakeValue.riskUp' : 'crisis.stakeValue.riskDown')
              : t(v > 0 ? 'crisis.stakeValue.up' : 'crisis.stakeValue.down')
        return (
          <span key={a} className={s.crisisStake} data-tone={tone} title={`${t(`crisis.stakes.${a}`)}: ${word}`}>
            <span aria-hidden>{v === '?' ? '?' : v > 0 ? '▲' : '▼'}</span> {t(`crisis.stakes.${a}`)}
            <span className="visually-hidden">: {word}</span>
          </span>
        )
      })}
    </span>
  )
}

function ChoiceFacts({ p }: { p: ChoicePreview }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  return (
    <span className={s.crisisChips}>
      {p.cash !== 0 && (
        <Badge tone={p.cash < 0 ? 'bad' : 'good'}>
          {t(p.cash < 0 ? 'crisis.cost' : 'crisis.income', { amount: formatMoney(Math.abs(p.cash), lng) })}
        </Badge>
      )}
      {p.bench > 0 && <Badge tone="warn">{t('crisis.bench', { count: p.bench })}</Badge>}
      {p.benchStar && <Badge tone="warn">{t('crisis.benchStar', { name: p.benchStar })}</Badge>}
      {p.talk && <Badge tone="accent">{t(`crisis.talk.${p.talk}`)}</Badge>}
      {p.bury && <Badge tone="bad">{t('crisis.bury')}</Badge>}
      <Badge tone="info">{t(p.ends ? 'crisis.ends' : 'crisis.continues')}</Badge>
    </span>
  )
}

export function CrisisModal({ crisisId }: { crisisId: string }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const error = useGame((x) => x.error)
  const openCrisis = useGame((x) => x.openCrisis)
  const openCrisisTalk = useGame((x) => x.openCrisisTalk)
  const c = game.crises?.find((x) => x.id === crisisId)
  const active = c?.status === 'active'
  useEffect(() => {
    if (active) playSound('siren')
    // Sound the siren again for every new crisis and stage.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [crisisId, c?.stage, active])
  if (!c || !crisisDef(c)) return null

  const def = crisisDef(c)!
  const params = resolveParams(c.params, t, lng)
  const stage = crisisStage(c)
  const key = stageKey(c)
  const close = () => openCrisis(null)
  const last = c.log[c.log.length - 1]
  const justDecided = !active && last && last.quarter === game.quarter && !last.auto
  const choiceText = (stageId: string, id: string) => t(`${stageKey(c, stageId)}.choices.${id}`, params)
  const others = openCrises(game, c.firmId).filter((x) => x.id !== c.id).length
  const severity = c.revealed ? c.severity : 'unknown'

  const pick = (choiceId: string, talk: boolean) => {
    // A talk that was started and then interrupted (reload) can only be finished, with the score it has: none.
    if (talk && c.minigameStarted !== choiceId) return openCrisisTalk({ crisisId: c.id, choiceId })
    const err = dispatch({ type: 'resolveCrisis', firmId: c.firmId, crisisId: c.id, choiceId, score: 0 })
    if (!err) playSound('confirm')
  }

  return (
    <Modal
      title={crisisTitle(c, t, params)}
      icon="siren"
      wide
      onClose={close}
      actions={
        active ? (
          <Button variant="ghost" onClick={close}>
            {t('crisis.later')}
          </Button>
        ) : (
          <Button variant="primary" onClick={close}>
            {t('crisis.close')}
          </Button>
        )
      }
    >
      <div className={s.stack}>
        <div className={s.crisisMeta}>
          <Badge tone="accent">{t(`crisis.categories.${def.category}`)}</Badge>
          <CrisisSteps c={c} />
          <span className={`${s.small} ${s.muted}`}>
            {t('crisis.severity.label')}: <strong data-severity={severity}>{t(`crisis.severity.${severity}`)}</strong>
          </span>
        </div>

        {c.log.length > 0 && (
          <div className={s.crisisHistory}>
            <span className={`${s.small} ${s.muted}`}>{t('crisis.history')}</span>
            <ol>
              {c.log.map((l, i) => (
                <li key={i}>
                  <span className={`num ${s.muted}`}>{formatQuarter(l.quarter)}</span> {choiceText(l.stage, l.choiceId)}
                  {l.auto && <span className={s.muted}> {t('crisis.autoPicked')}</span>}
                  {l.score !== undefined && (
                    <span className={s.muted}> · {t('crisis.talkScore', { score: l.score })}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {justDecided ? (
          <div className={s.crisisResult} role="status">
            <p style={{ margin: 0 }}>{t('crisis.chosen', { choice: choiceText(last.stage, last.choiceId) })}</p>
            {c.status === 'waiting' && <p className={s.muted}>{t('crisis.nextQuarter')}</p>}
            {c.status === 'buried' && <p className={s.muted}>{t('crisis.buriedNow')}</p>}
            {c.status === 'over' && c.outcome && (
              <p>
                <Badge tone={c.outcome === 'good' ? 'good' : c.outcome === 'bad' ? 'bad' : 'warn'}>
                  {t(`crisis.outcome.${c.outcome}`)}
                </Badge>
              </p>
            )}
          </div>
        ) : active && stage ? (
          <>
            <p className={s.crisisBody}>{t(stage.reveals ? `${key}.body.${c.severity}` : `${key}.body`, params)}</p>
            <div className={s.crisisChoices}>
              {crisisChoices(c).map((ch) => {
                const p = crisisChoicePreview(game, c, ch)
                const resume = !!ch.talk && c.minigameStarted === ch.id
                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={s.crisisChoice}
                    disabled={!!p.block && !resume}
                    onClick={() => pick(ch.id, !!ch.talk)}
                  >
                    <span className={s.crisisChoiceLabel}>
                      {ch.talk && <Icon name="handshake" size={12} />}{' '}
                      {resume ? t('crisis.resume') : choiceText(c.stage, ch.id)}
                    </span>
                    <ChoiceFacts p={p} />
                    <StakeRow stakes={p.stakes} />
                    {(p.uncertain || p.talk) && (
                      <span className={`${s.small} ${s.muted}`}>
                        {p.talk ? t('crisis.talkHint') : t('crisis.uncertain')}
                      </span>
                    )}
                    {ch.fallback && <span className={`${s.small} ${s.muted}`}>{t('crisis.fallbackHint')}</span>}
                    {p.block && !resume && (
                      <span className={`${s.small} ${s.crisisBlock}`}>{t(`game:${p.block}`)}</span>
                    )}
                  </button>
                )
              })}
            </div>
            {error && <p className={s.crisisBlock}>{t(`game:${error}`)}</p>}
          </>
        ) : (
          <p className={s.muted}>
            {c.status === 'over' && c.outcome ? t(`crisis.outcome.${c.outcome}`) : t(`crisis.status.${c.status}`)}
          </p>
        )}
        {others > 0 && <p className={`${s.small} ${s.muted}`}>{t('crisis.more', { count: others })}</p>}
      </div>
    </Modal>
  )
}
