/** Level 1–5 as stars, with the exact level on hover. */
export function Levels({ level }: { level: number }) {
  const full = Math.round(level)
  return (
    <span aria-label={`${level.toFixed(1)} / 5`} title={level.toFixed(1)} style={{ letterSpacing: 1, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}
