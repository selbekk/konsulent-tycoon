import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { endTitle, rankings, shadyStats } from '../../engine'
import { useGame } from '../../store/gameStore'
import { Bjorn } from '../components/Bjorn'
import { Button, FirmGlyph, Modal } from '../components/ui'
import { firmColors } from '../firms'
import { formatMoney } from '../format'
import { playSound } from '../sound'
import s from './screens.module.css'

function ValueChart({ ids }: { ids: string[] }) {
  const game = useGame((x) => x.game)!
  const series = ids.map((id) => ({ id, values: game.firms[id].valuationHistory }))
  const max = Math.max(1, ...series.flatMap((x) => x.values))
  const len = Math.max(2, ...series.map((x) => x.values.length))
  const w = 400
  const h = 160
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', background: 'var(--bg)', border: '2px solid var(--border-dark)' }} role="img">
      {series.map(({ id, values }) => (
        <polyline
          key={id}
          fill="none"
          stroke={id === game.playerId ? 'var(--accent)' : firmColors(id)[0]}
          strokeWidth={id === game.playerId ? 4 : 2}
          vectorEffect="non-scaling-stroke"
          points={values.map((v, i) => `${(i / (len - 1)) * w},${h - (v / max) * (h - 8) - 4}`).join(' ')}
        />
      ))}
    </svg>
  )
}

export function EndGame() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const game = useGame((x) => x.game)!
  const quit = useGame((x) => x.quit)
  const go = useGame((x) => x.go)
  const [showAll, setShowAll] = useState(false)
  const me = game.firms[game.playerId]
  const title = endTitle(game)
  const ranks = rankings(game)
  const myRank = ranks.findIndex((r) => r.firmId === me.id) + 1
  const shown = showAll ? ranks : ranks.filter((r, i) => i < 5 || r.firmId === me.id)
  const { total, detected } = shadyStats(me)
  const chartIds = [...new Set([...ranks.slice(0, 5).map((r) => r.firmId), me.id])]
  const lost = game.status === 'lost'
  useEffect(() => {
    playSound(lost ? 'sad' : 'fanfare')
  }, [lost])

  return (
    <Modal
      wide
      icon="trophy"
      title={game.status === 'lost' ? t('end.lostTitle') : t('end.title')}
      actions={
        <>
          <Button onClick={quit}>{t('end.menu')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              quit()
              go('newGame')
            }}
          >
            {t('end.again')}
          </Button>
        </>
      }
    >
      <div className={s.stack}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--accent)', margin: '8px 0' }}>{t(`content:endTitles.${title}.title`)}</h1>
          <p>{t(`content:endTitles.${title}.desc`)}</p>
          <p className={s.muted}>{t('end.summary', { rank: myRank, total: ranks.length, value: formatMoney(ranks[myRank - 1].value, lng) })}</p>
          <p className={s.muted}>{total === 0 ? t('end.clean') : t('end.shady', { total, detected })}</p>
        </div>
        <ValueChart ids={chartIds} />
        <table className={s.table}>
          <tbody>
            {shown.map((r) => {
              const f = game.firms[r.firmId]
              return (
                <tr key={r.firmId} data-me={f.isPlayer}>
                  <td className={s.num}>{ranks.indexOf(r) + 1}</td>
                  <td>
                    <div className={s.row}>
                      <FirmGlyph name={f.name} colors={firmColors(f.id)} size={20} />
                      {f.name}
                    </div>
                  </td>
                  <td className={s.num}>{formatMoney(r.value, lng)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Button size="small" variant="ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t('market.showTop') : t('market.showAll', { count: ranks.length })}
        </Button>
        <Bjorn text={t(game.status === 'lost' ? 'bjorn.endLost' : myRank <= 3 ? 'bjorn.endGreat' : 'bjorn.endOk')} />
      </div>
    </Modal>
  )
}
