import { useState } from 'react'
import { useReducedMotion } from '../motion'
import { playSound } from '../sound'
import { useKeySequence } from './useKeySequence'
import s from './eggs.module.css'

const BILLS = 36
const RAIN_MS = 3800

/** Typing "faktura" in the game makes it rain money. Purely for the feeling; nothing is added to the accounts. */
export function MoneyRain() {
  const reducedMotion = useReducedMotion()
  const [shower, setShower] = useState<number | null>(null)
  useKeySequence('faktura', () => {
    playSound('cash')
    if (reducedMotion) return
    const id = Date.now()
    setShower(id)
    setTimeout(() => setShower((x) => (x === id ? null : x)), RAIN_MS)
  })
  if (shower === null) return null
  return (
    <div className={s.rain} aria-hidden key={shower}>
      {Array.from({ length: BILLS }, (_, i) => (
        <svg
          key={i}
          className={s.bill}
          viewBox="0 0 12 6"
          shapeRendering="crispEdges"
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i * 173) % 1400}ms`,
            animationDuration: `${1800 + ((i * 97) % 900)}ms`,
            ['--sway' as string]: `${((i % 5) - 2) * 14}px`,
          }}
        >
          <rect width="12" height="6" fill="var(--good)" />
          <rect x="1" y="1" width="10" height="4" fill="none" stroke="var(--border-dark)" strokeWidth="0.5" />
          <rect x="5" y="2" width="2" height="2" fill="var(--border-dark)" />
        </svg>
      ))}
    </div>
  )
}
