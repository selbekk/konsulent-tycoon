import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '../components/ui'
import { Icon } from '../components/Icon'
import { useReducedMotion } from '../motion'
import { playSound } from '../sound'
import type { SoundName } from '../sound'
import {
  DAYS,
  H,
  ROW_MINUTES,
  SHIELD_SIZE,
  UFO_MINUTES,
  UFO_ROW,
  W,
  invaderPos,
  newInvaders,
  playerY,
  shieldY,
  step,
} from './invaders'
import type { Input, InvadersState, Kind, SoundCue } from './invaders'
import { INVADER_SPRITES, PLAYER_SPRITE, POP_SPRITE, UFO_SPRITE } from './sprites'
import s from './invaders.module.css'

const BEST_KEY = 'kt.invaders.best'
const SHAKE_S = 0.3
const KINDS: Kind[] = ['workshop', 'sync', 'status', 'coffee']

const CUE_SOUNDS: Record<SoundCue, SoundName> = {
  shoot: 'pew',
  hit: 'pop',
  hurt: 'bad',
  ufo: 'alert',
  wave: 'confirm',
  over: 'sad',
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function writeBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* private mode: the record just won't stick */
  }
}

/** Canvas can't read CSS variables, so the theme tokens are resolved once per theme. */
function readColors() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim() || '#888'
  return {
    bg: v('--bg-2'),
    ground: v('--border'),
    player: v('--text'),
    shot: v('--good'),
    enemyShot: v('--bad'),
    shield: v('--good'),
    ufo: v('--accent-2'),
    pop: v('--warn'),
    rows: [v('--accent-2'), v('--info'), v('--accent'), v('--warn')],
  }
}
type Colors = ReturnType<typeof readColors>

function blit(ctx: CanvasRenderingContext2D, bitmap: string[], x: number, y: number, color: string) {
  ctx.fillStyle = color
  const ox = Math.round(x)
  const oy = Math.round(y)
  for (let r = 0; r < bitmap.length; r++)
    for (let c = 0; c < bitmap[r].length; c++) if (bitmap[r][c] === '#') ctx.fillRect(ox + c, oy + r, 1, 1)
}

function draw(ctx: CanvasRenderingContext2D, g: InvadersState, colors: Colors, reduced: boolean, shake: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, W, H)
  if (shake > 0 && !reduced) ctx.translate(Math.round(Math.random() * 2 - 1), Math.round(Math.random() * 2 - 1))

  for (const inv of g.invaders) {
    if (!inv.alive) continue
    const p = invaderPos(g, inv)
    blit(ctx, INVADER_SPRITES[inv.kind][g.frame], p.x, p.y, colors.rows[inv.row])
  }
  if (g.ufo) blit(ctx, UFO_SPRITE, g.ufo.x, UFO_ROW, colors.ufo)

  ctx.fillStyle = colors.shield
  for (const sh of g.shields)
    sh.cells.forEach((on, i) => {
      if (on) ctx.fillRect(sh.x + (i % SHIELD_SIZE.w), shieldY() + Math.floor(i / SHIELD_SIZE.w), 1, 1)
    })

  // While invulnerable the player blinks, or just fades when motion is reduced.
  const blink = g.invulnerable > 0 && (reduced || Math.floor(g.invulnerable * 8) % 2 === 0)
  ctx.globalAlpha = blink ? 0.35 : 1
  if (g.phase !== 'over' || g.ending !== 'outOfCoffee') blit(ctx, PLAYER_SPRITE, g.playerX, playerY(), colors.player)
  ctx.globalAlpha = 1

  if (g.playerShot) {
    ctx.fillStyle = colors.shot
    ctx.fillRect(Math.round(g.playerShot.x), Math.round(g.playerShot.y), 1, 3)
  }
  // Action items wiggle on their way down.
  ctx.fillStyle = colors.enemyShot
  for (const e of g.enemyShots) {
    const x = Math.round(e.x)
    const y = Math.round(e.y)
    const k = Math.floor(e.y / 3) % 2
    ctx.fillRect(x + k, y, 1, 1)
    ctx.fillRect(x + 1 - k, y + 1, 1, 1)
    ctx.fillRect(x + k, y + 2, 1, 1)
  }
  for (const p of g.pops) blit(ctx, POP_SPRITE, p.x - 4, p.y - 4, colors.pop)

  ctx.fillStyle = colors.ground
  ctx.fillRect(0, H - 4, W, 1)
}

/** A sprite as inline SVG, for the legend on the intro screen. */
function SpriteSvg({ bitmap, color }: { bitmap: string[]; color: string }) {
  const w = bitmap[0].length
  return (
    <svg
      className={s.legendSprite}
      viewBox={`0 0 ${w} ${bitmap.length}`}
      style={{ width: w * 2, color }}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {bitmap.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
    </svg>
  )
}

const ROW_TOKENS = ['var(--accent-2)', 'var(--info)', 'var(--accent)', 'var(--warn)']

interface Hud {
  wave: number
  score: number
  lives: number
  phase: InvadersState['phase']
  ending: InvadersState['ending']
}
const hudOf = (g: InvadersState): Hud => ({
  wave: g.wave,
  score: g.score,
  lives: g.lives,
  phase: g.phase,
  ending: g.ending,
})

export function MeetingInvaders({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<Hud>(() => hudOf(newInvaders()))
  const [best, setBest] = useState(readBest)
  const [newBest, setNewBest] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const againRef = useRef<HTMLButtonElement>(null)
  const game = useRef<InvadersState>(newInvaders())
  const input = useRef<Input>({ left: false, right: false, fire: false })
  const colors = useRef<Colors | null>(null)

  // The theme can't change while the dialog is open (settings is its own screen), so once is enough.
  useEffect(() => {
    colors.current = readColors()
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) draw(ctx, game.current, colors.current, true, 0)
  }, [])

  // The dialog focuses its close button first; the game wants Start (and later Try again) focused instead.
  const over = hud.phase === 'over'
  // Try again waits a moment, and held keys are ignored, so a held fire button doesn't restart the game at once.
  useEffect(() => {
    const id = setTimeout(() => (over ? againRef : startRef).current?.focus(), over ? 700 : 0)
    const swallowHeld = (e: KeyboardEvent) => {
      if (e.repeat && (e.key === ' ' || e.key === 'Enter')) e.preventDefault()
    }
    if (over) window.addEventListener('keydown', swallowHeld)
    return () => {
      clearTimeout(id)
      window.removeEventListener('keydown', swallowHeld)
    }
  }, [over])

  const start = useCallback(() => {
    game.current = newInvaders()
    input.current = { left: false, right: false, fire: false }
    setHud(hudOf(game.current))
    setNewBest(false)
    setRunning(true)
    canvasRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!running) return
    const map = (key: string): keyof Input | null =>
      key === 'ArrowLeft' || key === 'a' || key === 'A'
        ? 'left'
        : key === 'ArrowRight' || key === 'd' || key === 'D'
          ? 'right'
          : key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W'
            ? 'fire'
            : null
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = map(e.key)
      if (!k || game.current.phase === 'over') return
      // Keep Space from clicking whichever button has focus, and arrows from scrolling.
      e.preventDefault()
      input.current[k] = down
    }
    const onDown = onKey(true)
    const onUp = onKey(false)
    const release = () => (input.current = { left: false, right: false, fire: false })
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', release)

    let raf = 0
    let last = performance.now()
    let shake = 0
    let prev = hudOf(game.current)
    const frame = (now: number) => {
      // Capped so a background tab doesn't come back to a teleported formation.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const g = step(game.current, input.current, dt, Math.random)
      for (const cue of g.cues) {
        if (cue === 'hurt') shake = SHAKE_S
        playSound(cue === 'wave' && g.wave % DAYS.length === 0 ? 'fanfare' : CUE_SOUNDS[cue])
      }
      g.cues = []
      shake = Math.max(0, shake - dt)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && colors.current) draw(ctx, g, colors.current, reduced, shake)
      const next = hudOf(g)
      if (Object.keys(next).some((k) => next[k as keyof Hud] !== prev[k as keyof Hud])) {
        prev = next
        setHud(next)
      }
      if (g.phase === 'over') {
        // Record the best week and hand the screen over to the result.
        const record = readBest()
        if (g.score > record) {
          writeBest(g.score)
          setBest(g.score)
          setNewBest(true)
        }
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', release)
    }
  }, [running, reduced])

  const time = (minutes: number) =>
    t('minigames:invaders.time', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  const day = (wave: number) =>
    t('minigames:invaders.day', {
      day: t(`minigames:invaders.days.${DAYS[wave % DAYS.length]}`),
      week: Math.floor(wave / DAYS.length) + 1,
    })
  const playing = running || over

  // Touch buttons hold while pressed, like a real arcade stick.
  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      input.current[k] = true
    },
    onPointerUp: () => (input.current[k] = false),
    onPointerLeave: () => (input.current[k] = false),
    onPointerCancel: () => (input.current[k] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  return (
    <Modal title={t('minigames:invaders.title')} icon="calendar" onClose={onClose}>
      <div className={s.wrap}>
        <div className={s.hud}>
          <span>{day(hud.wave)}</span>
          <span className="num">
            {t('minigames:invaders.saved')}: {time(hud.score)}
          </span>
          <span
            className={s.lives}
            role="img"
            aria-label={t('minigames:invaders.coffee', { count: Math.max(0, hud.lives) })}
          >
            {Array.from({ length: Math.max(0, hud.lives) }, (_, i) => (
              <Icon key={i} name="coffee" size={14} />
            ))}
          </span>
        </div>
        <div className={s.stage}>
          <canvas
            ref={canvasRef}
            className={s.canvas}
            width={W}
            height={H}
            role="img"
            aria-label={t('minigames:invaders.title')}
            tabIndex={-1}
          />
          {!playing && (
            <div className={s.overlay}>
              <p>{t('minigames:invaders.intro')}</p>
              <ul className={s.legend}>
                {KINDS.map((k, row) => (
                  <li key={k}>
                    <SpriteSvg bitmap={INVADER_SPRITES[k][0]} color={ROW_TOKENS[row]} />
                    <span>{t(`minigames:invaders.kinds.${k}`)}</span>
                    <span className="num">{time(ROW_MINUTES[row])}</span>
                  </li>
                ))}
                <li>
                  <SpriteSvg bitmap={UFO_SPRITE} color="var(--accent-2)" />
                  <span>{t('minigames:invaders.kinds.allhands')}</span>
                  <span className="num">{time(UFO_MINUTES)}</span>
                </li>
              </ul>
              <p className={s.muted}>{t('minigames:invaders.controls')}</p>
              <Button ref={startRef} variant="primary" onClick={start}>
                {t('minigames:invaders.start')}
              </Button>
            </div>
          )}
          {running && hud.phase === 'banner' && (
            <div className={s.banner} role="status">
              {hud.wave > 0 && hud.wave % DAYS.length === 0 && <span>{t('minigames:invaders.weekend')}</span>}
              <strong>{day(hud.wave)}</strong>
            </div>
          )}
          {over && (
            <div className={s.overlay} role="status">
              <p className={s.ending}>{t(`minigames:invaders.endings.${hud.ending ?? 'calendarFull'}`)}</p>
              <p className={s.result}>{t('minigames:invaders.result', { time: time(hud.score) })}</p>
              <p className={s.muted}>
                {newBest ? t('minigames:invaders.newBest') : t('minigames:invaders.best', { time: time(best) })}
              </p>
              <div className={s.actions}>
                <Button ref={againRef} variant="primary" onClick={start}>
                  {t('minigames:invaders.again')}
                </Button>
                <Button onClick={onClose}>{t('common.close')}</Button>
              </div>
            </div>
          )}
        </div>
        {running && (
          <div className={s.touch}>
            <button type="button" aria-label={t('minigames:invaders.left')} {...hold('left')}>
              <span className={s.flip}>
                <Icon name="arrow" size={16} />
              </span>
            </button>
            <button type="button" className={s.fire} {...hold('fire')}>
              {t('minigames:invaders.fire')}
            </button>
            <button type="button" aria-label={t('minigames:invaders.right')} {...hold('right')}>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
