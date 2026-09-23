import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BINGO_SECONDS, scoreBingo, setupBingo } from '../../engine/minigames'
import type { Tender } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { playSound } from '../sound'
import s from './minigames.module.css'

interface Props {
  tender: Tender
  firmId: string
  onStart: () => void
  onFinish: (score: number) => void
  onClose: () => void
}

export function BuzzwordBingo({ tender, firmId, onStart, onFinish, onClose }: Props) {
  const { t } = useTranslation()
  const doubleTime = useGame((x) => x.settings.doubleTime)
  const total = BINGO_SECONDS * (doubleTime ? 2 : 1)
  const board = useMemo(() => setupBingo(tender, firmId), [tender, firmId])
  const fragments = t('minigames:bingo.fragments', { returnObjects: true }) as string[]
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro')
  const [picked, setPicked] = useState<string[]>([])
  const [score, setScore] = useState<number | null>(null)
  // Time is derived from a deadline, so re-running the timer effect never adds time.
  const [endsAt, setEndsAt] = useState(0)
  const [now, setNow] = useState(0)
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))

  const finish = useCallback(
    (secondsLeft: number) => {
      const final = scoreBingo(picked, board.correct, secondsLeft, total)
      setScore(final)
      setPhase('done')
      playSound(final >= 60 ? 'win' : 'lose')
      onFinish(final)
    },
    [picked, board.correct, total, onFinish],
  )

  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => {
      const t = performance.now()
      if (t >= endsAt) {
        clearInterval(id)
        finish(0)
      } else {
        const secs = Math.ceil((endsAt - t) / 1000)
        if (secs <= 5 && secs !== Math.ceil((endsAt - t - 250) / 1000)) playSound('tick')
        setNow(t)
      }
    }, 250)
    return () => clearInterval(id)
  }, [phase, endsAt, finish])

  const begin = () => {
    const t = performance.now()
    onStart()
    setNow(t)
    setEndsAt(t + total * 1000)
    setPhase('play')
  }

  const toggle = (w: string) => {
    playSound('blip')
    setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]))
  }
  const customer = t(`content:customers.${tender.customerId}.name`)

  return (
    <Modal title={t('minigames:bingo.title')} icon="brain" onClose={phase !== 'play' ? onClose : undefined} wide>
      {phase === 'intro' && (
        <div className={s.stack}>
          <p>{t('minigames:bingo.intro', { customer, seconds: total })}</p>
          <p className={s.muted}>{t('minigame.oneShot')}</p>
          <Button variant="primary" onClick={begin}>
            {t('minigames:bingo.start')}
          </Button>
        </div>
      )}
      {phase === 'play' && (
        <div className={s.stack}>
          <div className={s.announcement}>
            <strong>
              {t('minigames:bingo.announcementTitle')} – {customer}
            </strong>
            {board.correct.map((w, i) => (
              <p key={w}>{fragments[i % fragments.length].replace('{{w}}', t(`minigames:buzzwords.${w}`))}</p>
            ))}
          </div>
          <div className={s.timer} data-low={left <= 5}>
            {t('minigames:bingo.timeLeft', { seconds: left })}
          </div>
          <div className={s.bingo}>
            {board.words.map((w) => (
              <button key={w} className={s.bingoCell} aria-pressed={picked.includes(w)} onClick={() => toggle(w)}>
                {t(`minigames:buzzwords.${w}`)}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => finish(left)}>
            {t('minigames:bingo.done')}
          </Button>
        </div>
      )}
      {phase === 'done' && score !== null && (
        <div className={s.stack}>
          <p className={s.score}>{t('minigames:bingo.result', { score })}</p>
          <p>{t(score >= 60 ? 'minigames:bingo.resultGood' : 'minigames:bingo.resultBad')}</p>
          <Button variant="primary" onClick={onClose}>
            {t('minigame.back')}
          </Button>
        </div>
      )}
    </Modal>
  )
}
