import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TalkStyle } from '../../content/crisisTalks'
import { crisisChoices, talkTier } from '../../engine'
import { TALK_SECONDS, scoreCrisisTalk, setupCrisisTalk, talkPreference, talkReaction } from '../../engine/minigames'
import type { CrisisMinigame } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { playSound } from '../sound'
import s from './minigames.module.css'

/**
 * A crisis talk: three hard questions against the clock. The audience secretly wants one style of
 * answer (a clue up front, reactions along the way) and hates its opposite. Starting locks in the
 * choice (see startCrisisTalk), the score goes into resolveCrisis. Own hash RNG – never touches state.rng.
 */
export function CrisisTalk() {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)!
  const talk = useGame((x) => x.crisisTalk)!
  const dispatch = useGame((x) => x.dispatch)
  const close = useGame((x) => x.openCrisisTalk)
  const c = game.crises?.find((x) => x.id === talk.crisisId)
  const kind = c && crisisChoices(c).find((ch) => ch.id === talk.choiceId)?.talk
  const crisisId = c?.id
  const firmId = c?.firmId
  const rounds = useMemo(() => (crisisId && firmId && kind ? setupCrisisTalk(crisisId, firmId, kind) : []), [crisisId, firmId, kind])
  const preference = useMemo(() => (crisisId && firmId && kind ? talkPreference(crisisId, firmId, kind) : 'candid'), [crisisId, firmId, kind])
  const [step, setStep] = useState(-1)
  const [answers, setAnswers] = useState<(TalkStyle | null)[]>([])
  const [left, setLeft] = useState(TALK_SECONDS)
  const [score, setScore] = useState<number | null>(null)
  const current = rounds[step]
  const answered = step >= 0 && answers.length > step
  const picked = answers[step]

  const reaction = answered ? talkReaction(picked, preference) : undefined
  const answer = (a: TalkStyle | null) => {
    if (answered) return
    const r = talkReaction(a, preference)
    playSound(r === 'love' ? 'good' : r === 'ok' ? 'blip' : 'bad')
    setAnswers((xs) => [...xs, a])
  }

  // One clock per question; running out counts as the worst answer.
  useEffect(() => {
    if (step < 0 || answered || score !== null) return
    if (left <= 0) {
      answer(null)
      return
    }
    const id = window.setTimeout(() => {
      setLeft((x) => x - 1)
      if (left <= 4) playSound('tick')
    }, 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, left, answered, score])

  if (!c || !kind) return null

  const start = () => {
    if (dispatch({ type: 'startCrisisTalk', firmId: c.firmId, crisisId: c.id, choiceId: talk.choiceId })) return close(null)
    setStep(0)
    setLeft(TALK_SECONDS)
  }
  const next = () => {
    if (step < rounds.length - 1) {
      setStep(step + 1)
      setLeft(TALK_SECONDS)
      return
    }
    const final = scoreCrisisTalk(answers, preference)
    setScore(final)
    playSound(talkTier(final) === 'good' ? 'win' : talkTier(final) === 'bad' ? 'lose' : 'confirm')
    dispatch({ type: 'resolveCrisis', firmId: c.firmId, crisisId: c.id, choiceId: talk.choiceId, score: final })
  }
  const base = `minigames:crisisTalk.${kind}`

  return (
    <Modal title={t(`${base}.title`)} icon="siren" onClose={score !== null || step < 0 ? () => close(null) : undefined}>
      {step < 0 ? (
        <div className={s.stack}>
          <div className={s.room} aria-hidden>
            <TalkScene kind={kind} />
          </div>
          <p>{t(`${base}.intro`, { seconds: TALK_SECONDS })}</p>
          <div>
            <strong>{t('minigames:crisisTalk.brief')}</strong>
            <p className={s.muted} style={{ margin: '4px 0 0' }}>{t(`${base}.clues.${preference}`)}</p>
          </div>
          <p className={s.muted}>{t('minigame.oneShot')}</p>
          <Button variant="primary" onClick={start}>
            {t('minigames:crisisTalk.start')}
          </Button>
        </div>
      ) : score !== null ? (
        <div className={s.stack}>
          <p className={s.score}>{t('minigames:crisisTalk.result', { score })}</p>
          <p>{t(`minigames:crisisTalk.tier.${talkTier(score)}`)}</p>
          <p className={s.muted}>{t(`minigames:crisisTalk.learned.${preference}`)}</p>
          <Button variant="primary" onClick={() => close(null)}>
            {t('minigame.back')}
          </Button>
        </div>
      ) : (
        <div className={s.stack}>
          <div className={s.room} aria-hidden>
            <TalkScene kind={kind} mood={reaction} />
          </div>
          <div className={s.talkHead}>
            <span className={s.muted}>{t('minigames:crisisTalk.question', { n: step + 1 })}</span>
            <span className={`num ${s.talkTimer}`} data-low={left <= 4 && !answered}>
              {t('minigames:crisisTalk.timer', { seconds: Math.max(0, left) })}
            </span>
          </div>
          <p className={s.question}>«{t(`${base}.questions.${current.question}.q`)}»</p>
          <div className={s.answers}>
            {current.answers.map((a) => (
              <button key={a} className={s.answer} data-picked={picked === a} disabled={answered && picked !== a} onClick={() => answer(a)}>
                {t(`${base}.questions.${current.question}.a.${a}`)}
              </button>
            ))}
          </div>
          {answered && (
            <>
              <p className={s.reaction} data-mood={reaction}>
                {picked === null ? t('minigames:crisisTalk.timeout') : t(`minigames:crisisTalk.reactions.${reaction}`)}
              </p>
              <Button variant="primary" onClick={next}>
                {step < rounds.length - 1 ? t('minigames:crisisTalk.next') : t('minigames:crisisTalk.finish')}
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Pixel audience: journalists with microphones, the whole firm, or the client's leadership in coats. */
function TalkScene({ kind, mood }: { kind: CrisisMinigame; mood?: 'love' | 'ok' | 'hate' }) {
  const skins = ['#f2c9a0', '#c68642', '#e0ac69', '#8d5524', '#f1c27d']
  const shirts = kind === 'client' ? ['#2b2b3a', '#2b2b3a', '#3a3a4f'] : ['#1c1a5e', '#e53170', '#2e8b57', '#d06a10', '#8f7bff']
  const n = kind === 'townhall' ? 5 : 3
  const gap = kind === 'townhall' ? 9 : 14
  const mouth = mood === 'love' ? 'M' : mood === 'hate' ? 'W' : '-'
  return (
    <svg viewBox="0 0 48 20" shapeRendering="crispEdges" width="100%" height="100%">
      {Array.from({ length: n }, (_, i) => {
        const x = (kind === 'townhall' ? 3 : 6) + i * gap
        const skin = skins[i % skins.length]
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
            <rect x={x - 1} y={8} width={8} height={6} fill={shirts[i % shirts.length]} />
            {kind === 'press' && (
              <>
                <rect x={x + 6} y={9} width={1} height={5} fill="#555" />
                <rect x={x + 5} y={8} width={3} height={2} fill="#222" />
              </>
            )}
          </g>
        )
      })}
      {kind === 'press' && <rect x={0} y={16} width={48} height={1} fill="#ff5a5f" />}
      <rect x={0} y={14} width={48} height={2} fill={kind === 'townhall' ? '#6b6b6b' : '#8a5a2b'} />
    </svg>
  )
}
