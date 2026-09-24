import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DISCIPLINES, benchPeople, benchSummary } from '../../engine'
import type { BenchPerson, GameState } from '../../engine'
import { Levels } from '../components/Levels'
import { Badge } from '../components/ui'
import { formatNumber } from '../format'
import s from './screens.module.css'

type View = 'summary' | 'table'
type SortKey = 'name' | 'discipline' | 'experience' | 'level' | 'now' | 'next'
type Row = BenchPerson & { now: boolean; next: boolean }

const COLUMNS: { key: SortKey; num?: boolean }[] = [
  { key: 'name' },
  { key: 'discipline' },
  { key: 'experience', num: true },
  { key: 'level' },
  { key: 'now' },
  { key: 'next' },
]

/** Who is free for new work, now and next quarter: per discipline, or as a sortable list of people. */
export function BenchView({ game }: { game: GameState }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [view, setView] = useState<View>('summary')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'level', dir: -1 })
  const summary = benchSummary(game, game.playerId)

  const rows = useMemo(() => {
    const now = benchPeople(game, game.playerId)
    const next = benchPeople(game, game.playerId, game.quarter + 1)
    const byId = new Map<string, Row>()
    for (const p of now) byId.set(p.id, { ...p, now: true, next: false })
    for (const p of next) byId.set(p.id, { ...(byId.get(p.id) ?? { ...p, now: false }), next: true })
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case 'name':
          return r.name
        case 'discipline':
          return DISCIPLINES.indexOf(r.discipline)
        case 'now':
        case 'next':
          return Number(r[sort.key])
        default:
          return r[sort.key]
      }
    }
    return [...byId.values()].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      const diff = typeof va === 'string' ? va.localeCompare(vb as string, lng) : va - (vb as number)
      return diff * sort.dir || a.name.localeCompare(b.name, lng)
    })
  }, [game, sort, lng])

  const toggle = (key: SortKey) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'discipline' ? 1 : -1 }))

  return (
    <div className={s.stackSm}>
      <div className={`${s.row} ${s.between}`}>
        <span className={`${s.small} ${s.muted}`}>{t('bench.intro')}</span>
        <div className={s.segmented} role="group" aria-label={t('bench.view')}>
          {(['summary', 'table'] as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {t(`bench.views.${v}`)}
            </button>
          ))}
        </div>
      </div>
      {view === 'summary' ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{t('staff.discipline')}</th>
                <th className={s.num}>{t('bench.now')}</th>
                <th className={s.num}>{t('bench.next')}</th>
                <th className={s.num}>{t('bench.inBids')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.discipline}>
                  <td>{t(`disciplines.${r.discipline}`)}</td>
                  <td className={`${s.num} num`}>{r.now}</td>
                  <td className={`${s.num} num`}>{r.next}</td>
                  <td className={`${s.num} num`}>
                    {r.inBids > r.next ? <Badge tone="warn">{r.inBids}</Badge> : r.inBids || '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.some((r) => r.inBids > r.next) && <p className={`${s.small} ${s.warn}`}>{t('bench.overbooked')}</p>}
        </div>
      ) : rows.length === 0 ? (
        <p className={s.empty}>{t('bench.none')}</p>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.num ? s.num : undefined}
                    aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button" className={s.sortButton} onClick={() => toggle(c.key)}>
                      {t(`bench.cols.${c.key}`)}
                      <span aria-hidden>{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name} {r.star && <Badge tone="warn">{t('staff.starBadge')}</Badge>}
                  </td>
                  <td>{t(`disciplines.${r.discipline}`)}</td>
                  <td className={`${s.num} num`}>{formatNumber(r.experience, lng, 1)}</td>
                  <td>
                    <Levels level={r.level} />
                  </td>
                  <td>{r.now ? <Badge tone="good">{t('bench.free')}</Badge> : <span className={s.muted}>–</span>}</td>
                  <td>{r.next ? <Badge tone="good">{t('bench.free')}</Badge> : <span className={s.muted}>–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
