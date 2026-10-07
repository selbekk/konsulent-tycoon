import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COFOUNDERS } from '../../content/cofounders'
import {
  STARTUP_DRINKS_COST,
  cofounderStarId,
  STARTUP_LEADS,
  activeContracts,
  applyAction,
  leadSeats,
  offerChance,
  quarterFinancials,
  quarterTodos,
  recruitBlock,
  seatTotal,
  startupHours,
} from '../../engine'
import type { Candidate, GameState, Lead, NewsItem, RecruitMove, Seats } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Icon } from '../components/Icon'
import { Portrait } from '../components/Portrait'
import { Badge, Button, Meter, Panel, Stat } from '../components/ui'
import { formatMoney, formatNumber, formatPercent, formatQuarter, newsText } from '../format'
import { OfficeView } from '../office/OfficeView'
import { LevelPanel } from './LevelPanel'
import { NewsArticle } from './NewsArticle'
import { TodoList } from './TodoList'
import s from './screens.module.css'
import u from './startup.module.css'

const MOVES: RecruitMove[] = ['coffee', 'drinks', 'linkedin', 'offer']

/** "2 backend, 1 design" */
function seatText(seats: Seats, t: (k: string) => string) {
  return Object.entries(seats)
    .filter(([, n]) => n)
    .map(([d, n]) => `${n} ${t(`disciplines.${d}`).toLowerCase()}`)
    .join(', ')
}

/** What a lead would add to this quarter's result: the game with the lead taken, minus the game without. Pure. */
function leadResult(game: GameState, lead: Lead): number {
  const taken = applyAction(game, { type: 'takeLead', firmId: game.playerId, leadId: lead.id })
  if (taken.error) return 0
  return quarterFinancials(taken.state, game.playerId).ebitda - quarterFinancials(game, game.playerId).ebitda
}

/**
 * The startup phase: two founders at a corner of a co-working space. Replaces the dashboard and the tabs until
 * the firm reaches level 2. Leads instead of tenders, the network instead of hiring orders.
 */
export function StartupScreen() {
  const game = useGame((x) => x.game)!
  const me = game.firms[game.playerId]
  const st = me.startup!
  if (st.cofounder === undefined) return <CofounderPicker />
  return <CoworkingSpace />
}

function CoworkingSpace() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const [article, setArticle] = useState<NewsItem | null>(null)
  const me = game.firms[game.playerId]
  const st = me.startup!
  const fin = quarterFinancials(game, me.id)
  const todos = quarterTodos(game, me.id)
  const contracts = activeContracts(game, me.id)
  const personal = game.news
    .filter((n) => n.personal)
    .slice(-6)
    .reverse()

  return (
    <div className={s.grid}>
      <Panel title={t('startup.leads.title')} icon="briefcase" className={s.span7} id="startup-lead">
        <p className={`${s.small} ${s.muted}`} style={{ marginTop: 0 }}>
          {t('startup.leads.intro')}
        </p>
        <div className={s.cards}>
          {st.leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </Panel>

      <div className={`${s.span5} ${s.stack}`}>
        <Panel title={t('todo.title')} icon="calendar">
          <TodoList todos={todos} />
          {todos.every((x) => x.done) && <p className={`${s.small} ${s.muted}`}>{t('todo.allDone')}</p>}
        </Panel>
        <LevelPanel firm={me} />
      </div>

      <Panel
        title={t('startup.network.title')}
        icon="coffee"
        className={s.span12}
        id="startup-network"
        actions={<Hours left={st.hours} total={startupHours(st.cofounder)} />}
      >
        <p className={`${s.small} ${s.muted}`} style={{ marginTop: 0 }}>
          {t('startup.network.intro')}
        </p>
        {st.candidates.length ? (
          <ul className={u.candidates}>
            {st.candidates.map((c) => (
              <CandidateCard key={c.person.id} c={c} />
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t('startup.network.empty')}</p>
        )}
      </Panel>

      <Panel title={t('startup.team.title')} icon="people" className={s.span7}>
        <ul className={u.team}>
          {me.stars.map((p) => (
            <li key={p.id}>
              <Portrait seed={p.id} size={32} />
              <span className={u.who}>
                <strong>{p.name}</strong>
                <span className={`${s.small} ${s.muted}`}>
                  {t(`disciplines.${p.discipline}`)} · {t('startup.level', { level: formatNumber(p.level, lng, 1) })}
                </span>
              </span>
              <Badge tone="accent">{p.ceo ? t('startup.team.you') : t('startup.team.cofounder')}</Badge>
            </li>
          ))}
          {(me.roster ?? []).map((e) => (
            <li key={e.id}>
              <Portrait seed={e.id} size={32} />
              <span className={u.who}>
                <strong>{e.name}</strong>
                <span className={`${s.small} ${s.muted}`}>
                  {t(`disciplines.${e.discipline}`)} · {t('startup.level', { level: formatNumber(e.level, lng, 1) })}
                </span>
              </span>
              <Badge>{t('startup.team.since', { quarter: formatQuarter(e.joinedQuarter) })}</Badge>
            </li>
          ))}
        </ul>
        <h3 className={u.subhead}>{t('startup.team.work')}</h3>
        {contracts.length ? (
          <ul className={s.newsList}>
            {contracts.map((c) => (
              <li key={c.id}>
                <span className={s.newsDot} data-tone="good" />
                <span>
                  <strong>{t(`content:customers.${c.customerId}.name`)}</strong>{' '}
                  {t('startup.team.contract', {
                    seats: seatText(c.activeSeats, t),
                    end: formatQuarter(c.endQuarter - 1),
                  })}
                  {c.ramp && (
                    <>
                      {' '}
                      {t('startup.team.ramp', {
                        count: seatTotal(c.ramp.seats),
                        quarter: formatQuarter(c.ramp.quarter),
                      })}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.empty}>{t('startup.team.noWork')}</p>
        )}
      </Panel>

      <div className={`${s.span5} ${s.stack}`}>
        <Panel title={t('dashboard.thisQuarter', { quarter: formatQuarter(game.quarter) })} icon="coin">
          <div className={s.kpis}>
            <Stat label={t('startup.revenue')} value={formatMoney(fin.revenue, lng)} />
            <Stat
              label={t('dashboard.expectedResult')}
              value={formatMoney(fin.ebitda, lng)}
              tone={fin.ebitda >= 0 ? 'good' : 'bad'}
            />
          </div>
          {fin.freelanceCost > 0 && <p className={`${s.small} ${s.muted}`}>{t('startup.freelancers')}</p>}
        </Panel>
        <Panel title={t('dashboard.news')} icon="news">
          {personal.length ? (
            <ul className={s.newsList}>
              {personal.map((n) => (
                <li key={n.id}>
                  <span className={s.newsDot} data-tone={n.tone} />
                  <button type="button" className={s.newsLink} onClick={() => setArticle(n)}>
                    <span className={s.muted}>{formatQuarter(n.quarter)}</span> {newsText(n, t, lng)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{t('dashboard.noNews')}</p>
          )}
          {article && <NewsArticle item={article} onClose={() => setArticle(null)} />}
        </Panel>
      </div>

      <Panel title={t('dashboard.office')} icon="people" className={s.span12}>
        <OfficeView game={game} firm={me} />
      </Panel>
    </div>
  )
}

function Hours({ left, total }: { left: number; total: number }) {
  const { t } = useTranslation()
  return (
    <span className={u.hours} role="img" aria-label={t('startup.network.hoursSr', { left, total })}>
      <span aria-hidden>{t('startup.network.hours')}</span>
      {Array.from({ length: Math.max(total, left) }, (_, i) => (
        <span key={i} className={u.hour} data-on={i < left || undefined} aria-hidden />
      ))}
    </span>
  )
}

function LeadCard({ lead }: { lead: Lead }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const st = me.startup!
  const seats = leadSeats(game, me, lead)
  const result = useMemo(() => leadResult(game, lead), [game, lead])
  const taken = st.takenLead === lead.id
  const spec = STARTUP_LEADS[lead.kind]
  return (
    <article
      className={s.card}
      data-highlight={taken || undefined}
      aria-label={t(`content:customers.${lead.customerId}.name`)}
    >
      <div className={s.between}>
        <h3>{t(`content:customers.${lead.customerId}.name`)}</h3>
        <Badge tone={lead.kind === 'steady' ? 'info' : lead.kind === 'growth' ? 'good' : 'accent'}>
          {t(`startup.leads.kinds.${lead.kind}.name`)}
        </Badge>
      </div>
      <p className={s.small} style={{ margin: 0 }}>
        {t(`startup.leads.kinds.${lead.kind}.blurb`)}
      </p>
      <ul className={u.facts}>
        <li>{t('startup.leads.seats', { seats: seatText(seats, t), count: seatTotal(seats) })}</li>
        <li>{t('startup.leads.duration', { count: lead.duration })}</li>
        <li>{t('startup.leads.rate', { rate: formatPercent(lead.rate, lng) })}</li>
        {'rampSeats' in spec && <li>{t('startup.leads.ramp', { count: spec.rampSeats, quarters: spec.rampAfter })}</li>}
        {spec.reputation > 0 && <li>{t('startup.leads.reputation', { n: spec.reputation })}</li>}
        {!taken && !st.takenLead && (
          <li>
            {t('startup.leads.result')}{' '}
            <strong className={result >= 0 ? s.good : s.bad}>
              {result >= 0 ? '+' : ''}
              {formatMoney(result, lng)}
            </strong>
          </li>
        )}
      </ul>
      {taken ? (
        <span className={s.good}>
          <Icon name="check" size={12} /> {t('startup.leads.taken')}
        </span>
      ) : (
        <Button
          variant="primary"
          size="small"
          disabled={!!st.takenLead}
          onClick={() => dispatch({ type: 'takeLead', firmId: me.id, leadId: lead.id })}
        >
          {st.takenLead ? t('startup.leads.oneOnly') : t('startup.leads.take')}
        </Button>
      )}
    </article>
  )
}

function CandidateCard({ c }: { c: Candidate }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const p = c.person
  const label = (move: RecruitMove) =>
    move === 'offer'
      ? t('startup.network.moves.offer', { chance: formatPercent(offerChance(c), lng) })
      : move === 'drinks'
        ? t('startup.network.moves.drinks', { cost: formatMoney(STARTUP_DRINKS_COST, lng) })
        : t(`startup.network.moves.${move}`)
  return (
    <li className={u.candidate}>
      <div className={u.candidateHead}>
        <Portrait seed={p.id} size={36} />
        <span className={u.who}>
          <strong>{p.name}</strong>
          <span className={`${s.small} ${s.muted}`}>
            {t(`disciplines.${p.discipline}`)} · {t('startup.level', { level: formatNumber(p.level, lng, 1) })}
            {p.quirks[0] && <> · {t(`content:quirks.${p.quirks[0]}.name`)}</>}
          </span>
        </span>
      </div>
      <Meter label={t('startup.network.interest')} value={c.interest} display={`${Math.round(c.interest)} %`} />
      <span className={`${s.small} ${c.likesKnown ? '' : s.muted}`}>
        {c.likesKnown
          ? t('startup.network.likes', { move: t(`startup.network.likesWhat.${c.likes}`) })
          : t('startup.network.likesUnknown')}
      </span>
      <div className={u.moves}>
        {MOVES.map((move) => {
          const blocked = recruitBlock(me, c, move, game.quarter)
          const tried = move !== 'offer' && c.tried.includes(move)
          return (
            <Button
              key={move}
              size="small"
              variant={move === 'offer' ? 'primary' : 'default'}
              disabled={!!blocked}
              title={blocked ? t(`game:${blocked}`) : undefined}
              aria-pressed={move === 'offer' ? undefined : tried}
              onClick={() => dispatch({ type: 'recruit', firmId: me.id, candidateId: p.id, move })}
            >
              {tried && <Icon name="check" size={12} />}
              {label(move)}
            </Button>
          )
        })}
      </div>
      <span className={`${s.small} ${s.muted}`}>
        {t('startup.network.until', { quarter: formatQuarter(c.untilQuarter - 1) })}
      </span>
    </li>
  )
}

/**
 * The first thing in a new game: who the player starts the firm with. Everything else in the co-working space
 * (hours, leads, the network) waits for this.
 */
function CofounderPicker() {
  const { t } = useTranslation()
  const game = useGame((x) => x.game)!
  const dispatch = useGame((x) => x.dispatch)
  const me = game.firms[game.playerId]
  const ceo = me.stars.find((x) => x.ceo)
  const [picked, setPicked] = useState<string | null>(null)
  const chosen = COFOUNDERS.find((c) => c.id === picked)
  return (
    <div className={s.grid}>
      <Panel title={t('startup.cofounder.title')} icon="handshake" className={s.span12}>
        <p style={{ marginTop: 0 }}>{t('startup.cofounder.intro', { ceo: ceo?.name ?? '', firm: me.name })}</p>
        <div className={u.gallery} role="group" aria-label={t('startup.cofounder.title')}>
          {COFOUNDERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={u.cofounder}
              aria-pressed={picked === c.id}
              onClick={() => setPicked(c.id)}
            >
              <span className={s.cardTitle}>
                <Portrait seed={cofounderStarId(c.id)} size={32} />
                <span className={u.who}>
                  <span>{c.name}</span>
                  <span className={`${s.small} ${s.muted}`}>
                    {t(`disciplines.${c.discipline}`)} · {t('startup.level', { level: c.level })}
                  </span>
                </span>
              </span>
              <span className={s.small}>{t(`content:cofounders.${c.id}.blurb`)}</span>
              <span className={u.pro}>+ {t(`content:cofounders.${c.id}.pro`)}</span>
              <span className={u.con}>− {t(`content:cofounders.${c.id}.con`)}</span>
            </button>
          ))}
        </div>
        <p className={`${s.small} ${s.muted}`}>{t('startup.cofounder.hint')}</p>
        <div className={s.row} style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            disabled={!chosen}
            onClick={() => chosen && dispatch({ type: 'chooseCofounder', firmId: me.id, cofounder: chosen.id })}
          >
            {chosen ? t('startup.cofounder.confirm', { name: chosen.name }) : t('startup.cofounder.pick')}
          </Button>
        </div>
      </Panel>
    </div>
  )
}
