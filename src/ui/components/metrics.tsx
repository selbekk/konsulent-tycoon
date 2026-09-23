import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Capacity, KpiPoint } from '../../engine'
import { formatQuarter } from '../format'
import s from './metrics.module.css'

/** One-series trend line with a crosshair + tooltip on hover (or focus + arrow keys). */
export function TrendLine({ points, format, label }: { points: KpiPoint[]; format: (v: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  if (points.length < 2) return <div className={s.trendEmpty} aria-hidden />
  const w = 200
  const h = 44
  const pad = 4
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  const active = hover ?? last

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const rel = ((e.clientX - r.left) / r.width) * w
    setHover(Math.max(0, Math.min(last, Math.round(((rel - pad) / (w - pad * 2)) * last))))
  }

  return (
    <div className={s.trend}>
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className={s.trendSvg}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        tabIndex={0}
        role="img"
        aria-label={`${label}: ${points.map((p) => `${formatQuarter(p.quarter)} ${format(p.value)}`).join(', ')}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover(Math.max(0, active - 1))
          if (e.key === 'ArrowRight') setHover(Math.min(last, active + 1))
        }}
        onBlur={() => setHover(null)}
      >
        <path d={d} fill="none" stroke="var(--chart-line)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />}
      </svg>
      {/* Markers as HTML so they stay round under preserveAspectRatio="none". */}
      <span className={s.dot} style={{ left: `${(x(active) / w) * 100}%`, top: `${(y(points[active].value) / h) * 100}%` }} />
      {hover !== null && (
        <span className={s.tip} style={{ left: `${(x(hover) / w) * 100}%` }}>
          <strong className="num">{format(points[hover].value)}</strong> <span>{formatQuarter(points[hover].quarter)}</span>
        </span>
      )}
    </div>
  )
}

export function KpiTile({
  abbr,
  name,
  value,
  lines,
  trend,
}: {
  abbr: string
  name: string
  value: ReactNode
  lines: ReactNode[]
  trend?: ReactNode
}) {
  return (
    <div className={s.tile}>
      <div className={s.tileHead}>
        <span className={s.abbr}>{abbr}</span>
        <span className={s.name}>{name}</span>
      </div>
      <div className={`${s.value} num`}>{value}</div>
      {trend}
      <ul className={s.lines}>
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

/** "▲ +3 pp" style comparison in neutral ink with a direction glyph – never color alone. */
export function Delta({ diff, format, better = 'up' }: { diff?: number; format: (v: number) => string; better?: 'up' | 'down' }) {
  if (diff === undefined || !Number.isFinite(diff)) return <span className={s.muted}>–</span>
  const up = diff > 0.0005
  const down = diff < -0.0005
  const good = better === 'up' ? up : down
  const tone = up || down ? (good ? s.good : s.bad) : s.muted
  return (
    <span className={tone}>
      {up ? '▲' : down ? '▼' : '●'} {up ? '+' : ''}
      {format(diff)}
    </span>
  )
}

function Stacked({ label, segments, total }: { label: string; total: number; segments: { key: string; value: number; className: string; name: string }[] }) {
  return (
    <div className={s.stackRow}>
      <span className={s.stackLabel}>{label}</span>
      <div className={s.stack} role="img" aria-label={`${label}: ${segments.map((g) => `${g.name} ${g.value}`).join(', ')}`}>
        {segments
          .filter((g) => g.value > 0)
          .map((g) => (
            <span key={g.key} className={`${s.segment} ${g.className}`} style={{ flexGrow: g.value }} title={`${g.name}: ${g.value}`}>
              {g.value / Math.max(1, total) >= 0.12 && <span className={s.segLabel}>{g.value}</span>}
            </span>
          ))}
      </div>
    </div>
  )
}

export function CapacityChart({ cap }: { cap: Capacity }) {
  const { t } = useTranslation()
  const id = useId()
  const billing = t('capacity.billing')
  const committed = t('capacity.committed')
  const offered = t('capacity.offered')
  const bench = t('capacity.bench')
  return (
    <div className={s.capacity} aria-describedby={id}>
      <Stacked
        label={t('capacity.now')}
        total={cap.headcount}
        segments={[
          { key: 'b', value: cap.billing, className: s.seg1, name: billing },
          { key: 'r', value: cap.bench, className: s.segRest, name: bench },
        ]}
      />
      <Stacked
        label={t('capacity.next')}
        total={cap.headcount}
        segments={[
          { key: 'c', value: cap.next.committed, className: s.seg1, name: committed },
          { key: 'o', value: cap.next.offered, className: s.seg2, name: offered },
          { key: 'i', value: cap.next.idle, className: s.segRest, name: bench },
        ]}
      />
      <ul className={s.legend} id={id}>
        <li>
          <span className={`${s.swatch} ${s.seg1}`} /> {t('capacity.billingLegend')}{' '}
          <strong className="num">
            {cap.billing} → {cap.next.committed}
          </strong>
        </li>
        <li>
          <span className={`${s.swatch} ${s.segRest}`} /> {t('capacity.benchLegend')}{' '}
          <strong className="num">
            {cap.bench} → {cap.next.idle}
          </strong>
        </li>
        <li>
          <span className={`${s.swatch} ${s.seg2}`} /> {t('capacity.inBids')} <strong className="num">{cap.next.offered}</strong>
          {cap.next.seatsInBids > cap.next.offered && <span className={s.muted}> {t('capacity.seatsInBids', { count: cap.next.seatsInBids })}</span>}
        </li>
      </ul>
    </div>
  )
}
