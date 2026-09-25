import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGame } from '../../store/gameStore'
import type { NewsItem } from '../../engine'
import { Bjorn } from '../components/Bjorn'
import { CountUp } from '../components/CountUp'
import { Icon } from '../components/Icon'
import { Button, Modal } from '../components/ui'
import { formatMoney, formatPercent, formatQuarter, newsText } from '../format'
import { bjornKey } from '../bjorn'
import { playSound } from '../sound'
import s from './screens.module.css'

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        dx: `${Math.cos((i / 24) * Math.PI * 2) * (120 + (i % 3) * 40)}px`,
        dy: `${Math.sin((i / 24) * Math.PI * 2) * (100 + (i % 4) * 30)}px`,
        color: ['#ff9e2c', '#48d597', '#ff5c8a', '#ffd84d', '#8f7bff'][i % 5],
      })),
    [],
  )
  return (
    <div className={s.confetti} aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} style={{ background: p.color, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy }} />
      ))}
    </div>
  )
}

export function QuarterReport() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const quarter = useGame((x) => x.report)!
  const dismiss = useGame((x) => x.dismissReport)
  const reducedMotion = useGame((x) => x.settings.reducedMotion)
  const me = game.firms[game.playerId]
  const r = me.history.find((h) => h.quarter === quarter)
  const news = game.news.filter((n) => n.quarter === quarter && n.personal)
  const wins = news.filter((n) => n.key.startsWith('news.tender.playerWon'))
  const milestones = news.filter((n) => n.key.startsWith('news.milestone.'))
  const record = news.some((n) => n.key === 'news.record.revenue')
  // Wins and trophies get their own cards, so the list below is for everything else.
  const rest = news.filter((n) => !wins.includes(n) && !milestones.includes(n) && n.key !== 'news.record.revenue')
  const won = wins.length > 0
  const awards = quarter % 4 === 3 ? game.lastAwards : []
  const scandal = news.some((n) => n.key.startsWith('news.scandal.') && n.firmId === me.id)
  const lost = news.some((n) => n.key === 'news.tender.playerLost')
  const mission = news.some((n) => n.key === 'news.mission.done')
  const celebrate = won || mission || record || milestones.length > 0
  const money = (n: number) => formatMoney(n, lng)

  useEffect(() => {
    playSound(
      scandal ? 'scandal' : won || record ? 'win' : mission || milestones.length ? 'fanfare' : lost ? 'lose' : 'cash',
    )
    // Once per report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarter])

  return (
    <Modal
      title={t('report.title', { quarter: formatQuarter(quarter) })}
      icon="chart"
      onClose={dismiss}
      actions={
        <Button variant="primary" onClick={dismiss}>
          {t('report.continue', { quarter: formatQuarter(game.quarter) })}
        </Button>
      }
    >
      {celebrate && !reducedMotion && <Confetti />}
      <div className={s.stack}>
        {wins.map((n) => (
          <WinCard key={n.id} item={n} />
        ))}
        {milestones.map((n) => (
          <div key={n.id} className={s.trophyCard}>
            <span className={s.trophyPlaque} aria-hidden>
              <Icon name="trophy" size={20} />
            </span>
            <div>
              <strong className={s.trophyTitle}>
                {t('report.trophy')} {t(`content:milestones.${n.key.replace('news.milestone.', '')}.name`)}
              </strong>
              <p className={s.small}>{newsText(n, t, lng)}</p>
            </div>
          </div>
        ))}
        {r && (
          <div>
            <div className={s.reportLine}>
              <span>
                {t('report.revenue')}
                {record && <span className={s.recordStamp}>{t('report.record')}</span>}
              </span>
              <span className="num">
                <CountUp value={r.revenue} format={money} />
              </span>
            </div>
            <div className={s.reportLine}>
              <span>{t('report.costs')}</span>
              <span className="num">
                −<CountUp value={r.costs} format={money} />
              </span>
            </div>
            {r.fines > 0 && (
              <div className={s.reportLine}>
                <span className={s.bad}>{t('report.fines')}</span>
                <span className={`num ${s.bad}`}>−{formatMoney(r.fines, lng)}</span>
              </div>
            )}
            <div className={`${s.reportLine} ${s.reportTotal}`}>
              <span>{t('report.result')}</span>
              <span className={`num ${r.ebitda - r.fines >= 0 ? s.good : s.bad}`}>
                <CountUp value={r.ebitda - r.fines} format={money} />
              </span>
            </div>
            <p className={`${s.small} ${s.muted}`}>
              {t('report.people', { hires: r.hires, leavers: r.leavers, util: formatPercent(r.utilization, lng) })}
            </p>
          </div>
        )}

        {rest.length > 0 && (
          <ul className={s.newsList}>
            {rest.map((n) => (
              <li key={n.id}>
                <span className={s.newsDot} data-tone={n.tone} />
                <span>{newsText(n, t, lng)}</span>
              </li>
            ))}
          </ul>
        )}

        {awards.length > 0 && (
          <div className={s.card}>
            <h3>
              <Icon name="trophy" size={12} /> {t('report.awards', { year: awards[0].year })}
            </h3>
            <ul className={s.newsList}>
              {awards.map((a) => (
                <li key={a.awardId}>
                  <span className={s.newsDot} data-tone={a.firmId === me.id ? 'good' : undefined} />
                  <span>
                    <strong>{t(`content:awards.${a.awardId}`)}:</strong> {game.firms[a.firmId].name}
                    {a.firmId === me.id && ' ★'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Bjorn text={t(bjornKey(game))} />
      </div>
    </Modal>
  )
}

/** A won tender as a moment of its own: stamp, customer and what it is worth. */
function WinCard({ item }: { item: NewsItem }) {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const framework = item.key === 'news.tender.playerWonFramework'
  const amount = typeof item.params.amount === 'number' ? item.params.amount : 0
  const bidders = Number(item.params.bidders ?? 1)
  return (
    <div className={s.winCard}>
      <span className={s.winStamp} aria-hidden>
        {t('report.win.stamp')}
      </span>
      <span className={`${s.small} ${s.muted}`}>
        {framework ? t('report.win.framework', { rank: item.params.rank }) : t('report.win.project')} ·{' '}
        {t('report.win.bidders', { count: bidders })}
      </span>
      <strong className={s.winCustomer}>
        <span className="sr-only">{t('report.win.stamp')}: </span>
        {t(`content:customers.${item.params.customer}.name`)}
      </strong>
      {amount > 0 && (
        <span className={s.winValue}>
          <span className={s.muted}>{t('report.win.value')}</span>{' '}
          <span className="num">
            <CountUp value={amount} format={(n) => formatMoney(n, lng)} duration={1200} />
          </span>
        </span>
      )}
      {typeof item.params.strong === 'string' && (
        <p className={s.small}>{t(`game:factors.strong.${item.params.strong}`)}</p>
      )}
    </div>
  )
}
