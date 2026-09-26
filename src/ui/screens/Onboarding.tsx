import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_LEVEL, SHADY_LEVELS, unlocksAt } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Bjorn } from '../components/Bjorn'
import type { IconName } from '../components/Icon'
import { Button, Modal } from '../components/ui'
import { formatQuarter } from '../format'
import s from './screens.module.css'

const STEPS = ['goal', 'quarter', 'tenders', 'people', 'ahead'] as const
type Step = (typeof STEPS)[number]

const STEP_ICONS: Record<Step, IconName> = {
  goal: 'trophy',
  quarter: 'calendar',
  tenders: 'briefcase',
  people: 'coffee',
  ahead: 'flag',
}

/** Levels 2 and up with the features they open, straight from FEATURE_LEVEL so the teaser follows the balance. */
function LevelTeaser() {
  const { t } = useTranslation()
  const levels = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2)
  return (
    <ul className={s.newsList}>
      {levels.map((level) => (
        <li key={level}>
          <span className={s.newsDot} data-tone="good" />
          <span>
            <strong>
              {t('level.label', { level })} · {t(`level.names.${level}`)}:
            </strong>{' '}
            {unlocksAt(level, SHADY_LEVELS)
              .features.map((f) => t(`onboarding.features.${f}`))
              .join(', ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A short intro when a new game starts: what the point is, how a quarter works, and what's ahead. Skippable. */
export function Onboarding() {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)!
  const dismiss = useGame((x) => x.dismissOnboarding)
  const [index, setIndex] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1
  const me = game.firms[game.playerId]
  const params = {
    firm: me.name,
    quarters: game.maxQuarters,
    start: formatQuarter(0),
    end: formatQuarter(game.maxQuarters - 1),
    rivals: game.firmOrder.length - 1,
    staff: t('tabs.staff'),
    tenders: t('tabs.tenders'),
    contracts: t('tabs.contracts'),
    dashboard: t('tabs.dashboard'),
    endTurn: t('shell.endTurn'),
  }
  // Back disappears on the first step; keep focus inside the dialog when it does.
  useEffect(() => {
    if (index === 0 && document.activeElement === document.body) nextRef.current?.focus()
  }, [index])
  const points = t(`onboarding.${step}.points`, { ...params, returnObjects: true }) as string[]

  return (
    <Modal
      title={t(`onboarding.${step}.title`)}
      icon={STEP_ICONS[step]}
      onClose={dismiss}
      actions={
        <>
          <Button variant="ghost" size="small" onClick={dismiss} style={{ marginRight: 'auto' }}>
            {t('onboarding.skip')}
          </Button>
          {index > 0 && <Button onClick={() => setIndex(index - 1)}>{t('common.back')}</Button>}
          <Button ref={nextRef} variant="primary" onClick={() => (last ? dismiss() : setIndex(index + 1))}>
            {last ? (
              t('onboarding.start')
            ) : (
              <>
                {t('onboarding.next')} <span aria-hidden>▶</span>
              </>
            )}
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <span className={`${s.small} ${s.muted}`}>
          {t('onboarding.progress', { n: index + 1, total: STEPS.length })}
        </span>
        <p style={{ margin: 0, fontSize: '1.1rem' }}>{t(`onboarding.${step}.body`, params)}</p>
        {points.length > 0 && (
          <ul className={s.newsList}>
            {points.map((p) => (
              <li key={p}>
                <span className={s.newsDot} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {step === 'ahead' && <LevelTeaser />}
        {last && <Bjorn text={t('onboarding.bjorn')} />}
        <div className={s.onboardingDots} aria-hidden>
          {STEPS.map((id, i) => (
            <span key={id} data-active={i === index} />
          ))}
        </div>
      </div>
    </Modal>
  )
}
