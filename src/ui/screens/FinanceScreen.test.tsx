// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { FinanceScreen } from './FinanceScreen'

describe('finance tab', () => {
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

  it('starts with a budget and an empty ledger', () => {
    render(<FinanceScreen />)
    expect(screen.getByText('Salaries')).toBeInTheDocument()
    expect(screen.getByText(/no quarters on the books yet/i)).toBeInTheDocument()
  })

  it('books each ended quarter, newest first', () => {
    useGame.getState().endTurn()
    useGame.getState().endTurn()
    render(<FinanceScreen />)
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '')
    const q1 = rows.findIndex((r) => r.startsWith('Q1 2027'))
    const q2 = rows.findIndex((r) => r.startsWith('Q2 2027'))
    expect(q2).toBeGreaterThan(-1)
    expect(q2).toBeLessThan(q1)
  })

  it('only links to tabs the player has unlocked', () => {
    render(<FinanceScreen />)
    expect(screen.queryByRole('button', { name: /culture/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /people/i }))
    expect(useGame.getState().tab).toBe('staff')
  })
})
