/**
 * Posts in the news section, newest first. The text lives in `ui:news.posts.<id>` (`title` and a `body` array of
 * paragraphs); `date` is the publishing day as `YYYY-MM-DD`.
 */
export const NEWS_POSTS = [{ id: 'welcome', date: '2026-09-25' }] as const

export type NewsPost = (typeof NEWS_POSTS)[number]

export function formatPostDate(date: string, lng: string): string {
  // Parsed and shown in UTC, so the day doesn't shift with the reader's time zone.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(lng, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
