import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGame } from '../../store/gameStore'
import { Bjorn } from '../components/Bjorn'
import { Icon } from '../components/Icon'
import { Button, Modal } from '../components/ui'
import { formatMoney, formatPercent, formatQuarter, newsText } from '../format'
import { bjornKey } from '../bjorn'
import s from './screens.module.css'

function Confetti() {
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
  const won = news.some((n) => n.key.startsWith('news.tender.playerWon'))
  const awards = quarter % 4 === 3 ? game.lastAwards : []

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
      {won && !reducedMotion && <Confetti />}
      <div className={s.stack}>
        {r && (
          <div>
            <div className={s.reportLine}>
              <span>{t('report.revenue')}</span>
              <span className="num">{formatMoney(r.revenue, lng)}</span>
            </div>
            <div className={s.reportLine}>
              <span>{t('report.costs')}</span>
              <span className="num">−{formatMoney(r.costs, lng)}</span>
            </div>
            {r.fines > 0 && (
              <div className={s.reportLine}>
                <span className={s.bad}>{t('report.fines')}</span>
                <span className={`num ${s.bad}`}>−{formatMoney(r.fines, lng)}</span>
              </div>
            )}
            <div className={`${s.reportLine} ${s.reportTotal}`}>
              <span>{t('report.result')}</span>
              <span className={`num ${r.ebitda - r.fines >= 0 ? s.good : s.bad}`}>{formatMoney(r.ebitda - r.fines, lng)}</span>
            </div>
            <p className={`${s.small} ${s.muted}`}>
              {t('report.people', { hires: r.hires, leavers: r.leavers, util: formatPercent(r.utilization, lng) })}
            </p>
          </div>
        )}

        {news.length > 0 && (
          <ul className={s.newsList}>
            {news.map((n) => (
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
