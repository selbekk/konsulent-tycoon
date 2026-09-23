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
