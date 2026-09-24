import { useTranslation } from 'react-i18next'
import { denyConsent, grantConsent } from '../../analytics'
import { useConsent } from '../../analytics/consent'
import { useGame } from '../../store/gameStore'
import { Button } from '../components/ui'
import s from './consent.module.css'

/** Asks once whether we may collect usage statistics. Nothing is tracked until the player says yes. */
export function CookieBar() {
  const { t } = useTranslation()
  const consent = useConsent()
  const go = useGame((x) => x.go)
  if (consent !== null) return null
  return (
    <section className={s.bar} aria-labelledby="consent-title">
      <div className={s.text}>
        <h2 id="consent-title" className={s.title}>
          {t('consent.title')}
        </h2>
        <p>
          {t('consent.body')}{' '}
          <button type="button" className={s.link} onClick={() => go('about')}>
            {t('consent.more')}
          </button>
        </p>
      </div>
      <div className={s.actions}>
        <Button size="small" onClick={denyConsent}>
          {t('consent.deny')}
        </Button>
        <Button size="small" variant="primary" onClick={grantConsent}>
          {t('consent.accept')}
        </Button>
      </div>
    </section>
  )
}
