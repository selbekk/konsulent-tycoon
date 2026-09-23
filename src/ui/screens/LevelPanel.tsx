import { useTranslation } from 'react-i18next'
import { LEVELS, LEVEL_GOALS, MAX_LEVEL, SHADY_LEVELS, firmLevel, levelStats, unlocksAt } from '../../engine'
import type { Firm, LevelGoal } from '../../engine'
import { Meter, Panel } from '../components/ui'
import { formatMoney } from '../format'
import s from './screens.module.css'

/** What opens at `level`, as a plain list. */
export function UnlockList({ level }: { level: number }) {
  const { t } = useTranslation()
  const u = unlocksAt(level, SHADY_LEVELS)
  const previousSeats = level > 1 ? LEVELS[level - 2].maxSeats : 0
  return (
    <ul className={s.newsList}>
      {u.features.map((f) => (
        <li key={f}>
          <span className={s.newsDot} data-tone="good" />
          <span>{t(`level.features.${f}`)}</span>
        </li>
      ))}
      {u.maxSeats !== previousSeats && (
        <li>
          <span className={s.newsDot} data-tone="good" />
          <span>{Number.isFinite(u.maxSeats) ? t('level.seats', { count: u.maxSeats }) : t('level.seatsAll')}</span>
        </li>
      )}
      {u.shady.length > 0 && (
        <li>
          <span className={s.newsDot} data-tone="sassy" />
          <span>{t('level.shady', { list: u.shady.map((id) => t(`content:shady.actions.${id}.name`)).join(', ') })}</span>
        </li>
      )}
    </ul>
  )
}

export function LevelPanel({ firm, className }: { firm: Firm; className?: string }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const level = firmLevel(firm)
  const name = (l: number) => t(`level.names.${l}`)
  if (level >= MAX_LEVEL) {
    return (
      <Panel title={t('level.title')} icon="trophy" className={className}>
        <p className={s.small}>
          <strong>{t('level.label', { level })} · {name(level)}</strong>
        </p>
        <p className={`${s.small} ${s.muted}`}>{t('level.max')}</p>
      </Panel>
    )
  }
  const next = level + 1
  const goal = LEVELS[next - 1]
  const stats = levelStats(firm)
  const show = (g: LevelGoal, v: number) => (g === 'revenue' ? formatMoney(v, lng) : String(v))
  return (
    <Panel title={t('level.title')} icon="trophy" className={className}>
      <div className={s.stack}>
        <span className={s.small}>
          <strong>{t('level.label', { level })} · {name(level)}</strong>
        </span>
        <span className={s.small}>{t('level.next', { level: next, name: name(next) })}</span>
        <span className={`${s.small} ${s.muted}`}>{t('level.anyOne')}</span>
        {LEVEL_GOALS.map((g) => (
          <Meter
            key={g}
            label={t(`level.goals.${g}`)}
            value={Math.min(stats[g], goal[g])}
            max={goal[g]}
            color="var(--accent)"
            display={`${show(g, stats[g])} / ${show(g, goal[g])}`}
          />
        ))}
        <span className={`${s.small} ${s.muted}`}>{t('level.unlocks')}</span>
        <UnlockList level={next} />
      </div>
    </Panel>
  )
}
