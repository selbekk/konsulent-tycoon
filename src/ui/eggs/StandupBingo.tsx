import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGame } from '../../store/gameStore'
import { Button, Modal } from '../components/ui'
import { playSound } from '../sound'
import { MAX_STRIKES, bingoLine, setupStandup } from './standupRules'
import type { StandupLine } from './standupRules'
import s from './standup.module.css'

const LINE_MS = 2200
const GRACE_MS = 2500
const SHOWN_LINES = 4

type Phase = 'intro' | 'play' | 'done'
type Ending = 'bingo' | 'over' | 'caught'

export function StandupBingo({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const doubleTime = useGame((x) => x.settings.doubleTime)
  const lineMs = LINE_MS * (doubleTime ? 2 : 1)
  const [round, setRound] = useState(() => setupStandup(Math.random))
  const [phase, setPhase] = useState<Phase>('intro')
  const [said, setSaid] = useState(0)
  const [marked, setMarked] = useState<number[]>([])
  const [strikes, setStrikes] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const [ending, setEnding] = useState<Ending | null>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const spoken = round.script.slice(0, said)
  const win = bingoLine(marked)

  const finish = (how: Ending) => {
    setEnding(how)
    setPhase('done')
    playSound(how === 'bingo' ? 'fanfare' : 'sad')
  }

  // One line of stand-up at a time, then a moment of silence before the meeting ends.
  useEffect(() => {
    if (phase !== 'play') return
    const last = said >= round.script.length
    const id = setTimeout(
      () => {
        if (last) finish('over')
        else {
          setSaid(said + 1)
          playSound('blip')
        }
      },
      last ? GRACE_MS : lineMs,
    )
    return () => clearTimeout(id)
    // finish only reads stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, said, round.script.length, lineMs])

  // The dialog focuses its close button first; Enter right after typing the secret should join, not leave.
  useEffect(() => {
    const id = setTimeout(() => primary.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [phase])

  const begin = () => {
    setRound(setupStandup(Math.random))
    setSaid(0)
    setMarked([])
    setStrikes(0)
    setWrong(null)
    setEnding(null)
    setPhase('play')
  }

  const mark = (i: number) => {
    if (phase !== 'play' || marked.includes(i)) return
    if (!spoken.some((l) => l.phrase === round.card[i])) {
      setWrong(i)
      playSound('bad')
      const next = strikes + 1
      setStrikes(next)
      if (next >= MAX_STRIKES) finish('caught')
      return
    }
    const next = [...marked, i]
    setMarked(next)
    setWrong(null)
    playSound('confirm')
    if (bingoLine(next)) finish('bingo')
  }

  const line = (l: StandupLine, i: number) => {
    const speakers = t('minigames:standup.speakers', { returnObjects: true }) as string[]
    return (
      <p key={i}>
        <strong>{speakers[l.speaker % speakers.length]}:</strong> «{t(`minigames:standup.phrases.${l.phrase}`)}»
      </p>
    )
  }

  return (
    <Modal title={t('minigames:standup.title')} icon="people" onClose={onClose} wide>
      <div className={s.stack}>
        {phase === 'intro' && (
          <>
            <p>{t('minigames:standup.intro')}</p>
            <Button ref={primary} variant="primary" onClick={begin}>
              {t('minigames:standup.start')}
            </Button>
          </>
        )}
        {phase !== 'intro' && (
          <>
            <div className={s.transcript} aria-live="polite">
              {spoken.length === 0 ? (
                <p className={s.muted}>{t('minigames:standup.waiting')}</p>
              ) : (
                spoken.slice(-SHOWN_LINES).map((l, i) => line(l, said - SHOWN_LINES + i))
              )}
            </div>
            <div className={s.status}>
              <span className="num">{t('minigames:standup.strikes', { count: strikes, max: MAX_STRIKES })}</span>
              {wrong !== null && phase === 'play' && (
                <span className={s.warning} role="status">
                  {t('minigames:standup.notSaid')}
                </span>
              )}
            </div>
            <div className={s.card}>
              {round.card.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  className={s.cell}
                  aria-pressed={marked.includes(i)}
                  data-wrong={wrong === i || undefined}
                  data-win={win?.includes(i) || undefined}
                  disabled={phase !== 'play'}
                  onClick={() => mark(i)}
                >
                  {t(`minigames:standup.phrases.${p}`)}
                </button>
              ))}
            </div>
          </>
        )}
        {phase === 'done' && ending && (
          <>
            <p className={s.ending}>{t(`minigames:standup.endings.${ending}`)}</p>
            <div className={s.actions}>
              <Button ref={primary} variant="primary" onClick={begin}>
                {t('minigames:standup.again')}
              </Button>
              <Button onClick={onClose}>{t('common.close')}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
