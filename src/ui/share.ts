import type { TFunction } from 'i18next'
import { endTitle, rankings } from '../engine'
import type { GameState } from '../engine'
import { track } from '../analytics'
import { formatMoney, formatQuarter } from './format'
import { weekText } from './leaderboardText'

export type ShareSource = 'about' | 'end' | 'year'
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * The share sheet where there is one (phones), the clipboard everywhere else. `copy` is what lands on the clipboard,
 * since a pasted message has no separate url field.
 */
export async function share({
  text,
  url,
  copy,
  source,
}: {
  text: string
  url: string
  copy: string
  source: ShareSource
}): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Konsulent Tycoon', text, url })
      track('game_shared', { method: 'share_sheet', source })
      return 'shared'
    } catch (e) {
      // The user closed the share sheet; that's an answer, not an error.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(copy)
    track('game_shared', { method: 'clipboard', source })
    return 'copied'
  } catch {
    return 'failed'
  }
}

/**
 * "Fakturerbar AS finished #3 of 25 … Just ahead of Rival AS." for the end of the game (`end`) or of a year
 * (`year`). It names the player's firm because the player sends it themselves; it never goes to analytics.
 */
export function resultShareText(game: GameState, kind: 'end' | 'year', t: TFunction, lng: string): string {
  const me = game.firms[game.playerId]
  const ranks = rankings(game)
  const index = ranks.findIndex((r) => r.firmId === me.id)
  const base = { firm: me.name, rank: index + 1, total: ranks.length, value: formatMoney(ranks[index].value, lng) }
  const parts: string[] = []

  if (game.status === 'lost') {
    parts.push(t('share.result.bankrupt', { firm: me.name, quarter: formatQuarter(game.quarter) }))
  } else {
    if (kind === 'end') {
      parts.push(t('share.result.end', { ...base, title: t(`content:endTitles.${endTitle(game)}.title`) }))
    } else {
      parts.push(t('share.result.year', { ...base, count: Math.floor(game.quarter / 4) }))
      const award = game.lastAwards.find((a) => a.firmId === me.id)
      if (award) parts.push(t('share.result.award', { award: t(`content:awards.${award.awardId}`) }))
    }
    const behind = ranks[index + 1]
    if (index === 0) parts.push(t('share.result.first', { count: ranks.length - 1 }))
    else if (behind) parts.push(t('share.result.ahead', { rival: game.firms[behind.firmId].name }))
  }
  if (game.weekly) parts.push(t('share.result.weekly', { week: weekText(t, game.weekly.week) }))
  return parts.join(' ')
}
