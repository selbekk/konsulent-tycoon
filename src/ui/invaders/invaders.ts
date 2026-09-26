/**
 * «Møteinvasjonen»: the easter egg behind typing "start" on the main menu.
 * Space Invaders, except the invaders are meeting invites and you decline them.
 *
 * UI-only on purpose (it never touches the engine or GameState), but kept free of the
 * DOM so the rules can be tested in Node. Positions are in logical canvas pixels.
 */

export const W = 128
export const H = 160
const COLS = 6
const ROWS = 4
const GAP_X = 14
const GAP_Y = 12
const SPRITE = 8
const PLAYER_Y = H - 14
const PLAYER_SPEED = 70
const PLAYER_SHOT_SPEED = 160
const ENEMY_SHOT_SPEED = 55
const MAX_ENEMY_SHOTS = 3
const STEP_PX = 2
const DROP_PX = 4
/** Seconds between formation steps with a full formation on the first wave. */
const STEP_SLOW = 0.4
const STEP_FAST = 0.05
const INVULNERABLE_S = 1.5
const BANNER_S = 1.6
const LIVES = 3
const SHIELD_Y = H - 34
const SHIELD_W = 16
const SHIELD_H = 6
const UFO_Y = 12
const UFO_W = 16
const UFO_SPEED = 30
/** Minutes of your life each declined meeting gives back, top row first. */
export const ROW_MINUTES = [60, 45, 30, 15] as const
export const UFO_MINUTES = 120
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

export type Kind = 'workshop' | 'sync' | 'status' | 'coffee'
const ROW_KINDS: Kind[] = ['workshop', 'sync', 'status', 'coffee']

export interface Invader {
  col: number
  row: number
  kind: Kind
  alive: boolean
}
export interface Shot {
  x: number
  y: number
  vy: number
}
export interface Pop {
  x: number
  y: number
  t: number
}
export interface Shield {
  x: number
  /** Row-major SHIELD_W × SHIELD_H cells; true means still standing. */
  cells: boolean[]
}
export type Phase = 'play' | 'banner' | 'over'
export type Ending = 'calendarFull' | 'outOfCoffee'
export type SoundCue = 'shoot' | 'hit' | 'hurt' | 'ufo' | 'wave' | 'over'

export interface InvadersState {
  phase: Phase
  ending: Ending | null
  /** 0-based; the day is DAYS[wave % 5] and the week is floor(wave / 5) + 1. */
  wave: number
  score: number
  lives: number
  playerX: number
  invulnerable: number
  cooldown: number
  invaders: Invader[]
  /** Formation origin and direction (+1 right, -1 left). */
  fx: number
  fy: number
  dir: 1 | -1
  stepTimer: number
  /** Toggles on every step for the two-frame walk. */
  frame: 0 | 1
  playerShot: Shot | null
  enemyShots: Shot[]
  enemyFireTimer: number
  shields: Shield[]
  ufo: { x: number; dir: 1 | -1 } | null
  ufoTimer: number
  pops: Pop[]
  bannerTimer: number
  /** Sounds to play this frame; the component drains it. */
  cues: SoundCue[]
}

export interface Input {
  left: boolean
  right: boolean
  fire: boolean
}

export type Rand = () => number

function newShields(): Shield[] {
  const gap = (W - 3 * SHIELD_W) / 4
  return [0, 1, 2].map((i) => ({
    x: Math.round(gap + i * (SHIELD_W + gap)),
    // A little bunker: rounded top corners and a notch underneath.
    cells: Array.from({ length: SHIELD_W * SHIELD_H }, (_, k) => {
      const x = k % SHIELD_W
      const y = Math.floor(k / SHIELD_W)
      if (y === 0 && (x < 2 || x > SHIELD_W - 3)) return false
      if (y >= SHIELD_H - 2 && x >= 5 && x <= SHIELD_W - 6) return false
      return true
    }),
  }))
}

function newFormation(): Invader[] {
  return Array.from({ length: ROWS * COLS }, (_, i) => ({
    col: i % COLS,
    row: Math.floor(i / COLS),
    kind: ROW_KINDS[Math.floor(i / COLS)],
    alive: true,
  }))
}

/** Later waves start lower, like the arcade original, but never closer than four rows above the shields. */
function formationTop(wave: number) {
  return 22 + Math.min(wave, 6) * 3
}

export function newInvaders(): InvadersState {
  return {
    phase: 'banner',
    ending: null,
    wave: 0,
    score: 0,
    lives: LIVES,
    playerX: W / 2 - SPRITE / 2,
    invulnerable: 0,
    cooldown: 0,
    invaders: newFormation(),
    fx: (W - (COLS - 1) * GAP_X - SPRITE) / 2,
    fy: formationTop(0),
    dir: 1,
    stepTimer: 0,
    frame: 0,
    playerShot: null,
    enemyShots: [],
    enemyFireTimer: 1.5,
    shields: newShields(),
    ufo: null,
    ufoTimer: 12,
    pops: [],
    bannerTimer: BANNER_S,
    cues: [],
  }
}

export function invaderPos(s: InvadersState, inv: Invader) {
  return { x: s.fx + inv.col * GAP_X, y: s.fy + inv.row * GAP_Y }
}

export function playerY() {
  return PLAYER_Y
}

export function shieldY() {
  return SHIELD_Y
}

export const SHIELD_SIZE = { w: SHIELD_W, h: SHIELD_H }
export const UFO_ROW = UFO_Y

/** Seconds between steps: speeds up as the formation thins out and with every wave. */
export function stepInterval(alive: number, wave: number) {
  const left = alive / (ROWS * COLS)
  const base = STEP_FAST + (STEP_SLOW - STEP_FAST) * left
  return Math.max(STEP_FAST, base * 0.88 ** wave)
}

function hit(ax: number, ay: number, bx: number, by: number, bw: number, bh: number) {
  return ax >= bx && ax < bx + bw && ay >= by && ay < by + bh
}

/** Erodes the shield cell under a shot, plus a neighbour, and reports whether it hit. */
function hitShield(s: InvadersState, shot: Shot, rand: Rand) {
  for (const sh of s.shields) {
    const cx = Math.floor(shot.x - sh.x)
    const cy = Math.floor(shot.y - SHIELD_Y)
    if (cx < 0 || cx >= SHIELD_W || cy < 0 || cy >= SHIELD_H) continue
    const i = cy * SHIELD_W + cx
    if (!sh.cells[i]) continue
    sh.cells[i] = false
    const nx = cx + (rand() < 0.5 ? -1 : 1)
    if (nx >= 0 && nx < SHIELD_W) sh.cells[cy * SHIELD_W + nx] = false
    return true
  }
  return false
}

function startWave(s: InvadersState) {
  s.invaders = newFormation()
  s.fx = (W - (COLS - 1) * GAP_X - SPRITE) / 2
  s.fy = formationTop(s.wave)
  s.dir = 1
  s.stepTimer = 0
  s.playerShot = null
  s.enemyShots = []
  s.enemyFireTimer = 1.2
  s.ufo = null
  // A new week brings fresh bunkers.
  if (s.wave % DAYS.length === 0) s.shields = newShields()
}

/** Advances the game by dt seconds. Mutates and returns the state. */
export function step(s: InvadersState, input: Input, dt: number, rand: Rand): InvadersState {
  for (const p of s.pops) p.t -= dt
  s.pops = s.pops.filter((p) => p.t > 0)
  if (s.phase === 'over') return s
  if (s.phase === 'banner') {
    s.bannerTimer -= dt
    if (s.bannerTimer <= 0) s.phase = 'play'
    return s
  }

  // Player.
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  s.playerX = Math.max(1, Math.min(W - SPRITE - 1, s.playerX + move * PLAYER_SPEED * dt))
  s.invulnerable = Math.max(0, s.invulnerable - dt)
  s.cooldown = Math.max(0, s.cooldown - dt)
  if (input.fire && !s.playerShot && s.cooldown === 0) {
    s.playerShot = { x: s.playerX + SPRITE / 2, y: PLAYER_Y - 1, vy: -PLAYER_SHOT_SPEED }
    s.cooldown = 0.15
    s.cues.push('shoot')
  }

  // Formation steps.
  const alive = s.invaders.filter((i) => i.alive)
  s.stepTimer -= dt
  if (s.stepTimer <= 0) {
    s.stepTimer = stepInterval(alive.length, s.wave)
    s.frame = s.frame ? 0 : 1
    const xs = alive.map((i) => invaderPos(s, i).x)
    const next = s.dir * STEP_PX
    if (Math.min(...xs) + next < 1 || Math.max(...xs) + SPRITE + next > W - 1) {
      s.fy += DROP_PX
      s.dir = s.dir === 1 ? -1 : 1
    } else {
      s.fx += next
    }
  }
  const lowest = Math.max(...alive.map((i) => invaderPos(s, i).y)) + SPRITE
  // Meetings that reach the shields bulldoze them.
  if (lowest >= SHIELD_Y) {
    for (const sh of s.shields) {
      for (const inv of alive) {
        const p = invaderPos(s, inv)
        for (let y = Math.max(0, Math.floor(p.y - SHIELD_Y)); y < Math.min(SHIELD_H, p.y + SPRITE - SHIELD_Y); y++)
          for (let x = Math.max(0, Math.floor(p.x - sh.x)); x < Math.min(SHIELD_W, p.x + SPRITE - sh.x); x++)
            sh.cells[y * SHIELD_W + x] = false
      }
    }
  }
  if (lowest >= PLAYER_Y) {
    s.phase = 'over'
    s.ending = 'calendarFull'
    s.cues.push('over')
    return s
  }

  // Enemy fire comes from the lowest invite in a random column.
  s.enemyFireTimer -= dt
  if (s.enemyFireTimer <= 0 && s.enemyShots.length < MAX_ENEMY_SHOTS) {
    s.enemyFireTimer = Math.max(0.35, 1.3 - s.wave * 0.1) * (0.6 + rand() * 0.8)
    const cols = [...new Set(alive.map((i) => i.col))]
    const col = cols[Math.floor(rand() * cols.length)]
    const shooter = alive.filter((i) => i.col === col).reduce((a, b) => (b.row > a.row ? b : a))
    const p = invaderPos(s, shooter)
    s.enemyShots.push({ x: p.x + SPRITE / 2, y: p.y + SPRITE, vy: ENEMY_SHOT_SPEED + s.wave * 4 })
  }

  // The all-hands flies past now and then.
  if (s.ufo) {
    s.ufo.x += s.ufo.dir * UFO_SPEED * dt
    if (s.ufo.x < -UFO_W || s.ufo.x > W) s.ufo = null
  } else {
    s.ufoTimer -= dt
    if (s.ufoTimer <= 0) {
      s.ufoTimer = 14 + rand() * 10
      const dir = rand() < 0.5 ? 1 : -1
      s.ufo = { x: dir === 1 ? -UFO_W : W, dir }
      s.cues.push('ufo')
    }
  }

  // Player shot.
  const shot = s.playerShot
  if (shot) {
    shot.y += shot.vy * dt
    if (shot.y < 0) s.playerShot = null
    else if (hitShield(s, shot, rand)) s.playerShot = null
    else if (s.ufo && hit(shot.x, shot.y, s.ufo.x, UFO_Y, UFO_W, 7)) {
      s.score += UFO_MINUTES
      s.pops.push({ x: s.ufo.x + UFO_W / 2, y: UFO_Y + 3, t: 0.5 })
      s.ufo = null
      s.playerShot = null
      s.cues.push('hit')
    } else {
      const target = alive.find((i) => {
        const p = invaderPos(s, i)
        return hit(shot.x, shot.y, p.x, p.y, SPRITE, SPRITE)
      })
      if (target) {
        target.alive = false
        const p = invaderPos(s, target)
        s.score += ROW_MINUTES[target.row]
        s.pops.push({ x: p.x + SPRITE / 2, y: p.y + SPRITE / 2, t: 0.3 })
        s.playerShot = null
        s.cues.push('hit')
      }
    }
  }

  // Enemy shots.
  for (const e of s.enemyShots) e.y += e.vy * dt
  s.enemyShots = s.enemyShots.filter((e) => {
    if (e.y > H) return false
    if (hitShield(s, e, rand)) return false
    if (s.playerShot && Math.abs(s.playerShot.x - e.x) < 2 && Math.abs(s.playerShot.y - e.y) < 3) {
      s.playerShot = null
      return false
    }
    if (s.invulnerable === 0 && hit(e.x, e.y, s.playerX, PLAYER_Y, SPRITE, SPRITE)) {
      s.lives -= 1
      s.invulnerable = INVULNERABLE_S
      s.pops.push({ x: s.playerX + SPRITE / 2, y: PLAYER_Y + 4, t: 0.5 })
      s.cues.push('hurt')
      return false
    }
    return true
  })
  if (s.lives <= 0) {
    s.phase = 'over'
    s.ending = 'outOfCoffee'
    s.cues.push('over')
    return s
  }

  if (s.invaders.every((i) => !i.alive)) {
    s.wave += 1
    s.phase = 'banner'
    s.bannerTimer = BANNER_S
    s.cues.push('wave')
    startWave(s)
  }
  return s
}
