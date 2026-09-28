// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { rankings } from '../engine'
import type { GameState } from '../engine'
import { newTestGame } from '../engine/testUtils'
import i18n from '../i18n'
import { resultShareText, share } from './share'

const t = i18n.t.bind(i18n)

function gameWithCash(cash: number, patch: Partial<GameState> = {}): GameState {
  const game = { ...newTestGame(7), ...patch }
  game.firms[game.playerId].name = 'Fakturerbar AS'
  game.firms[game.playerId].cash = cash
  return game
}

describe('resultShareText', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('nb')
  })

  it('names the firm, its rank, the verdict and the rival right behind it', () => {
    // One rival far ahead puts the player second, with someone right behind.
    const game = gameWithCash(5_000_000_000, { status: 'finished' })
    game.firms[game.firmOrder.find((id) => id !== game.playerId)!].cash = 10_000_000_000
    const ranks = rankings(game)
    const index = ranks.findIndex((r) => r.firmId === game.playerId)
    const behind = game.firms[ranks[index + 1].firmId].name
    const text = resultShareText(game, 'end', t, 'nb')
    expect(text).toContain('Fakturerbar AS endte som nr. 2')
    expect(text).toContain(`av ${ranks.length}`)
    expect(text).toContain('Dommen: «')
    expect(text).toContain(`Rett foran ${behind}.`)
  })

  it('says you beat everyone when you are first', () => {
    const game = gameWithCash(10_000_000_000, { status: 'finished' })
    expect(resultShareText(game, 'end', t, 'nb')).toContain(`Foran alle de ${game.firmOrder.length - 1} andre.`)
  })

  it('tells a bankruptcy as a bankruptcy', () => {
    const text = resultShareText(gameWithCash(0, { status: 'lost' }), 'end', t, 'nb')
    expect(text).toContain('Fakturerbar AS gikk konkurs')
    expect(text).not.toContain('Rett foran')
  })

  it('counts the years and brags about an award after a year', () => {
    const game = gameWithCash(10_000_000_000, { quarter: 8 })
    game.lastAwards = [{ year: 2028, awardId: 'tender_champion', firmId: game.playerId }]
    const text = resultShareText(game, 'year', t, 'nb')
    expect(text).toContain('etter 2 år i Konsulent Tycoon')
    expect(text).toContain(`Og vi vant «${t('content:awards.tender_champion')}».`)
  })

  it('has every piece in English too', async () => {
    await i18n.changeLanguage('en')
    const text = resultShareText(gameWithCash(10_000_000_000, { status: 'finished' }), 'end', t, 'en')
    expect(text).toMatch(/^Fakturerbar AS finished #1 of \d+ after ten years/)
    await i18n.changeLanguage('nb')
  })
})

describe('share', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
  })

  it('copies text and link when there is no share sheet', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const result = await share({ text: 'Hei', url: 'https://x.no', copy: 'Hei\nhttps://x.no', source: 'end' })
    expect(result).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('Hei\nhttps://x.no')
  })

  it('treats a closed share sheet as an answer, not a reason to copy', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(navigator, 'share', {
      value: async () => {
        throw new DOMException('closed', 'AbortError')
      },
      configurable: true,
    })
    expect(await share({ text: 'Hei', url: 'https://x.no', copy: 'Hei', source: 'end' })).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })
})
