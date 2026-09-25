import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GENDER_GROUPS, activeContracts, benchmark, capacity, hasFeature, kpis, peopleStats, playerRank, quarterFinancials, quarterTodos, trophies, valuation } from '../../engine'
import type { GenderGroup } from '../../engine'
import type { NewsItem } from '../../engine'
import { useGame } from '../../store/gameStore'
import { bjornKey } from '../bjorn'
import { Bjorn } from '../components/Bjorn'
import { Icon } from '../components/Icon'
import { CapacityChart, Delta, KpiTile, TrendLine } from '../components/metrics'
import m from '../components/metrics.module.css'
import { Button, Panel, Stat } from '../components/ui'
import { formatMoney, formatNumber, formatPercent, formatQuarter, newsText } from '../format'
import { OfficeView } from '../office/OfficeView'
import s from './screens.module.css'
import { CrisisPanel } from './CrisisPanel'
import { LevelPanel } from './LevelPanel'
import { NewsArticle } from './NewsArticle'
import { TodoList } from './TodoList'

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const setTab = useGame((x) => x.setTab)
  const [article, setArticle] = useState<NewsItem | null>(null)
  const me = game.firms[game.playerId]
  const fin = quarterFinancials(game, me.id)
  const todos = quarterTodos(game, me.id)
  const contracts = activeContracts(game, me.id)
  const ending = contracts.filter((c) => c.endQuarter === game.quarter + 1)
  const stars = hasFeature(me, 'stars') ? game.starMarket.length : 0
  const personal = game.news.filter((n) => n.personal).slice(-6).reverse()
  const k = kpis(game, me.id)
  const bench = benchmark(game, me.id)
  const cap = capacity(game, me.id)
  const pct = (v: number) => formatPercent(v, lng)
  const pp = (v: number) => `${Math.round(v * 100)} ${t('kpi.pp')}`
  const rate = (v: number) => `${formatNumber(Math.round(v), lng)} ${t('kpi.perHour')}`
  const signedPct = (v: number) => `${v > 0 ? '+' : ''}${formatPercent(v, lng)}`
  const vsLast = (now: number | undefined, last: number | undefined) => (now !== undefined && last !== undefined ? now - last : undefined)

  return (
    <div className={s.grid}>
      <CrisisPanel />
      {hasFeature(me, 'kpis') && (
        <Panel title={t('kpi.title')} icon="chart" className={s.span12}>
          <div className={m.tiles}>
            <KpiTile
              abbr="FG"
              name={t('kpi.fg')}
              value={pct(k.fg.now)}
              trend={<TrendLine points={k.fg.trend} format={pct} label={t('kpi.fg')} />}
              lines={[
                <>{t('kpi.vsLast')} <Delta diff={vsLast(k.fg.now, k.fg.last)} format={pp} /></>,
                <>{t('kpi.industry')} {bench.fg !== undefined ? pct(bench.fg) : '–'}</>,
              ]}
            />
            <KpiTile
              abbr="OT"
              name={t('kpi.ot')}
              value={k.ot.now !== undefined ? rate(k.ot.now) : '–'}
              trend={<TrendLine points={k.ot.trend} format={rate} label={t('kpi.ot')} />}
              lines={[
                <>{t('kpi.vsLast')} <Delta diff={vsLast(k.ot.now, k.ot.last)} format={(v) => rate(v)} /></>,
                <>{t('kpi.industry')} {bench.ot !== undefined ? rate(bench.ot) : '–'}</>,
              ]}
            />
            <KpiTile
              abbr={t('kpi.growthAbbr')}
              name={t('kpi.growth')}
              value={k.growth.yoy !== undefined ? signedPct(k.growth.yoy) : '–'}
              trend={<TrendLine points={k.growth.trend} format={(v) => t('kpi.people', { count: v })} label={t('kpi.headcountTrend')} />}
              lines={[
                <>{t('kpi.qoq')} {k.growth.qoq !== undefined ? signedPct(k.growth.qoq) : '–'}</>,
                <>{t('kpi.industry')} {bench.growth !== undefined ? signedPct(bench.growth) : '–'}</>,
              ]}
            />
            <KpiTile
              abbr={t('kpi.retentionAbbr')}
              name={t('kpi.retention')}
              value={k.retention.value !== undefined ? pct(k.retention.value) : '–'}
              trend={<TrendLine points={k.retention.trend} format={pct} label={t('kpi.retention')} />}
              lines={[
                <>{t('kpi.leavers', { leavers: k.retention.leavers, fired: k.retention.fired })}</>,
                <>{t('kpi.industry')} {bench.retention !== undefined ? pct(bench.retention) : '–'}</>,
              ]}
            />
          </div>
          <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>{t('kpi.explain')}</p>
        </Panel>
      )}

      {hasFeature(me, 'peopleStats') && <PeopleStatsPanel />}

      <Panel title={t('capacity.title')} icon="people" className={s.span7}>
        <CapacityChart cap={cap} />
        <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>{t('capacity.explain', { count: cap.headcount })}</p>
      </Panel>

      <div className={`${s.span5} ${s.stack}`}>
        <Bjorn text={t(bjornKey(game))} />
        <Panel title={t('todo.title')} icon="calendar">
          <TodoList todos={todos} />
          {todos.every((x) => x.done) && <p className={`${s.small} ${s.muted}`}>{t('todo.allDone')}</p>}
          {(ending.length > 0 || stars > 0) && (
            <ul className={s.newsList} style={{ marginTop: 12 }}>
              {ending.length > 0 && (
                <li>
                  <span className={s.newsDot} data-tone="bad" />
                  <span>{t('dashboard.endingSoon', { count: ending.length })}</span>
                </li>
              )}
              {stars > 0 && (
                <li>
                  <span className={s.newsDot} data-tone="sassy" />
                  <span>
                    {t('dashboard.starsAvailable', { count: stars })}{' '}
                    <Button size="small" onClick={() => setTab('staff')}>
                      {t('dashboard.goStaff')}
                    </Button>
                  </span>
                </li>
              )}
            </ul>
          )}
        </Panel>
        <LevelPanel firm={me} />
      </div>

      <Panel
        title={t('dashboard.thisQuarter', { quarter: formatQuarter(game.quarter) })}
        icon="coin"
        className={s.span7}
        actions={
          <Button size="small" onClick={() => setTab('finance')}>
            {t('dashboard.goFinance')} →
          </Button>
        }
      >
        <div className={s.kpis}>
          <Stat label={t('dashboard.expectedResult')} value={formatMoney(fin.ebitda, lng)} tone={fin.ebitda >= 0 ? 'good' : 'bad'} />
          <Stat label={t('dashboard.valuation')} value={formatMoney(valuation(me), lng)} />
          <Stat label={t('dashboard.rank')} value={`#${playerRank(game)} / ${game.firmOrder.filter((id) => !game.firms[id].bankrupt).length}`} />
        </div>
      </Panel>

      <Panel title={t('dashboard.news')} icon="news" className={s.span5}>
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
      <Panel title={t('dashboard.office')} icon="people" className={s.span12}>
        <OfficeView game={game} firm={me} />
      </Panel>
      <TrophyWall />
    </div>
  )
}

function TrophyWall() {
  const { t } = useTranslation()
  const me = useGame((x) => x.game!.firms[x.game!.playerId])
  const wall = trophies(me)
  // Counted over the milestones only: missions join the wall as they are done, which would move the total.
  const milestones = wall.filter((x) => x.kind === 'milestone')
  const done = milestones.filter((x) => x.done).length
  return (
    <Panel title={`${t('trophies.title')} · ${t('trophies.count', { done, total: milestones.length })}`} icon="trophy" className={s.span12}>
      <ul className={s.trophyWall}>
        {wall.map((x) => {
          const name = t(x.kind === 'milestone' ? `content:milestones.${x.def.id}.name` : `content:missions.${x.def.id}.name`)
          const desc = x.kind === 'milestone' ? t(`content:milestones.${x.def.id}.desc`) : t('trophies.mission')
          return (
            <li key={`${x.kind}:${x.def.id}`} data-done={x.done} title={x.done ? desc : t('trophies.locked')}>
              <span>
                <Icon name={x.kind === 'mission' ? 'flag' : 'trophy'} size={16} />
              </span>
              <span>
                {name}
                {!x.done && (
                  <>
                    <br />
                    <span className={s.small}>{desc}</span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function PeopleStatsPanel() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const st = peopleStats(game, game.playerId)
  const pct = (part: number, total: number) => (total ? formatPercent(part / total, lng) : '–')
  const years = (v: number | undefined) => (v !== undefined ? t('people.years', { value: formatNumber(v, lng, 1) }) : '–')
  return (
    <Panel title={t('people.title')} icon="people" className={s.span12}>
      <div className={m.tiles}>
        <KpiTile
          abbr={t('people.genderAbbr')}
          name={t('people.gender')}
          value={t('people.women', { pct: pct(st.gender.female, st.headcount) })}
          lines={[
            ...(Object.keys(GENDER_GROUPS) as GenderGroup[])
              .filter((g) => st.genderByGroup[g].total > 0)
              .map((g) => <>{t(`people.groups.${g}`, { pct: pct(st.genderByGroup[g].female, st.genderByGroup[g].total), count: st.genderByGroup[g].total })}</>),
            ...(st.gender.nonbinary ? [<>{t('people.nonbinary', { count: st.gender.nonbinary })}</>] : []),
          ]}
        />
        <KpiTile
          abbr={t('people.ageAbbr')}
          name={t('people.age')}
          value={years(st.age?.avg)}
          lines={st.age ? [<>{t('people.ageRange', { min: Math.floor(st.age.min), max: Math.floor(st.age.max) })}</>] : []}
        />
        <KpiTile
          abbr={t('people.experienceAbbr')}
          name={t('people.experience')}
          value={years(st.experience?.avg)}
          lines={[
            ...(st.experience ? [<>{t('people.seniority', { juniors: st.experience.juniors, seniors: st.experience.seniors })}</>] : []),
            <>{t('people.tenure', { years: years(st.tenure) })}</>,
          ]}
        />
        <KpiTile
          abbr={t('people.projectAbbr')}
          name={t('people.project')}
          value={years(st.project?.soFar)}
          lines={[<>{st.project ? t('people.projectLength', { years: years(st.project.length) }) : t('people.noProjects')}</>]}
        />
      </div>
      <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>{t('people.explain')}</p>
    </Panel>
  )
}
