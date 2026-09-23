// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { Shell } from './Shell'

describe('end of quarter warning', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('asks before ending the quarter with open to-dos, from the button and from Enter', () => {
    render(<Shell />)
    fireEvent.click(screen.getByRole('button', { name: /end quarter/i }))
    expect(screen.getByRole('dialog', { name: /end the quarter\?/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: /end the quarter\?/i })).toBeInTheDocument()
    expect(useGame.getState().game!.quarter).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /end anyway/i }))
    expect(useGame.getState().game!.quarter).toBe(1)
  })

  it('jumps to the right tab from the warning', () => {
    render(<Shell />)
    fireEvent.click(screen.getByRole('button', { name: /end quarter/i }))
    const dialog = screen.getByRole('dialog', { name: /end the quarter\?/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /to tenders/i }))
    expect(useGame.getState().tab).toBe('tenders')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('levels in the shell', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('hides Culture and the Backroom until the firm reaches their level', () => {
    const { rerender } = render(<Shell />)
    const nav = () => within(screen.getByRole('navigation'))
    expect(nav().queryByRole('button', { name: /culture/i })).not.toBeInTheDocument()
    expect(nav().queryByRole('button', { name: /backroom/i })).not.toBeInTheDocument()
    expect(nav().queryByRole('button', { name: /strategy/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/level 1 · garage outfit/i).length).toBeGreaterThan(0)

    const game = structuredClone(useGame.getState().game!)
    game.firms.player.level = 3
    useGame.getState().loadState(game)
    rerender(<Shell />)
    expect(nav().getByRole('button', { name: /culture/i })).toBeInTheDocument()
    expect(nav().getByRole('button', { name: /backroom/i })).toBeInTheDocument()
    expect(nav().getByRole('button', { name: /strategy/i })).toBeInTheDocument()
  })

  it('celebrates a new level once the quarter report is closed', () => {
    const game = structuredClone(useGame.getState().game!)
    game.firms.player.tendersWon = 3
    useGame.getState().loadState(game)
    render(<Shell />)
    act(() => useGame.getState().endTurn())
    expect(useGame.getState().levelUp).toEqual({ from: 1, to: 2 })
    fireEvent.click(screen.getByRole('button', { name: /^on to/i }))
    const dialog = screen.getByRole('dialog', { name: /new level: startup/i })
    expect(within(dialog).getByText(/the culture tab/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /back to work/i }))
    expect(useGame.getState().levelUp).toBeNull()
    expect(screen.queryByRole('dialog', { name: /new level/i })).not.toBeInTheDocument()
  })

  it('renders every strategy section at level 5 and buys a firm', () => {
    const game = structuredClone(useGame.getState().game!)
    Object.assign(game.firms.player, { level: 5, cash: 400_000_000 })
    game.firms.player.pools.backend.count += 60
    game.pendingEvents = []
    useGame.getState().loadState(game)
    render(<Shell />)
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /strategy/i }))
    for (const name of [/specialisation/i, /partnerships/i, /lobbying/i, /departments/i, /acquisitions/i, /^ipo$/i])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^buy$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /buy the firm/i }))
    expect(useGame.getState().game!.firms.player.stats?.acquisitions).toBe(1)
  })
})

describe('onboarding', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
  })

  afterEach(cleanup)

  it('shows the guide on a new game and walks through every step', () => {
    render(<Shell />)
    const dialog = () => screen.getByRole('dialog')
    expect(within(dialog()).getByText(/you've just founded test as\. you have 40 quarters/i)).toBeInTheDocument()
    expect(within(dialog()).getByText(/step 1 of 5/i)).toBeInTheDocument()
    expect(within(dialog()).queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()

    // Enter must not end the quarter behind the guide.
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(useGame.getState().game!.quarter).toBe(0)

    fireEvent.click(within(dialog()).getByRole('button', { name: /^next/i }))
    expect(within(dialog()).getByText(/post job openings under people\./i)).toBeInTheDocument()
    for (let i = 0; i < 3; i++) fireEvent.click(within(dialog()).getByRole('button', { name: /^next/i }))
    expect(within(dialog()).getByText(/step 5 of 5/i)).toBeInTheDocument()
    expect(within(dialog()).getByText(/level 5 · industry heavyweight/i)).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole('button', { name: /^back$/i }))
    expect(within(dialog()).getByText(/step 4 of 5/i)).toBeInTheDocument()
    for (let i = 0; i < 3; i++) fireEvent.click(within(dialog()).getByRole('button', { name: /^back$/i }))
    expect(within(dialog()).getByText(/step 1 of 5/i)).toBeInTheDocument()
    expect(dialog()).toContainElement(document.activeElement as HTMLElement)
    for (let i = 0; i < 3; i++) fireEvent.click(within(dialog()).getByRole('button', { name: /^next/i }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /^next/i }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /let's go/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useGame.getState().onboarding).toBe(false)
  })

  it('can be skipped with the button or Escape', () => {
    const { rerender } = render(<Shell />)
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    useGame.getState().newGame({ seed: 6, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    rerender(<Shell />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show when loading a saved game', () => {
    useGame.getState().loadState(structuredClone(useGame.getState().game!))
    render(<Shell />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
