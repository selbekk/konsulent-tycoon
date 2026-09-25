// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { MarketScreen } from './MarketScreen'

describe('customer profile', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('opens from the customer list with a description and every metric, and closes on Escape', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the profile for Kryptonitt' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/beanbags/)).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Buzz: 5 out of 5' })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'Maturity: 1 out of 5' })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('img')).toHaveLength(12)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
