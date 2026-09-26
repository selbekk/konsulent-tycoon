import { describe, expect, it } from 'vitest'
import { H, ROW_MINUTES, invaderPos, newInvaders, playerY, step, stepInterval } from './invaders'
import type { Input, InvadersState } from './invaders'

const idle: Input = { left: false, right: false, fire: false }
const never = () => 0.99

function playing(): InvadersState {
  const s = newInvaders()
  s.phase = 'play'
  s.enemyFireTimer = Infinity
  s.ufoTimer = Infinity
  return s
}

describe('Møteinvasjonen', () => {
  it('shows the day banner before the first wave', () => {
    const s = newInvaders()
    step(s, idle, 0.5, never)
    expect(s.phase).toBe('banner')
    step(s, idle, 2, never)
    expect(s.phase).toBe('play')
  })

  it('keeps the player on screen', () => {
    const s = playing()
    for (let i = 0; i < 100; i++) step(s, { ...idle, left: true }, 0.05, never)
    expect(s.playerX).toBeGreaterThanOrEqual(0)
  })

  it('allows one declined meeting in the air at a time', () => {
    const s = playing()
    step(s, { ...idle, fire: true }, 0.01, never)
    const first = s.playerShot
    expect(first).not.toBeNull()
    step(s, { ...idle, fire: true }, 0.3, never)
    expect(s.playerShot).toBe(first)
    expect(s.cues.filter((c) => c === 'shoot')).toHaveLength(1)
  })

  it('scores a hit by the row it came from', () => {
    const s = playing()
    const target = s.invaders.find((i) => i.row === 3 && i.col === 0)!
    const p = invaderPos(s, target)
    s.stepTimer = Infinity
    s.playerShot = { x: p.x + 4, y: p.y + 7, vy: -1 }
    step(s, idle, 0.01, never)
    expect(target.alive).toBe(false)
    expect(s.score).toBe(ROW_MINUTES[3])
    expect(s.playerShot).toBeNull()
  })

  it('speeds up as the formation thins and with every wave', () => {
    expect(stepInterval(24, 0)).toBeGreaterThan(stepInterval(12, 0))
    expect(stepInterval(12, 0)).toBeGreaterThan(stepInterval(1, 0))
    expect(stepInterval(24, 0)).toBeGreaterThan(stepInterval(24, 3))
  })

  it('moves on to the next day when every meeting is declined', () => {
    const s = playing()
    for (const i of s.invaders.slice(1)) i.alive = false
    const last = s.invaders[0]
    const p = invaderPos(s, last)
    s.stepTimer = Infinity
    s.playerShot = { x: p.x + 4, y: p.y + 7, vy: -1 }
    step(s, idle, 0.01, never)
    expect(s.wave).toBe(1)
    expect(s.phase).toBe('banner')
    expect(s.invaders.every((i) => i.alive)).toBe(true)
  })

  it('ends when a meeting reaches your desk', () => {
    const s = playing()
    s.fy = playerY()
    step(s, idle, 0.01, never)
    expect(s.phase).toBe('over')
    expect(s.ending).toBe('calendarFull')
  })

  it('costs a coffee per hit, with a moment of grace, and ends when the coffee is gone', () => {
    const s = playing()
    s.lives = 2
    const hitPlayer = () => s.enemyShots.push({ x: s.playerX + 4, y: playerY() + 1, vy: 0 })
    hitPlayer()
    step(s, idle, 0.01, never)
    expect(s.lives).toBe(1)
    hitPlayer()
    step(s, idle, 0.01, never)
    expect(s.lives).toBe(1)
    s.invulnerable = 0
    step(s, idle, 0.01, never)
    expect(s.phase).toBe('over')
    expect(s.ending).toBe('outOfCoffee')
  })

  it('lets shields soak up shots', () => {
    const s = playing()
    const sh = s.shields[0]
    const before = sh.cells.filter(Boolean).length
    s.enemyShots.push({ x: sh.x + 8, y: H - 34 + 1, vy: 0 })
    step(s, idle, 0.01, never)
    expect(s.enemyShots).toHaveLength(0)
    expect(sh.cells.filter(Boolean).length).toBeLessThan(before)
  })
})
