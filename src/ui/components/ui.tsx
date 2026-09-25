import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import s from './ui.module.css'

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  style,
}: {
  title?: ReactNode
  icon?: IconName
  actions?: ReactNode
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section className={`${s.panel} ${className ?? ''}`} style={style}>
      {title && (
        <header className={s.panelHeader}>
          <h2 className={s.panelTitle}>
            {icon && <Icon name={icon} size={14} />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

type Variant = 'default' | 'primary' | 'danger' | 'ghost'
export function Button({
  variant = 'default',
  size,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'small' | 'big'
  icon?: IconName
  ref?: Ref<HTMLButtonElement>
}) {
  const cls = [s.button, variant !== 'default' && s[variant], size && s[size], className].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'small' ? 12 : 16} />}
      {children}
    </button>
  )
}

export function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon?: IconName
  label: ReactNode
  value: ReactNode
  tone?: 'good' | 'bad'
}) {
  return (
    <div className={s.stat}>
      {icon && <Icon name={icon} size={20} />}
      <div style={{ minWidth: 0 }}>
        <span className={s.statLabel}>{label}</span>
        <span className={`${s.statValue} num`} style={tone ? { color: `var(--${tone})` } : undefined}>
          {value}
        </span>
      </div>
    </div>
  )
}

export function Meter({
  label,
  value,
  max = 100,
  color,
  display,
}: {
  label: ReactNode
  value: number
  max?: number
  color?: string
  display?: ReactNode
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const auto = pct >= 66 ? 'var(--good)' : pct >= 40 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className={s.meter}>
      <div className={s.meterLabel}>
        <span>{label}</span>
        <span className="num">{display ?? Math.round(value)}</span>
      </div>
      <div
        className={s.meterTrack}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <div className={s.meterFill} style={{ width: `${pct}%`, ['--meter' as string]: color ?? auto }} />
      </div>
    </div>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'info' | 'accent' }) {
  return (
    <span className={s.badge} data-tone={tone}>
      {children}
    </span>
  )
}

export function Modal({
  title,
  icon,
  children,
  onClose,
  wide,
  actions,
}: {
  title: ReactNode
  icon?: IconName
  children: ReactNode
  onClose?: () => void
  wide?: boolean
  actions?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const { t } = useTranslation()
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus()
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts.
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (e.key === 'Escape' && onClose && dialogs[dialogs.length - 1] === ref.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    // Clicking the backdrop is a mouse shortcut; keyboards close with Escape.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`${s.modal} ${wide ? s.modalWide : ''}`}
      >
        <section className={s.panel}>
          <header className={s.panelHeader}>
            <h2 className={s.panelTitle} id={id}>
              {icon && <Icon name={icon} size={14} />}
              {title}
            </h2>
            {onClose && (
              <Button variant="ghost" size="small" onClick={onClose} aria-label={t('common.close')}>
                <Icon name="cross" size={10} />
              </Button>
            )}
          </header>
          {children}
          {actions && <div className={s.modalActions}>{actions}</div>}
        </section>
      </div>
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: ReactNode
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className={s.slider}>
      <label className={s.sliderHead} htmlFor={id}>
        <span>{label}</span>
        <span className="num">{display ?? value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className={s.hint}>{hint}</span>}
    </div>
  )
}

export function Stepper({
  value,
  min = 0,
  max = 99,
  onChange,
  label,
}: {
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
  label: string
}) {
  return (
    <span className={s.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="−">
        −
      </button>
      <output className="num">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="+">
        +
      </button>
    </span>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className={s.hint}>{children}</p>
}

/** Firm "logo": two-letter pixel glyph in the firm's colours. */
export function FirmGlyph({ name, colors, size = 28 }: { name: string; colors: [string, string]; size?: number }) {
  const letters = name
    .replace(/[^A-Za-zÆØÅæøå0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const initials = (letters.length > 1 ? letters[0][0] + letters[1][0] : name.slice(0, 2)).toUpperCase()
  return (
    <span
      className={s.glyph}
      style={{ width: size, height: size, background: colors[0], color: colors[1], fontSize: size * 0.3 }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function Sparkline({ values, color = 'var(--accent)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <svg className={s.sparkline} aria-hidden />
  const min = Math.min(0, ...values)
  const max = Math.max(...values, 1)
  const w = 100
  const h = 40
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * h] as const)
  const zeroY = h - ((0 - min) / (max - min || 1)) * h
  return (
    <svg className={s.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <line
        x1={0}
        x2={w}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--border)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="miter"
      />
    </svg>
  )
}
