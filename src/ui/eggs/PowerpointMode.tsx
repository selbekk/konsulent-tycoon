import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playSound } from '../sound'
import { useKeySequence } from './useKeySequence'
import s from './powerpoint.module.css'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const

// A paperclip with opinions. '#' is wire, 'o' eye whites, '*' pupils.
const CLIP = [
  '...####...',
  '..#....#..',
  '.#......#.',
  '.#.oo.oo#.',
  '.#.o*.o*#.',
  '.#......#.',
  '.#..##..#.',
  '.#.#..#.#.',
  '.#.#..#.#.',
  '.#.#..#.#.',
  '.#.#..#.#.',
  '.#.#..#.#.',
  '.#..#.#.#.',
  '..#...#.#.',
  '...###..#.',
  '.......#..',
]
const CLIP_FILL: Record<string, string> = { '#': 'var(--muted)', o: '#fff', '*': '#1b1b2f' }

function Clip() {
  return (
    <svg className={s.clip} viewBox="0 0 10 16" shapeRendering="crispEdges" aria-hidden>
      {CLIP.flatMap((row, y) =>
        [...row].map((ch, x) =>
          CLIP_FILL[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={CLIP_FILL[ch]} /> : null,
        ),
      )}
    </svg>
  )
}

/** The Konami code turns the game into a 2003 slide deck, with a helpful paperclip, until the page reloads. */
export function PowerpointMode() {
  const { t } = useTranslation()
  const [on, setOn] = useState(false)
  const [tip, setTip] = useState(0)
  useKeySequence(KONAMI, () => {
    playSound('fanfare')
    setOn((x) => !x)
  })

  useEffect(() => {
    if (!on) return
    document.documentElement.dataset.egg = 'ppt'
    return () => {
      delete document.documentElement.dataset.egg
    }
  }, [on])

  if (!on) return null
  const tips = t('eggs.powerpoint.tips', { returnObjects: true }) as string[]
  return (
    <aside className={s.helper} aria-label={t('eggs.powerpoint.name')}>
      <Clip />
      <div className={s.bubble} role="status">
        <p>{tips[tip % tips.length]}</p>
        <div className={s.actions}>
          <button type="button" onClick={() => setTip(tip + 1)}>
            {t('eggs.powerpoint.next')}
          </button>
          <button type="button" onClick={() => setOn(false)}>
            {t('eggs.powerpoint.off')}
          </button>
        </div>
      </div>
    </aside>
  )
}
