// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { StaffScreen } from './StaffScreen'

describe('the people on the staff screen', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('lists everyone by name and opens a profile', () => {
    render(<StaffScreen />)
    const roster = useGame.getState().game!.firms.player.roster!
    for (const e of roster) expect(screen.getByRole('button', { name: `Show ${e.name}'s profile` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Show ${roster[0].name}'s profile` }))
    const dialog = screen.getByRole('dialog', { name: roster[0].name })
    expect(within(dialog).getByText(/quirks/i)).toBeInTheDocument()
    // Level 1: development is still locked.
    expect(within(dialog).getByText(/open at level 2/i)).toBeInTheDocument()
  })

  it('lists the stars too, and opens their card', () => {
    render(<StaffScreen />)
    const founders = useGame.getState().game!.firms.player.stars
    expect(founders.length).toBe(2)
    for (const star of founders) expect(screen.getByRole('button', { name: `Show ${star.name}'s profile` })).toBeInTheDocument()
    expect(screen.getByText(`${founders.length + 4} people`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `Show ${founders[0].name}'s profile` }))
    const dialog = screen.getByRole('dialog', { name: founders[0].name })
    expect(within(dialog).getByText(/founder/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/joined q1 2027/i)).toBeInTheDocument()
  })

  it('sends someone on a course from the profile once development is open', () => {
    const game = structuredClone(useGame.getState().game!)
    game.firms.player.level = 2
    useGame.getState().loadState(game)
    render(<StaffScreen />)
    const e = game.firms.player.roster![0]
    fireEvent.click(screen.getByRole('button', { name: `Show ${e.name}'s profile` }))
    const dialog = screen.getByRole('dialog', { name: e.name })
    fireEvent.click(within(dialog).getByRole('button', { name: /send on a course/i }))
    expect(useGame.getState().game!.firms.player.roster!.find((x) => x.id === e.id)!.course).toBeDefined()
    expect(within(dialog).getByText(/on a course, done after/i)).toBeInTheDocument()
  })

  it('lets a chosen person go from the profile', () => {
    render(<StaffScreen />)
    const e = useGame.getState().game!.firms.player.roster![1]
    fireEvent.click(screen.getByRole('button', { name: `Show ${e.name}'s profile` }))
    fireEvent.click(within(screen.getByRole('dialog', { name: e.name })).getByRole('button', { name: /let go/i }))
    expect(useGame.getState().game!.firms.player.roster!.some((x) => x.id === e.id)).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
