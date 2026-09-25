// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { ContractsScreen } from './ContractsScreen'

const starter = () => useGame.getState().game!.contracts.find((c) => c.tenderId === 'starter')!

describe('contract actions', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame
      .getState()
      .newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('opens per contract and shows level-locked moves as locked', () => {
    render(<ContractsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^actions for /i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Client care')).toBeInTheDocument()
    expect(within(dialog).getByText('Unlocks at level 2')).toBeInTheDocument()
    expect(within(dialog).getByText('Unlocks at level 3')).toBeInTheDocument()
    // Satisfaction starts at 70, below the care cap, so care is available.
    expect(within(dialog).getByRole('button', { name: /look after the client/i })).toBeEnabled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancels only after a confirmation, and lists the contract as cancelled by us', () => {
    render(<ContractsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^actions for /i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel…' }))
    expect(starter().terminated).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel .+/i }))
    expect(starter()).toMatchObject({ terminated: true, cancelled: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/cancelled by us/)).toBeInTheDocument()
  })

  it('shows the outcome of a renegotiation in the dialog', () => {
    const g = structuredClone(useGame.getState().game!)
    g.firms.player.level = 2
    g.quarter = 1
    g.contracts.find((c) => c.tenderId === 'starter')!.satisfaction = 100
    useGame.setState({ game: g })
    render(<ContractsScreen />)
    fireEvent.click(screen.getByRole('button', { name: /^actions for /i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /ask for a new rate \(100/i }))
    expect(within(dialog).getByText('The client agreed to the new rate.')).toBeInTheDocument()
    expect(starter().renegotiated).toBe('won')
  })
})
