// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { MainMenu } from '../screens/Menus'
import { MoneyRain } from './MoneyRain'
import { PowerpointMode } from './PowerpointMode'

const press = (keys: string[]) => keys.forEach((key) => fireEvent.keyDown(window, { key }))
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']

describe('easter eggs in the page', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().setSettings({ reducedMotion: false })
  })
  afterEach(cleanup)

  it('the Konami code turns the game into a slide deck, and the paperclip can turn it off', () => {
    render(<PowerpointMode />)
    press([...KONAMI, 'b', 'a'])
    expect(document.documentElement.dataset.egg).toBe('ppt')
    expect(screen.getByRole('complementary', { name: /clipsy/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /go away, clipsy/i }))
    expect(document.documentElement.dataset.egg).toBeUndefined()
  })

  it('typing "faktura" makes it rain money', () => {
    const { container } = render(<MoneyRain />)
    expect(container.querySelector('svg')).toBeNull()
    press([...'faktura'])
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(10)
  })

  it('typing "bingo" on the main menu starts a stand-up, and ten clicks on the city build a tower', () => {
    const { container } = render(<MainMenu />)
    press([...'bingo'])
    expect(screen.getByRole('dialog', { name: /stand-up bingo/i })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    const city = container.querySelector('svg')!.parentElement!
    for (let i = 0; i < 9; i++) fireEvent.click(city)
    expect(screen.queryByText(/biggest consultancy/i)).not.toBeInTheDocument()
    fireEvent.click(city)
    expect(screen.getByText(/biggest consultancy/i)).toBeInTheDocument()
  })
})
