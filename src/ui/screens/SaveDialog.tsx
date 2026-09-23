import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listSlots } from '../../engine'
import type { SlotId } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { formatMoney, formatQuarter } from '../format'
import s from './screens.module.css'

const MANUAL: SlotId[] = ['1', '2', '3']

function readSlots() {
  try {
    return listSlots(localStorage)
  } catch {
    return []
  }
}

export function SaveDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const save = useGame((x) => x.save)
  const quit = useGame((x) => x.quit)
  const [slots, setSlots] = useState(readSlots)
  const [message, setMessage] = useState<string | null>(null)

  const doSave = (slot: SlotId) => {
    const ok = save(slot)
    setMessage(ok ? t('save.saved', { slot }) : t('save.failed'))
    setSlots(readSlots())
  }

  return (
    <Modal
      title={t('save.title')}
      icon="disk"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={quit}>
            {t('save.quit')}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <p className={`${s.small} ${s.muted}`}>{t('save.autosaveInfo')}</p>
        {MANUAL.map((slot) => {
          const meta = slots.find((m) => m.slot === slot)
          return (
            <div key={slot} className={`${s.card} ${s.row} ${s.between}`}>
              <span>
                <strong>{t('save.slot', { slot })}</strong>
                <br />
                <span className={`${s.small} ${s.muted}`}>
                  {meta
                    ? `${meta.firmName} · ${formatQuarter(meta.quarter)} · ${formatMoney(meta.cash, i18n.language)}`
                    : t('save.empty')}
                </span>
              </span>
              <Button onClick={() => doSave(slot)}>{meta ? t('save.overwrite') : t('save.saveHere')}</Button>
            </div>
          )
        })}
        {message && <p className={s.good}>{message}</p>}
      </div>
    </Modal>
  )
}
