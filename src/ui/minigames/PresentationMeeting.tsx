import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reactionFor, scoreMeeting, setupMeeting } from '../../engine/minigames'
import type { MeetingStyle, Tender } from '../../engine'
import { Button, Modal } from '../components/ui'
import { playSound } from '../sound'
import s from './minigames.module.css'

interface Props {
  tender: Tender
  firmId: string
  preference: MeetingStyle
  onStart: () => void
  onFinish: (score: number) => void
  onClose: () => void
}

export function PresentationMeeting({ tender, firmId, preference, onStart, onFinish, onClose }: Props) {
  const { t } = useTranslation()
  const rounds = useMemo(() => setupMeeting(tender, firmId), [tender, firmId])
  const [step, setStep] = useState(-1)
  const [answers, setAnswers] = useState<{ style: MeetingStyle; ms: number }[]>([])
  const [score, setScore] = useState<number | null>(null)
  const shownAt = useRef(0)
  const customer = t(`content:customers.${tender.customerId}.name`)
  const current = rounds[step]
  const answered = answers[step]

  const start = () => {
    onStart()
    setStep(0)
    shownAt.current = performance.now()
  }
  const answer = (style: MeetingStyle) => {
    if (answered) return
    const r = reactionFor(style, preference)
    playSound(r === 'love' ? 'good' : r === 'hate' ? 'bad' : 'blip')
    setAnswers((a) => [...a, { style, ms: performance.now() - shownAt.current }])
  }
  const next = () => {
    if (step < rounds.length - 1) {
      setStep(step + 1)
      shownAt.current = performance.now()
    } else {
      const final = scoreMeeting(answers, preference)
      setScore(final)
      onFinish(final)
    }
  }

  return (
    <Modal title={t('minigames:meeting.title')} icon="handshake" onClose={score !== null || step < 0 ? onClose : undefined}>
      {step < 0 ? (
        <div className={s.stack}>
          <div className={s.room} aria-hidden>
            <Panelists />
          </div>
          <p>{t('minigames:meeting.intro', { customer })}</p>
          <p className={s.muted}>{t('minigame.oneShot')}</p>
          <Button variant="primary" onClick={start}>
            {t('minigames:meeting.start')}
          </Button>
        </div>
      ) : score !== null ? (
        <div className={s.stack}>
          <p className={s.score}>{t('minigames:meeting.result', { score })}</p>
          <Button variant="primary" onClick={onClose}>
            {t('minigame.back')}
          </Button>
        </div>
      ) : (
        <div className={s.stack}>
          <div className={s.room} aria-hidden>
            <Panelists mood={answered ? reactionFor(answered.style, preference) : undefined} />
          </div>
          <span className={s.muted}>{t('minigames:meeting.question', { n: step + 1 })}</span>
          <p className={s.question}>«{t(`minigames:meeting.questions.${current.question}.q`)}»</p>
          <div className={s.answers}>
            {current.styles.map((style) => (
              <button
                key={style}
                className={s.answer}
                data-picked={answered?.style === style}
                disabled={!!answered && answered.style !== style}
                onClick={() => answer(style)}
              >
                {t(`minigames:meeting.questions.${current.question}.a.${style}`)}
              </button>
            ))}
          </div>
          {answered && (
            <>
              <p className={s.reaction} data-mood={reactionFor(answered.style, preference)}>
                {t(`minigames:meeting.reactions.${reactionFor(answered.style, preference)}`)}
              </p>
              <Button variant="primary" onClick={next}>
                {step < rounds.length - 1 ? t('minigames:meeting.next') : t('minigames:meeting.finish')}
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Three pixel people behind a table. Their mouths react to your answers. */
function Panelists({ mood }: { mood?: 'love' | 'ok' | 'hate' }) {
  const mouth = mood === 'love' ? 'M' : mood === 'hate' ? 'W' : '-'
  const heads = ['#f2c9a0', '#c68642', '#e0ac69']
  const shirts = ['#1c1a5e', '#e53170', '#2e8b57']
  return (
    <svg viewBox="0 0 48 20" shapeRendering="crispEdges" width="100%" height="100%">
      {heads.map((skin, i) => {
        const x = 6 + i * 14
        return (
          <g key={i} className={mood === 'love' ? s.nod : undefined}>
            <rect x={x} y={2} width={6} height={6} fill={skin} />
            <rect x={x} y={2} width={6} height={1} fill="#3b2f1a" />
            <rect x={x + 1} y={4} width={1} height={1} fill="#111" />
            <rect x={x + 4} y={4} width={1} height={1} fill="#111" />
            {mouth === 'M' && <rect x={x + 1} y={6} width={4} height={1} fill="#8b2b2b" />}
            {mouth === '-' && <rect x={x + 2} y={6} width={2} height={1} fill="#8b2b2b" />}
            {mouth === 'W' && (
              <>
                <rect x={x + 1} y={7} width={1} height={1} fill="#8b2b2b" />
                <rect x={x + 2} y={6} width={2} height={1} fill="#8b2b2b" />
                <rect x={x + 4} y={7} width={1} height={1} fill="#8b2b2b" />
              </>
            )}
            <rect x={x - 1} y={8} width={8} height={6} fill={shirts[i]} />
          </g>
        )
      })}
      <rect x={0} y={13} width={48} height={3} fill="#8a5a2b" />
      <rect x={10} y={11} width={2} height={2} fill="#fff" />
      <rect x={30} y={11} width={3} height={2} fill="#ddd" />
    </svg>
  )
}
