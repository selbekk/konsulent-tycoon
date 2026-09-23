import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DISCIPLINES, MAX_QUARTERS, deleteSlot, listSlots } from '../../engine'
import { FIRMS } from '../../content/firms'
import type { Difficulty, Discipline, SlotId } from '../../engine'
import { LOCALES, setLocale } from '../../i18n'
import { useGame } from '../../store/gameStore'
import { Button, Hint, Panel, Slider } from '../components/ui'
import { isIosSafari, isStandalone, promptInstall, useCanInstall } from '../pwa/install'
import { playSound } from '../sound'
import { formatMoney, formatQuarter } from '../format'
import m from './menu.module.css'
import s from './screens.module.css'

function Skyline() {
  // Pixel-art Oslo-ish skyline: office blocks, a crane and the Opera roof.
  const blocks = [
    [0, 30, 10], [11, 20, 8], [20, 38, 12], [33, 26, 9], [43, 44, 10], [54, 18, 14], [69, 34, 9], [79, 50, 11],
    [91, 24, 10], [102, 40, 8], [111, 28, 12], [124, 46, 10], [135, 22, 13], [149, 36, 9], [159, 30, 11],
  ]
  return (
    <svg className={m.skyline} viewBox="0 0 170 60" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden>
      {blocks.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={60 - h} width={w} height={h} fill={i % 2 ? 'var(--panel-2)' : 'var(--panel)'} />
          {Array.from({ length: Math.floor(h / 6) }, (_, r) =>
            Array.from({ length: Math.floor(w / 3) }, (_, c) => (
              <rect key={`${r}-${c}`} x={x + 1 + c * 3} y={60 - h + 2 + r * 6} width={1} height={2} fill={(r * 7 + c * 3 + i) % 4 === 0 ? 'var(--warn)' : 'var(--bg)'} />
            )),
          )}
        </g>
      ))}
      <rect x="64" y="4" width="1" height="38" fill="var(--accent)" />
      <rect x="50" y="4" width="26" height="1" fill="var(--accent)" />
      <rect x="52" y="5" width="1" height="6" fill="var(--muted)" />
      <rect x="0" y="58" width="170" height="2" fill="var(--border-dark)" />
    </svg>
  )
}

/** Shown after saves this version of the game can't read were deleted. */
function DroppedSavesNotice() {
  const { t } = useTranslation()
  const dropped = useGame((x) => x.droppedSaves)
  const dismiss = useGame((x) => x.dismissDroppedSaves)
  if (dropped.length === 0) return null
  return (
    <div className={`${m.notice} ${m.dropped}`} role="alert">
      <p>{t('menu.savesDropped', { count: dropped.length })}</p>
      <Button size="small" onClick={dismiss}>
        {t('menu.savesDroppedOk')}
      </Button>
    </div>
  )
}

export function MainMenu() {
  const { t } = useTranslation()
  const go = useGame((x) => x.go)
  const load = useGame((x) => x.load)
  useGame((x) => x.droppedSaves)
  const canInstall = useCanInstall()
  const showIosHint = !canInstall && isIosSafari() && !isStandalone()
  const hasAuto = (() => {
    try {
      return listSlots(localStorage).some((x) => x.slot === 'auto' && x.status === 'playing')
    } catch {
      return false
    }
  })()
  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <h1 className={m.logo}>
          KONSULENT
          <br />
          TYCOON
        </h1>
        <p className={m.tagline}>{t('menu.tagline')}</p>
        <Skyline />
        <DroppedSavesNotice />
        <p className={m.press}>{t('menu.press')}</p>
        <div className={m.buttons}>
          <Button variant="primary" size="big" onClick={() => go('newGame')}>
            {t('menu.newGame')}
          </Button>
          {hasAuto && (
            <Button size="big" onClick={() => load('auto')}>
              {t('menu.continue')}
            </Button>
          )}
          <Button onClick={() => go('load')}>{t('menu.load')}</Button>
          <Button onClick={() => go('settings')}>{t('menu.settings')}</Button>
          <Button onClick={() => go('about')}>{t('menu.about')}</Button>
          {canInstall && (
            <Button variant="ghost" icon="disk" onClick={() => void promptInstall()}>
              {t('pwa.install')}
            </Button>
          )}
        </div>
        <p className={m.notice} role="note">{t('menu.devNotice')}</p>
        {showIosHint && <p className={m.footer}>{t('pwa.iosHint')}</p>}
        <p className={m.footer}>{t('menu.disclaimer')}</p>
      </div>
    </div>
  )
}

const NAME_SUGGESTIONS = ['Konsulent & Konsulent AS', 'Synergi Solutions', 'Fakturerbar AS', 'Nordlys Digital', 'Kaffe & Kode', 'Timeliste Group']

export function NewGame() {
  const { t } = useTranslation()
  const go = useGame((x) => x.go)
  const newGame = useGame((x) => x.newGame)
  const [name, setName] = useState('')
  const [founders, setFounders] = useState<Discipline[]>(['backend', 'frontend'])
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [seed, setSeed] = useState('')

  const toggleFounder = (d: Discipline) =>
    setFounders((f) => (f.includes(d) ? f.filter((x) => x !== d) : f.length >= 2 ? [f[1], d] : [...f, d]))

  const start = () => {
    const parsed = Number.parseInt(seed, 10)
    newGame({
      seed: Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31),
      firmName: name.trim() || t('newGame.defaultName'),
      founderDisciplines: [founders[0] ?? 'backend', founders[1] ?? founders[0] ?? 'frontend'],
      difficulty,
    })
  }

  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('newGame.title')} icon="briefcase">
          <div className={s.stack}>
            <div className={s.field}>
              <label htmlFor="firm-name">{t('newGame.name')}</label>
              <input
                id="firm-name"
                className={s.input}
                value={name}
                maxLength={40}
                placeholder={t('newGame.defaultName')}
                onChange={(e) => setName(e.target.value)}
              />
              <div className={m.suggestions}>
                {NAME_SUGGESTIONS.map((n) => (
                  <button key={n} type="button" className={m.suggestion} onClick={() => setName(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>{t('newGame.founders')}</span>
              <div className={s.segmented} role="group" aria-label={t('newGame.founders')}>
                {DISCIPLINES.map((d) => (
                  <button key={d} aria-pressed={founders.includes(d)} onClick={() => toggleFounder(d)}>
                    {t(`disciplines.${d}`)}
                  </button>
                ))}
              </div>
              <Hint>{t('newGame.foundersHint')}</Hint>
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>{t('newGame.difficulty')}</span>
              <div className={s.segmented} role="group" aria-label={t('newGame.difficulty')}>
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                  <button key={d} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                    {t(`newGame.difficulties.${d}`)}
                  </button>
                ))}
              </div>
              <Hint>{t(`newGame.difficultyHints.${difficulty}`)}</Hint>
            </div>
            <div className={s.field}>
              <label htmlFor="seed">{t('newGame.seed')}</label>
              <input id="seed" className={s.input} inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder={t('newGame.seedPlaceholder')} />
            </div>
            <div className={s.row} style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => go('menu')}>{t('common.back')}</Button>
              <Button variant="primary" onClick={start} disabled={founders.length === 0}>
                {t('newGame.start')}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export function LoadScreen() {
  const { t, i18n } = useTranslation()
  const go = useGame((x) => x.go)
  const load = useGame((x) => x.load)
  const [version, setVersion] = useState(0)
  const [failed, setFailed] = useState(false)
  const slots = (() => {
    try {
      void version
      return listSlots(localStorage)
    } catch {
      return []
    }
  })()
  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('load.title')} icon="disk">
          <div className={s.stack}>
            <DroppedSavesNotice />
            {slots.length === 0 && <p className={s.empty}>{t('load.none')}</p>}
            {slots.map((meta) => (
              <div key={meta.slot} className={`${s.card} ${s.row} ${s.between}`}>
                <span>
                  <strong>{meta.slot === 'auto' ? t('load.auto') : t('save.slot', { slot: meta.slot })}</strong>
                  <br />
                  <span className={`${s.small} ${s.muted}`}>
                    {meta.firmName} · {formatQuarter(meta.quarter)} · {formatMoney(meta.cash, i18n.language)} ·{' '}
                    {new Date(meta.savedAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'nb-NO')}
                  </span>
                </span>
                <span className={s.row}>
                  <Button variant="primary" size="small" onClick={() => {
                      const ok = load(meta.slot as SlotId)
                      setFailed(!ok && useGame.getState().droppedSaves.length === 0)
                      setVersion((v) => v + 1)
                    }}>
                    {t('load.load')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => {
                      if (window.confirm(t('load.confirmDelete'))) {
                        deleteSlot(localStorage, meta.slot as SlotId)
                        setVersion((v) => v + 1)
                      }
                    }}
                  >
                    {t('load.delete')}
                  </Button>
                </span>
              </div>
            ))}
            {failed && <p className={s.bad}>{t('load.failed')}</p>}
            <Button onClick={() => go('menu')}>{t('common.back')}</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const settings = useGame((x) => x.settings)
  const setSettings = useGame((x) => x.setSettings)
  const go = useGame((x) => x.go)
  const previous = useGame((x) => x.previousScreen)
  const game = useGame((x) => x.game)
  const check = (key: 'reducedMotion' | 'doubleTime' | 'announcements' | 'sound', label: string) => (
    <label className={s.checkRow}>
      <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings({ [key]: e.target.checked })} />
      {label}
    </label>
  )
  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('settings.title')} icon="gear">
          <div className={s.stack}>
            <div className={s.field}>
              <span className={s.fieldLabel}>{t('settings.language')}</span>
              <div className={s.segmented} role="group" aria-label={t('settings.language')}>
                {LOCALES.map((l) => (
                  <button key={l} aria-pressed={i18n.language === l} onClick={() => setLocale(l)}>
                    {t(`settings.languages.${l}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.field}>
              <span className={s.fieldLabel}>{t('settings.theme')}</span>
              <div className={s.segmented} role="group" aria-label={t('settings.theme')}>
                {(['dark', 'light'] as const).map((th) => (
                  <button key={th} aria-pressed={settings.theme === th} onClick={() => setSettings({ theme: th })}>
                    {t(`settings.themes.${th}`)}
                  </button>
                ))}
              </div>
            </div>
            {check('reducedMotion', t('settings.reducedMotion'))}
            {check('doubleTime', t('settings.doubleTime'))}
            {check('announcements', t('settings.announcements'))}
            {check('sound', t('settings.sound'))}
            {settings.sound && (
              <div className={s.row}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Slider
                    label={t('settings.volume')}
                    value={Math.round(settings.soundVolume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) => setSettings({ soundVolume: v / 100 })}
                    display={`${Math.round(settings.soundVolume * 100)} %`}
                  />
                </div>
                <Button size="small" onClick={() => playSound('win')}>
                  {t('settings.testSound')}
                </Button>
              </div>
            )}
            <Button onClick={() => go(game && previous === 'game' ? 'game' : 'menu')}>{t('common.back')}</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

const ABOUT_SECTIONS = ['game', 'creator', 'satire', 'making', 'privacy', 'thanks'] as const
const CONTACT_LINKS = [
  { key: 'email', href: 'mailto:selbeezy@gmail.com', label: 'selbeezy@gmail.com' },
  { key: 'linkedin', href: 'https://www.linkedin.com/in/selbekk', label: 'linkedin.com/in/selbekk' },
  { key: 'github', href: 'https://github.com/selbekk', label: 'github.com/selbekk' },
] as const

export function AboutScreen() {
  const { t } = useTranslation()
  const go = useGame((x) => x.go)
  const previous = useGame((x) => x.previousScreen)
  const game = useGame((x) => x.game)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const params = {
    quarters: MAX_QUARTERS,
    start: formatQuarter(0),
    end: formatQuarter(MAX_QUARTERS - 1),
    rivals: FIRMS.length,
  }
  const url = window.location.origin

  const share = async () => {
    const data = { title: 'Konsulent Tycoon', text: t('about.share.text'), url }
    if (navigator.share) {
      try {
        await navigator.share(data)
        return
      } catch (e) {
        // The user closed the share sheet; that's an answer, not an error.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('copied')
    } catch {
      setShareStatus('failed')
    }
  }

  return (
    <div className={m.wrap}>
      <div className={m.menu}>
        <Panel title={t('about.title')} icon="info">
          <div className={`${s.stack} ${m.about}`}>
            {ABOUT_SECTIONS.map((id) => (
              <section key={id}>
                <h3>{t(`about.${id}.title`)}</h3>
                {(t(`about.${id}.body`, { ...params, returnObjects: true }) as string[]).map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ))}
            <section>
              <h3>{t('about.contact.title')}</h3>
              <p>{t('about.contact.body')}</p>
              <ul className={m.links}>
                {CONTACT_LINKS.map((l) => (
                  <li key={l.key}>
                    <span className={s.muted}>{t(`about.contact.${l.key}`)}</span>{' '}
                    <a href={l.href} {...(l.key === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>{t('about.share.title')}</h3>
              <p>{t('about.share.body')}</p>
              <div className={s.row}>
                <Button variant="primary" onClick={() => void share()}>
                  {t('about.share.button')}
                </Button>
                <span className={`${s.small} ${s.muted}`} role="status">
                  {shareStatus === 'copied' ? t('about.share.copied') : shareStatus === 'failed' ? t('about.share.failed', { url }) : ''}
                </span>
              </div>
            </section>
            <Button onClick={() => go(game && previous === 'game' ? 'game' : 'menu')}>{t('common.back')}</Button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
