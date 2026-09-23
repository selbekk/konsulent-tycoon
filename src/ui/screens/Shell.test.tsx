// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  })

  afterEach(cleanup)

  it('hides Culture and the Backroom until the firm reaches their level', () => {
    const { rerender } = render(<Shell />)
    const nav = () => within(screen.getByRole('navigation'))
    expect(nav().queryByRole('button', { name: /culture/i })).not.toBeInTheDocument()
    expect(nav().queryByRole('button', { name: /backroom/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/level 1 · garage outfit/i).length).toBeGreaterThan(0)

    const game = structuredClone(useGame.getState().game!)
    game.firms.player.level = 3
    useGame.getState().loadState(game)
    rerender(<Shell />)
    expect(nav().getByRole('button', { name: /culture/i })).toBeInTheDocument()
    expect(nav().getByRole('button', { name: /backroom/i })).toBeInTheDocument()
  })
})
