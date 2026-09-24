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
  courseBlock,
  employeeMorale,
  employeeThoughts,
  hasFeature,
  hashString,
  mentorBlock,
  potentialBand,
  promotionBlock,
  quarterlySalaryCost,
  stretchContracts,
  tenure,
} from '../../engine'
import type { Discipline, Employee, Firm, GameState } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Portrait } from '../components/Portrait'
import { Badge, Button, Hint, Meter, Modal, Panel } from '../components/ui'
import { formatMoney, formatNumber, formatQuarter } from '../format'
import s from './screens.module.css'

export function Levels({ level }: { level: number }) {
  const full = Math.round(level)
  return (
    <span aria-label={`${level.toFixed(1)} / 5`} title={level.toFixed(1)} style={{ letterSpacing: 1, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

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

export function PeoplePanel({ game, firm }: { game: GameState; firm: Firm }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Discipline | 'all'>('all')
  const [sort, setSort] = useState<Sort>('level')
  const [openId, setOpenId] = useState<string>()
  const roster = firm.roster
  const people = useMemo(() => {
    const list = (roster ?? []).filter((e) => filter === 'all' || e.discipline === filter)
    const by: Record<Sort, (a: Employee, b: Employee) => number> = {
      level: (a, b) => b.level - a.level,
      tenure: (a, b) => a.joinedQuarter - b.joinedQuarter,
      potential: (a, b) => shownPotential(b) - shownPotential(a) || b.level - a.level,
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return [...list].sort((a, b) => by[sort](a, b) || a.id.localeCompare(b.id))
  }, [roster, filter, sort])
  const open = roster?.find((e) => e.id === openId)

  return (
    <Panel title={t('staff.people')} icon="people" className={s.span12}>
      <div className={`${s.row} ${s.between}`}>
        <div className={s.row}>
          <label className={s.row}>
            <span className={s.fieldLabel}>{t('staff.discipline')}</span>
            <select className={s.input} value={filter} onChange={(e) => setFilter(e.target.value as Discipline | 'all')}>
              <option value="all">{t('staff.filterAll')}</option>
              {DISCIPLINES.filter((d) => firm.pools[d].count > 0).map((d) => (
                <option key={d} value={d}>
                  {t(`disciplines.${d}`)} ({firm.pools[d].count})
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
        <span className={`${s.small} ${s.muted}`}>{t('staff.peopleCount', { count: people.length })}</span>
      </div>
      {people.length ? (
        <ul className={s.people}>
          {people.map((e) => (
            <li key={e.id}>
              <button type="button" className={s.person} onClick={() => setOpenId(e.id)} aria-label={t('staff.openProfile', { name: e.name })}>
                <Portrait seed={e.id} size={32} />
                <span className={s.personName}>
                  <strong>{e.name}</strong>
                  <span className={`${s.small} ${s.muted}`}>
                    {t(`disciplines.${e.discipline}`)} · {t(`content:quirks.${e.quirks[0]}.name`)}
                  </span>
                </span>
                <Levels level={e.level} />
                <span className={s.seats}>{statusBadges(game, firm, e, t)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>{t('staff.peopleEmpty')}</p>
      )}
      {open && <EmployeeProfile game={game} firm={firm} e={open} onClose={() => setOpenId(undefined)} />}
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
  const severance = quarterlySalaryCost(e.level, firm.budgets.salaryPremium) * SEVERANCE_QUARTERS
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
                    <option key={c.id} value={c.id}>
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
