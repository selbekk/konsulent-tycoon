// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { MainMenu } from '../screens/Menus'

const type = (text: string, target: Window | Element = window) => {
  for (const key of text) fireEvent.keyDown(target, { key })
}

describe('Møteinvasjonen easter egg', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    // jsdom has no canvas; the game only needs getContext not to throw.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens when you type "start" on the main menu, and closes again', () => {
    render(<MainMenu />)
    type('sta')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    type('rt')
    expect(screen.getByRole('dialog', { name: /meeting invaders/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline everything/i })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ignores the word typed with modifiers or inside a text field', () => {
    render(
      <>
        <MainMenu />
        <input aria-label="field" />
      </>,
    )
    for (const key of 'start') fireEvent.keyDown(window, { key, ctrlKey: true })
    type('start', screen.getByRole('textbox', { name: 'field' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
