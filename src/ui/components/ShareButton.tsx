import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { share } from '../share'
import type { ShareResult, ShareSource } from '../share'
import { Button } from './ui'
import s from '../screens/screens.module.css'

/** Shares a result as text plus a link to the game, with a quiet note when it went to the clipboard. */
export function ShareButton({
  text,
  source,
  size,
}: {
  text: () => string
  source: ShareSource
  size?: 'small' | 'big'
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ShareResult | null>(null)
  const onClick = async () => {
    const url = window.location.origin
    const message = text()
    setStatus(await share({ text: message, url, copy: `${message}\n${url}`, source }))
  }
  return (
    <div className={s.row}>
      <Button size={size} onClick={() => void onClick()}>
        {t('share.button')}
      </Button>
      <span className={`${s.small} ${s.muted}`} role="status">
        {status === 'copied' ? t('share.copied') : status === 'failed' ? t('share.failed') : ''}
      </span>
    </div>
  )
}
