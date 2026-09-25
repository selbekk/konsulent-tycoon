import { WEEKLY_GRACE_DAYS } from './constants'
import { hashString } from './rng'

const DAY = 86_400_000

/** ISO 8601 week of a moment, in UTC: `'2026-W39'`. Weeks start on Monday; week 1 holds the year's first Thursday. */
export function isoWeek(ms: number): string {
  const d = new Date(ms)
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + (3 - day) * DAY
  const year = new Date(thursday).getUTCFullYear()
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

const WEEK_RE = /^(\d{4})-W(\d{2})$/

/** Start (Monday 00:00 UTC) and end (next Monday) of an ISO week, or null for a malformed week id. */
export function weekBounds(week: string): { start: number; end: number } | null {
  const m = WEEK_RE.exec(week)
  if (!m) return null
  const year = Number(m[1])
  const n = Number(m[2])
  const jan4 = Date.UTC(year, 0, 4)
  const week1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY
  const start = week1 + (n - 1) * 7 * DAY
  if (n < 1 || isoWeek(start) !== week) return null
  return { start, end: start + 7 * DAY }
}

/** The shared seed everyone plays in a week. */
export function weekSeed(week: string): number {
  return hashString(`weekly:${week}`)
}

/** Whether a game from `week` may still go on the leaderboard at `now`: during the week and WEEKLY_GRACE_DAYS after. */
export function weekOpen(week: string, now: number): boolean {
  const b = weekBounds(week)
  return !!b && now >= b.start && now < b.end + WEEKLY_GRACE_DAYS * DAY
}
