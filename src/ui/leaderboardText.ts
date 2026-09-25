import type { TFunction } from 'i18next'
import type { LeaderboardName } from '../content/leaderboardNames'

/** "Elg & Regneark AS", in the viewer's language. */
export function nameText(t: TFunction, name: LeaderboardName): string {
  return t('leaderboard.nameFormat', {
    a: t(`content:leaderboardNames.nouns.${name[0]}`),
    b: t(`content:leaderboardNames.nouns.${name[1]}`),
    suffix: t(`content:leaderboardNames.suffixes.${name[2]}`),
  })
}

/** "uke 39, 2026". */
export function weekText(t: TFunction, week: string): string {
  const [year, w] = week.split('-W')
  return t('leaderboard.weekLabel', { week: Number(w), year })
}
