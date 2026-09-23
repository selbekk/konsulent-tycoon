import { useTranslation } from 'react-i18next'
import s from '../screens/screens.module.css'

/** Styreleder Bjørn – the board chair and advisor. One or two sentences, never more. */
export function BjornPortrait({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden style={{ flexShrink: 0, border: '2px solid var(--border-dark)', background: '#4cc9f0' }}>
      <rect x="3" y="2" width="6" height="6" fill="#f2c9a0" />
      <rect x="3" y="1" width="6" height="2" fill="#d9d9d9" />
      <rect x="2" y="2" width="1" height="3" fill="#d9d9d9" />
      <rect x="9" y="2" width="1" height="3" fill="#d9d9d9" />
      <rect x="4" y="4" width="1" height="1" fill="#1b1b2f" />
      <rect x="7" y="4" width="1" height="1" fill="#1b1b2f" />
      <rect x="4" y="3" width="4" height="1" fill="#1b1b2f" opacity="0.3" />
      <rect x="4" y="6" width="4" height="1" fill="#b98b6b" />
      <rect x="3" y="7" width="6" height="1" fill="#d9d9d9" />
      <rect x="2" y="8" width="8" height="4" fill="#1c1a5e" />
      <rect x="5" y="8" width="2" height="4" fill="#fff" />
      <rect x="5" y="9" width="2" height="3" fill="#e53170" />
    </svg>
  )
}

export function Bjorn({ text }: { text: string }) {
  const { t } = useTranslation()
  return (
    <div className={s.bjorn}>
      <BjornPortrait />
      <div>
        <strong>{t('bjorn.name')}</strong>
        <p className={s.bjornQuote} style={{ margin: '4px 0 0' }}>
          «{text}»
        </p>
      </div>
    </div>
  )
}
