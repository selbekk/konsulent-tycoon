import { useTranslation } from 'react-i18next'
import { crisesOf, crisisDef } from '../../engine'
import type { Crisis } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Badge, Button, Panel } from '../components/ui'
import { formatQuarter, resolveParams } from '../format'
import { crisisTitle, stageKey } from '../crisisText'
import { CrisisSteps } from './CrisisModal'
import s from './screens.module.css'

const ORDER: Record<Crisis['status'], number> = { active: 0, waiting: 1, buried: 2, over: 3 }
const TONE = { active: 'bad', waiting: 'sassy', buried: 'sassy', over: 'neutral' } as const

/** Dashboard tracker: running crises, what you did about them, and how the ones behind you went. */
export function CrisisPanel() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const openCrisis = useGame((x) => x.openCrisis)
  const me = game.firms[game.playerId]
  const crises = crisesOf(game, me.id)
    .filter((c) => crisisDef(c))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.stageQuarter - a.stageQuarter)
  const tally = me.crisisOutcomes ?? {}
  const handled = (tally.good ?? 0) + (tally.ok ?? 0) + (tally.bad ?? 0)
  if (!crises.length && !handled) return null

  return (
    <Panel title={t('crisis.panelTitle')} icon="siren" className={s.span12}>
      {crises.length ? (
        <ul className={s.crisisList}>
          {crises.map((c) => {
            const params = resolveParams(c.params, t, lng)
            const last = c.log[c.log.length - 1]
            return (
              <li key={c.id} data-status={c.status}>
                <span className={s.newsDot} data-tone={c.status === 'over' ? (c.outcome === 'bad' ? 'bad' : 'good') : TONE[c.status]} />
                <div className={s.crisisListMain}>
                  <div className={s.crisisListHead}>
                    <strong>{crisisTitle(c, t, params)}</strong>
                    <Badge tone="accent">{t(`crisis.categories.${crisisDef(c)!.category}`)}</Badge>
                    <CrisisSteps c={c} />
                  </div>
                  <span className={`${s.small} ${s.muted}`}>
                    {c.status === 'over' && c.outcome ? t(`crisis.outcome.${c.outcome}`) : t(`crisis.status.${c.status}`)}
                    {last && (
                      <>
                        {' · '}
                        <span className="num">{formatQuarter(last.quarter)}</span> {t(`${stageKey(c, last.stage)}.choices.${last.choiceId}`, params)}
                      </>
                    )}
                  </span>
                </div>
                <Button size="small" variant={c.status === 'active' ? 'primary' : 'default'} onClick={() => openCrisis(c.id)}>
                  {c.status === 'active' ? t('crisis.decide') : t('crisis.open')}
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={s.empty}>{t('crisis.empty')}</p>
      )}
      {handled > 0 && (
        <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
          {t('crisis.tally', { good: tally.good ?? 0, ok: tally.ok ?? 0, bad: tally.bad ?? 0 })}
        </p>
      )}
    </Panel>
  )
}
