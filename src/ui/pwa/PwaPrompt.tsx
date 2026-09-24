import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { track } from '../../analytics'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui'
import s from './pwa.module.css'

/**
 * Tells the player when the game can be played offline, and when a new version is ready.
 * Updating reloads the page; the game autosaves after every action, so nothing is lost.
 */
export function PwaPrompt() {
  const { t } = useTranslation()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null
  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className={s.toast} role="status">
      <Icon name={needRefresh ? 'star' : 'check'} size={18} />
      <span>{needRefresh ? t('pwa.updateReady') : t('pwa.offlineReady')}</span>
      <div className={s.actions}>
        {needRefresh && (
          <Button
            size="small"
            variant="primary"
            onClick={() => {
              track('app_update_accepted')
              void updateServiceWorker(true)
            }}
          >
            {t('pwa.update')}
          </Button>
        )}
        <Button size="small" variant="ghost" onClick={close}>
          {needRefresh ? t('pwa.later') : t('common.close')}
        </Button>
      </div>
    </div>
  )
}
