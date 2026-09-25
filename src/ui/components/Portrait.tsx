import { createRng, hashString, nextFloat } from '../../engine'

// Illustration palette (like BjornPortrait): skin, hair, shirts and backgrounds are art, not theme colours.
const SKIN = ['#f6d7b8', '#f2c9a0', '#e0ac7e', '#c68a5c', '#9a6440', '#6e4428']
const HAIR = ['#1b1b2f', '#3b2416', '#6b4226', '#c9a45c', '#b5532a', '#d9d9d9', '#7a5cff']
const SHIRT = ['#1c1a5e', '#e53170', '#2a9d8f', '#ff9e2c', '#5b47d6', '#3a3a4a', '#48d597']
const BACKDROP = ['#4cc9f0', '#ffd84d', '#ff8fab', '#90e0a8', '#b8a9ff', '#ffb870']
const STYLES = ['short', 'long', 'bald', 'bun', 'curly', 'side'] as const

type Px = [x: number, y: number, w: number, h: number]

const HAIR_SHAPES: Record<(typeof STYLES)[number], Px[]> = {
  short: [[3, 1, 6, 2]],
  long: [
    [3, 1, 6, 2],
    [2, 2, 1, 6],
    [9, 2, 1, 6],
  ],
  bald: [
    [2, 3, 1, 2],
    [9, 3, 1, 2],
  ],
  bun: [
    [5, 0, 2, 1],
    [3, 1, 6, 2],
  ],
  curly: [
    [2, 0, 8, 2],
    [2, 2, 2, 1],
    [8, 2, 2, 1],
    [2, 3, 1, 1],
    [9, 3, 1, 1],
  ],
  side: [
    [3, 1, 6, 1],
    [3, 2, 2, 1],
    [2, 2, 1, 3],
  ],
}

/** A small pixel face, the same every time for the same seed (an employee or star id). */
export function Portrait({ seed, size = 32 }: { seed: string; size?: number }) {
  const rng = createRng(hashString(seed))
  const pickOf = <T,>(xs: readonly T[]) => xs[Math.floor(nextFloat(rng) * xs.length)]
  const skin = pickOf(SKIN)
  const hair = pickOf(HAIR)
  const shirt = pickOf(SHIRT)
  const bg = pickOf(BACKDROP)
  const style = pickOf(STYLES)
  const glasses = nextFloat(rng) < 0.3
  const beard = nextFloat(rng) < 0.18
  const rect = ([x, y, w, h]: Px, fill: string, key: string, opacity?: number) => (
    <rect key={key} x={x} y={y} width={w} height={h} fill={fill} opacity={opacity} />
  )
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden
      style={{
        flexShrink: 0,
        border: '2px solid var(--border-dark)',
        borderRadius: 'var(--radius-sm)',
        background: bg,
      }}
    >
      {rect([3, 2, 6, 6], skin, 'face')}
      {rect([2, 8, 8, 4], shirt, 'shirt')}
      {rect([5, 8, 2, 1], skin, 'neck')}
      {HAIR_SHAPES[style].map((p, i) => rect(p, hair, `h${i}`))}
      {beard && rect([3, 6, 6, 2], hair, 'beard')}
      {glasses && rect([3, 4, 5, 1], '#1b1b2f', 'glasses', 0.45)}
      {rect([4, 4, 1, 1], '#1b1b2f', 'eyeL')}
      {rect([7, 4, 1, 1], '#1b1b2f', 'eyeR')}
      {rect([5, 6, 2, 1], beard ? '#1b1b2f' : '#b98b6b', 'mouth', beard ? 0.5 : undefined)}
    </svg>
  )
}
