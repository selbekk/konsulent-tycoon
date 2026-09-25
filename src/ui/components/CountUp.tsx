import { useEffect, useState } from 'react'
import { useGame } from '../../store/gameStore'

/**
 * A number that ticks up from zero, like a slot machine paying out. Screen readers (and tests)
 * get the final value straight away; with reduced motion, so does everyone else.
 */
export function CountUp({ value, format, duration = 900 }: { value: number; format: (n: number) => string; duration?: number }) {
  const setting = useGame((x) => x.settings.reducedMotion)
  const reduced = setting || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  const animate = !reduced && typeof requestAnimationFrame !== 'undefined'
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setShown(value * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, animate, duration])

  return (
    <>
      <span aria-hidden>{format(animate ? shown : value)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
