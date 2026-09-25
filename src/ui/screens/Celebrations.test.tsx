// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { Dashboard } from './Dashboard'
import { QuarterReport } from './QuarterReport'

describe('celebrations', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('gives a won tender and a new trophy their own cards in the report', () => {
    const game = structuredClone(useGame.getState().game!)
    game.news.push({
      id: 'nx',
      quarter: 0,
      key: 'news.tender.playerWon',
      params: { customer: 'navet', rank: 1, bidders: 3, strong: 'price', amount: 2_400_000 },
      tone: 'good',
      personal: true,
      firmId: 'player',
    })
    useGame.getState().loadState(game)
    act(() => useGame.getState().endTurn())
    render(<QuarterReport />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/awarded:/i).parentElement).toHaveTextContent(/NAVet/)
    expect(within(dialog).getByText('NOK 2.4M')).toBeInTheDocument()
    expect(within(dialog).getByText(/new trophy!/i)).toHaveTextContent(/first quarter done/i)
  })

  it('shows the trophy wall and lets you ask someone in the office what they think', () => {
    act(() => useGame.getState().endTurn())
    useGame.getState().dismissReport()
    render(<Dashboard />)
    expect(screen.getByText(/trophy wall · 1 of/i)).toBeInTheDocument()
    const roster = useGame.getState().game!.firms.player.roster!
    fireEvent.click(screen.getAllByRole('button', { name: roster[0].name })[0])
    expect(screen.getByRole('status')).toHaveTextContent(roster[0].name)
  })
})
