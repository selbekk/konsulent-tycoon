import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { track } from '../../analytics'
import { FEEDBACK_MAX_TEXT } from '../../online/feedback'
import type { Feedback, FeedbackSource } from '../../online/feedback'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui'
import { readFeedbackMemory, rememberAsked, rememberDismissed, rememberSent, shouldAskForFeedback } from './cadence'
import type { AskContext } from './cadence'
import f from './feedback.module.css'
import s from '../screens/screens.module.css'

type Status = 'idle' | 'sending' | 'sent' | 'offline' | 'tooFast' | 'unknown'

/** Stars, an optional comment and a send button. The Firebase client loads only when the player sends. */
export function FeedbackForm({
  source,
  quarter,
  title,
  onDismiss,
}: {
  source: FeedbackSource
  quarter: number | null
  title?: string
  /** Shows a "not now" button. */
  onDismiss?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const textId = useId()

  if (status === 'sent')
    return (
      <p className={f.thanks} role="status">
        <Icon name="check" size={12} /> {t('feedback.thanks')}
      </p>
    )

  const send = async () => {
    if (!rating) return
    setStatus('sending')
    const feedback: Feedback = {
      rating: rating as Feedback['rating'],
      text: text.trim(),
      lang: i18n.language === 'en' ? 'en' : 'nb',
      source,
      quarter,
    }
    try {
      const { sendFeedback } = await import('../../online/leaderboard')
      await sendFeedback(feedback)
      rememberSent()
      track('feedback_sent', { rating, source, has_text: feedback.text.length > 0 })
      setStatus('sent')
    } catch (e) {
      const reason = (e as { reason?: Status }).reason
      setStatus(reason === 'offline' || reason === 'tooFast' ? reason : 'unknown')
    }
  }

  return (
    <div className={f.form}>
      <fieldset className={f.stars}>
        <legend className={f.legend}>{title ?? t('feedback.question')}</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={f.star} data-on={n <= rating || undefined}>
            <input
              type="radio"
              name={`${textId}-rating`}
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
              className="visually-hidden"
            />
            <Icon name="star" size={24} />
            <span className="visually-hidden">{t('feedback.stars', { count: n })}</span>
          </label>
        ))}
        {rating > 0 && <span className={`${s.small} ${s.muted}`}>{t(`feedback.ratings.${rating}`)}</span>}
      </fieldset>
      {rating > 0 && (
        <>
          <label htmlFor={textId} className={s.small}>
            {t('feedback.comment')}
          </label>
          <textarea
            id={textId}
            className={`${s.input} ${f.text}`}
            rows={3}
            maxLength={FEEDBACK_MAX_TEXT}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className={`${s.small} ${s.muted}`}>{t('feedback.anonymous')}</p>
        </>
      )}
      {status !== 'idle' && status !== 'sending' && (
        <p className={`${s.small} ${f.error}`} role="alert">
          {t(`feedback.errors.${status}`)}
        </p>
      )}
      <div className={f.buttons}>
        {onDismiss && (
          <Button size="small" variant="ghost" onClick={onDismiss}>
            {t('feedback.notNow')}
          </Button>
        )}
        <Button size="small" variant="primary" disabled={!rating || status === 'sending'} onClick={() => void send()}>
          {status === 'sending' ? t('feedback.sending') : t('feedback.send')}
        </Button>
      </div>
    </div>
  )
}

/**
 * The game asking by itself, inside the quarter report or the end screen. Decides once when it mounts
 * (see cadence.ts) and renders nothing most of the time.
 */
export function FeedbackPrompt({ context, quarter }: { context: AskContext; quarter: number }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(() => shouldAskForFeedback(readFeedbackMemory(), Date.now(), context))
  useEffect(() => {
    if (!show) return
    rememberAsked()
    track('feedback_prompt_shown', { at: context.at, quarter })
    // Once, when it first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!show) return null
  return (
    <div className={s.card}>
      <FeedbackForm
        source={context.at}
        quarter={quarter}
        title={t(context.at === 'end' ? 'feedback.questionEnd' : 'feedback.question')}
        onDismiss={() => {
          rememberDismissed()
          track('feedback_prompt_dismissed', { at: context.at, quarter })
          setShow(false)
        }}
      />
    </div>
  )
}
