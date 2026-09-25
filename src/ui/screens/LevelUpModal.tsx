import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGame } from '../../store/gameStore'
import { Bjorn } from '../components/Bjorn'
import { Button, Modal } from '../components/ui'
import { playSound } from '../sound'
import { UnlockList } from './LevelPanel'
import { Confetti } from './QuarterReport'
import s from './screens.module.css'

/** The moment the firm moves up a level: fanfare, confetti and what just opened. */
export function LevelUpModal({ from, to }: { from: number; to: number }) {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)!
  const dismiss = useGame((x) => x.dismissLevelUp)
  const reducedMotion = useGame((x) => x.settings.reducedMotion)
  const me = game.firms[game.playerId]
  const levels = Array.from({ length: to - from }, (_, i) => from + 1 + i)

  useEffect(() => {
    playSound('fanfare')
    // Play again when a new level-up replaces this one.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [to])

  return (
    <Modal
      title={t('level.up', { name: t(`level.names.${to}`) })}
      icon="trophy"
      onClose={dismiss}
      actions={
        <Button variant="primary" onClick={dismiss}>
          {t('level.upContinue')}
        </Button>
      }
    >
      {!reducedMotion && <Confetti />}
      <div className={s.stack}>
        <div className={s.levelBadge} aria-hidden>
          <span className={s.levelNumber}>{to}</span>
        </div>
        <p className={s.levelLead}>{t('level.upBody', { firm: me.name, name: t(`level.names.${to}`) })}</p>
        <span className={s.small}>{t('level.move', { office: t(`office.tiers.${to}`) })}</span>
        <span className={`${s.small} ${s.muted}`}>{t('level.unlocks')}</span>
        {levels.map((l) => (
          <UnlockList key={l} level={l} />
        ))}
        <Bjorn text={t(`level.bjorn.${to}`)} />
      </div>
    </Modal>
  )
}
