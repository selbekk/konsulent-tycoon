// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { newTestGame } from '../../engine/testUtils'
import { clock } from '../eggs/clock'
import { OfficeView } from './OfficeView'

describe('office easter eggs', () => {
  const day = clock.now
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    cleanup()
    clock.now = day
    vi.useRealTimers()
  })

  const renderOffice = () => {
    const game = newTestGame()
    return render(<OfficeView game={game} firm={game.firms.player} />)
  }
  const desks = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))

  it('sends everyone home at night except one person logging hours', () => {
    clock.now = () => new Date(2027, 2, 3, 14, 0).getTime()
    expect(renderOffice() && desks()).toHaveLength(6)
    cleanup()
    clock.now = () => new Date(2027, 2, 3, 3, 0).getTime()
    renderOffice()
    expect(desks()).toHaveLength(1)
    expect(screen.getByText(/still logging hours/i)).toBeInTheDocument()
  })

  it('answers the seventh click on the same colleague from a meeting', () => {
    renderOffice()
    const desk = desks()[0]
    for (let i = 0; i < 6; i++) fireEvent.click(desk)
    expect(screen.queryByText(/i am actually in a meeting/i)).not.toBeInTheDocument()
    fireEvent.click(desk)
    expect(screen.getByText(/i am actually in a meeting/i)).toBeInTheDocument()
  })

  it('breaks the coffee machine on the fifth click, then someone kicks it back to life', () => {
    vi.useFakeTimers()
    renderOffice()
    const machine = screen.getByRole('button', { name: /coffee/i })
    for (let i = 0; i < 5; i++) fireEvent.click(machine)
    expect(screen.getByText(/coffee machine is broken/i)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText(/with a boot/i)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.queryByText(/with a boot/i)).not.toBeInTheDocument()
  })
})
