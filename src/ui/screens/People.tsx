import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CAREER_PROMISE_GROWTH,
  CAREER_PROMISE_QUARTERS,
  COURSE_COST,
  COURSE_MAX_LEVEL,
  COURSE_QUARTERS,
  DISCIPLINES,
  FEATURE_LEVEL,
  POTENTIAL_REVEAL_TENURE,
  PROMOTE_COST,
  PROMOTE_MIN_LEVEL,
  SEVERANCE_QUARTERS,
  careerTalkBlock,
  disciplineSupply,
  courseBlock,
  employeeMorale,
  employeeThoughts,
  hasFeature,
  hashString,
  mentorBlock,
  potentialBand,
  promotionBlock,
  pricingPremium,
  quarterlySalaryCost,
  stretchBlock,
  stretchContracts,
  tenure,
} from '../../engine'
import type { Discipline, Employee, Firm, GameState, Star } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Levels } from '../components/Levels'
import { Portrait } from '../components/Portrait'
import { Badge, Button, Hint, Meter, Modal, Panel } from '../components/ui'
import { formatMoney, formatNumber, formatQuarter } from '../format'
import s from './screens.module.css'
import { StarCard } from './StarCard'

type Sort = 'level' | 'tenure' | 'potential' | 'name'
const SORTS: Sort[] = ['level', 'tenure', 'potential', 'name']

/** Revealed potential, or -1 when unknown, for sorting. */
const shownPotential = (e: Employee) => (e.potentialRevealed ? e.potential : -1)

function PotentialBadge({ e }: { e: Employee }) {
  const { t } = useTranslation()
  if (!e.potentialRevealed) return <Badge>{t('staff.potentials.unknown')}</Badge>
  const band = potentialBand(e.potential)
  return <Badge tone={band === 'high' ? 'good' : band === 'medium' ? 'info' : undefined}>{t(`staff.potentials.${band}`)}</Badge>
}

function statusBadges(game: GameState, firm: Firm, e: Employee, t: (k: string) => string) {
  const out: { key: string; tone?: 'good' | 'warn' | 'info' | 'accent' }[] = []
  const block = promotionBlock(game, firm, e)
  if (!block || block === 'errors.notEnoughCash' || block === 'errors.promotedRecently') out.push({ key: 'promotable', tone: 'accent' })
  if (e.course) out.push({ key: 'course', tone: 'info' })
  if (e.mentorStarId) out.push({ key: 'mentor', tone: 'info' })
  if (e.stretchContractId) out.push({ key: 'stretch', tone: 'warn' })
  if (e.promise) out.push({ key: 'promise', tone: 'good' })
  return out.map((b) => (
    <Badge key={b.key} tone={b.tone}>
      {t(`staff.status.${b.key}`)}
    </Badge>
  ))
}

/** One row in the list: an ordinary employee or a star. */
type Row = { kind: 'employee'; e: Employee } | { kind: 'star'; star: Star }
const rowOf = (r: Row) => (r.kind === 'employee' ? r.e : r.star)
/** Stars sort as top potential; stars without a join date (early saves) as the longest-serving. */
const rowPotential = (r: Row) => (r.kind === 'star' ? 2 : shownPotential(r.e))
const rowJoined = (r: Row) => (r.kind === 'star' ? (r.star.joinedQuarter ?? -1) : r.e.joinedQuarter)

function starBadges(firm: Firm, star: Star, t: (k: string, o?: Record<string, string>) => string) {
  const mentee = firm.roster?.find((e) => e.mentorStarId === star.id)
  return (
    <>
      <Badge tone="warn">{t('staff.starBadge')}</Badge>
      {star.founder && <Badge tone="accent">{t('staff.founder')}</Badge>}
      {star.homegrown && <Badge tone="good">{t('staff.homegrown')}</Badge>}
      {mentee && <Badge tone="info">{t('staff.mentoring', { name: mentee.name.split(' ')[0] })}</Badge>}
    </>
  )
}

export function PeoplePanel({ game, firm }: { game: GameState; firm: Firm }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Discipline | 'all'>('all')
  const [sort, setSort] = useState<Sort>('level')
  const [openId, setOpenId] = useState<string>()
  const { roster, stars } = firm
  const rows = useMemo(() => {
    const all: Row[] = [
      ...stars.map((star): Row => ({ kind: 'star', star })),
      ...(roster ?? []).map((e): Row => ({ kind: 'employee', e })),
    ]
    const list = all.filter((r) => filter === 'all' || rowOf(r).discipline === filter)
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      level: (a, b) => rowOf(b).level - rowOf(a).level,
      tenure: (a, b) => rowJoined(a) - rowJoined(b),
      potential: (a, b) => rowPotential(b) - rowPotential(a) || rowOf(b).level - rowOf(a).level,
      name: (a, b) => rowOf(a).name.localeCompare(rowOf(b).name),
    }
    return [...list].sort((a, b) => by[sort](a, b) || rowOf(a).id.localeCompare(rowOf(b).id))
  }, [roster, stars, filter, sort])
  const openEmployee = roster?.find((e) => e.id === openId)
  const openStar = stars.find((x) => x.id === openId)
  const close = () => setOpenId(undefined)

  return (
    <Panel title={t('staff.people')} icon="people" className={s.span12}>
      <div className={`${s.row} ${s.between}`}>
        <div className={s.row}>
          <label className={s.row}>
            <span className={s.fieldLabel}>{t('staff.discipline')}</span>
            <select className={s.input} value={filter} onChange={(e) => setFilter(e.target.value as Discipline | 'all')}>
              <option value="all">{t('staff.filterAll')}</option>
              {DISCIPLINES.filter((d) => disciplineSupply(firm, d) > 0).map((d) => (
                <option key={d} value={d}>
                  {t(`disciplines.${d}`)} ({disciplineSupply(firm, d)})
                </option>
              ))}
            </select>
          </label>
          <label className={s.row}>
            <span className={s.fieldLabel}>{t('staff.sort')}</span>
            <select className={s.input} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((x) => (
                <option key={x} value={x}>
                  {t(`staff.sorts.${x}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span className={`${s.small} ${s.muted}`}>{t('staff.peopleCount', { count: rows.length })}</span>
      </div>
      {rows.length ? (
        <ul className={s.people}>
          {rows.map((r) => {
            const p = rowOf(r)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={s.person}
                  data-star={r.kind === 'star' || undefined}
                  onClick={() => setOpenId(p.id)}
                  aria-label={t('staff.openProfile', { name: p.name })}
                >
                  <Portrait seed={p.id} size={32} />
                  <span className={s.personName}>
                    <strong>{p.name}</strong>
                    <span className={`${s.small} ${s.muted}`}>
                      {t(`disciplines.${p.discipline}`)} ·{' '}
                      {r.kind === 'star' ? t(`content:traits.${r.star.traits[0]}.name`) : t(`content:quirks.${r.e.quirks[0]}.name`)}
                    </span>
                  </span>
                  <Levels level={p.level} />
                  <span className={s.seats}>{r.kind === 'star' ? starBadges(firm, r.star, t) : statusBadges(game, firm, r.e, t)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={s.empty}>{t('staff.peopleEmpty')}</p>
      )}
      {openEmployee && <EmployeeProfile game={game} firm={firm} e={openEmployee} onClose={close} />}
      {openStar && (
        <Modal title={openStar.name} icon="star" onClose={close} actions={<Button onClick={close}>{t('common.close')}</Button>}>
          <div className={s.stack}>
            {openStar.joinedQuarter !== undefined && (
              <span className={`${s.small} ${s.muted}`}>{t('staff.profile.joined', { quarter: formatQuarter(openStar.joinedQuarter) })}</span>
            )}
            <StarCard star={openStar} firm={firm} game={game} />
          </div>
        </Modal>
      )}
    </Panel>
  )
}

function EmployeeProfile({ game, firm, e, onClose }: { game: GameState; firm: Firm; e: Employee; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const dispatch = useGame((x) => x.dispatch)
  const first = e.name.split(' ')[0]
  const q = tenure(game, e)
  const thoughts = employeeThoughts(game, firm.id)
  const thought = thoughts.length ? thoughts[hashString(`${e.id}:${game.quarter}`) % thoughts.length] : undefined
  const canDevelop = hasFeature(firm, 'development')
  const mentors = firm.stars.filter((x) => x.discipline === e.discipline)
  const contracts = stretchContracts(game, firm, e)
  const severance = quarterlySalaryCost(e.level, pricingPremium(firm)) * SEVERANCE_QUARTERS
  const act = (blocked: string | undefined) => ({ disabled: !!blocked, title: blocked ? t(`game:${blocked}`) : undefined })

  return (
    <Modal
      title={e.name}
      icon="people"
      onClose={onClose}
      actions={
        <>
          <Button
            variant="danger"
            onClick={() => {
              if (!dispatch({ type: 'fire', firmId: firm.id, discipline: e.discipline, count: 1, employeeId: e.id })) onClose()
            }}
          >
            {t('staff.profile.fire', { cost: formatMoney(severance, lng) })}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      <div className={s.stack}>
        <div className={s.row}>
          <Portrait seed={e.id} size={72} />
          <div className={s.stackSm}>
            <div className={s.row}>
              <Badge>{t(`disciplines.${e.discipline}`)}</Badge>
              <Levels level={e.level} />
              <span className="num">{formatNumber(e.level, lng, 1)}</span>
            </div>
            <div className={s.row}>
              <span className={s.small}>{t('staff.potential')}:</span>
              <PotentialBadge e={e} />
            </div>
            <span className={`${s.small} ${s.muted}`}>{t('staff.profile.joined', { quarter: formatQuarter(e.joinedQuarter) })}</span>
          </div>
        </div>
        <p style={{ margin: 0 }}>
          {q > 0
            ? t('staff.profile.bio', { first, discipline: t(`disciplines.${e.discipline}`).toLowerCase(), tenure: t('staff.profile.tenure', { count: q }) })
            : t('staff.profile.bioNew', { first })}
        </p>
        <div className={s.stackSm}>
          <strong>{t('staff.profile.quirks')}</strong>
          {e.quirks.map((id) => (
            <span key={id} className={s.small}>
              <Badge tone="info">{t(`content:quirks.${id}.name`)}</Badge> {t(`content:quirks.${id}.desc`)}
            </span>
          ))}
        </div>
        <Meter label={t('staff.morale')} value={employeeMorale(firm, e)} />
        {thought && (
          <div className={s.stackSm}>
            <strong>{t('staff.profile.thinks')}</strong>
            <p className={s.thought} data-mood={thought.mood} style={{ margin: 0 }}>
              {t(`game:${thought.key}`, thought.params)}
            </p>
          </div>
        )}
        {!e.potentialRevealed && <Hint>{t('staff.profile.potentialHint', { quarters: POTENTIAL_REVEAL_TENURE })}</Hint>}

        <div className={s.stackSm}>
          <strong>{t('staff.profile.develop')}</strong>
          {!canDevelop ? (
            <p className={`${s.small} ${s.muted}`}>{t('staff.profile.developLocked', { level: FEATURE_LEVEL.development })}</p>
          ) : (
            <>
              {e.course ? (
                <span className={s.small}>{t('staff.profile.courseActive', { quarter: formatQuarter(e.course.untilQuarter - 1) })}</span>
              ) : (
                <>
                  <Button
                    size="small"
                    {...act(courseBlock(firm, e))}
                    onClick={() => dispatch({ type: 'trainEmployee', firmId: firm.id, discipline: e.discipline, employeeId: e.id })}
                  >
                    {t('staff.profile.course', { cost: formatMoney(COURSE_COST, lng) })}
                  </Button>
                  <Hint>{t('staff.profile.courseHint', { quarters: COURSE_QUARTERS, max: COURSE_MAX_LEVEL })}</Hint>
                </>
              )}

              <div className={s.field}>
                <label htmlFor={`mentor-${e.id}`}>{t('staff.profile.mentor')}</label>
                <select
                  id={`mentor-${e.id}`}
                  className={s.input}
                  value={e.mentorStarId ?? ''}
                  onChange={(ev) => dispatch({ type: 'setMentor', firmId: firm.id, employeeId: e.id, starId: ev.target.value || undefined })}
                >
                  <option value="">{t('staff.profile.mentorNone')}</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id !== e.mentorStarId && !!mentorBlock(firm, e, m)}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <Hint>{t('staff.profile.mentorHint')}</Hint>
              </div>

              <div className={s.field}>
                <label htmlFor={`stretch-${e.id}`}>{t('staff.profile.stretch')}</label>
                <select
                  id={`stretch-${e.id}`}
                  className={s.input}
                  value={e.stretchContractId ?? ''}
                  onChange={(ev) => dispatch({ type: 'setStretch', firmId: firm.id, employeeId: e.id, contractId: ev.target.value || undefined })}
                >
                  <option value="">{t('staff.profile.stretchNone')}</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.id !== e.stretchContractId && !!stretchBlock(game, firm, e, c.id)}>
                      {t(`content:customers.${c.customerId}.name`)}
                    </option>
                  ))}
                </select>
                <Hint>{t('staff.profile.stretchHint')}</Hint>
              </div>

              {e.promise ? (
                <span className={s.small}>
                  {t('staff.profile.promise', {
                    quarter: formatQuarter(e.promise.dueQuarter - 1),
                    done: formatNumber(Math.max(0, e.level - e.promise.levelAtTalk), lng, 1),
                    goal: formatNumber(CAREER_PROMISE_GROWTH, lng, 1),
                  })}
                </span>
              ) : (
                <>
                  <Button size="small" {...act(careerTalkBlock(firm, e))} onClick={() => dispatch({ type: 'careerTalk', firmId: firm.id, employeeId: e.id })}>
                    {t('staff.profile.careerTalk')}
                  </Button>
                  <Hint>
                    {t('staff.profile.careerHint', { growth: formatNumber(CAREER_PROMISE_GROWTH, lng, 1), quarters: CAREER_PROMISE_QUARTERS })}
                  </Hint>
                </>
              )}
            </>
          )}
          {hasFeature(firm, 'stars') && (
            <>
              <Button
                variant="primary"
                size="small"
                {...act(promotionBlock(game, firm, e))}
                onClick={() => {
                  if (!dispatch({ type: 'promoteEmployee', firmId: firm.id, employeeId: e.id })) onClose()
                }}
              >
                {t('staff.profile.promote', { cost: formatMoney(PROMOTE_COST, lng) })}
              </Button>
              <Hint>{t('staff.profile.promoteHint', { level: formatNumber(PROMOTE_MIN_LEVEL, lng, 1) })}</Hint>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
