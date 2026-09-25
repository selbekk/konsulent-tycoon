import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENT_MAP } from '../../content/events'
import { canChoose } from '../../engine'
import type { PendingEvent } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { resolveParams } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

export function EventModal({ event }: { event: PendingEvent }) {
  const { t, i18n } = useTranslation()
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const def = EVENT_MAP[event.eventId]
  useEffect(() => {
    playSound(event.eventId === 'poach_attempt' ? 'scandal' : 'alert')
    // Play again for each new event, also when two in a row share an eventId.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [event.id, event.eventId])
  if (!def) return null
  const params = resolveParams(event.params, t, i18n.language)
  const remaining = game.pendingEvents.filter((e) => e.firmId === event.firmId).length

  return (
    <Modal title={t(`game:events.${def.id}.title`)} icon="warn">
      <div className={s.stack}>
        <p style={{ margin: 0, fontSize: '1.1rem' }}>{t(`game:events.${def.id}.body`, params)}</p>
        <div className={s.choiceList}>
          {def.choices.map((c) => (
            <Button
              key={c.id}
              disabled={!canChoose(game, event, c.id)}
              onClick={() => dispatch({ type: 'resolveEvent', pendingEventId: event.id, choiceId: c.id })}
            >
              {t(`game:events.${def.id}.choices.${c.id}`, params)}
            </Button>
          ))}
        </div>
        {remaining > 1 && <p className={`${s.small} ${s.muted}`}>{t('events.more', { count: remaining - 1 })}</p>}
      </div>
    </Modal>
  )
}
