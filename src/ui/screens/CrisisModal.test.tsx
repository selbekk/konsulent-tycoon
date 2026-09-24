// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CRISIS_MAP } from '../../content/crises'
import { startCrisis } from '../../engine/crises'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { Shell } from './Shell'

/** Starts a crisis for the player the way drawCrises would, and hands the state to the store. */
function giveCrisis(defId: string, severity: 'low' | 'high' = 'low') {
  const game = structuredClone(useGame.getState().game!)
  const c = game.contracts.find((x) => x.firmId === game.playerId && !x.terminated && x.startQuarter <= game.quarter)!
  startCrisis(game, game.firms[game.playerId], CRISIS_MAP[defId], { contract: c.id, customer: c.customerId }, severity)
  act(() => useGame.setState({ game }))
}

describe('crisis dialog', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('pops up once, can wait, and resolves from the dashboard panel', () => {
    render(<Shell />)
    giveCrisis('prod_outage')
    const dialog = screen.getByRole('dialog', { name: /outage at/i })
    expect(within(dialog).getByText(/severity/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /decide later/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // It does not pop up again by itself, but the dashboard tracks it.
    const panel = screen.getByRole('heading', { name: /crises/i }).closest('section')!
    fireEvent.click(within(panel).getByRole('button', { name: /decide/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /calm, blameless debugging/i }))
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent(/continues next quarter/i)
    expect(useGame.getState().game!.crises![0].status).toBe('waiting')
  })

  it('does not block ending the quarter, but the to-do list asks first', () => {
    render(<Shell />)
    giveCrisis('power_outage')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /decide later/i }))
    fireEvent.click(screen.getByRole('button', { name: /end quarter/i }))
    const warning = screen.getByRole('dialog', { name: /end the quarter\?/i })
    fireEvent.click(within(warning).getByRole('button', { name: /to the crisis/i }))
    expect(screen.getByRole('dialog', { name: /power cut/i })).toBeInTheDocument()
  })

  it('plays a crisis talk and records its score', () => {
    render(<Shell />)
    giveCrisis('client_exit')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /crisis meeting with the client/i }))
    const talk = screen.getByRole('dialog', { name: /crisis meeting with the client/i })
    fireEvent.click(within(talk).getByRole('button', { name: /go in/i }))
    for (let i = 0; i < 3; i++) {
      const d = screen.getByRole('dialog')
      fireEvent.click(within(d).getAllByRole('button').find((b) => b.className.includes('answer'))!)
      fireEvent.click(within(d).getByRole('button', { name: /^(next|done)$/i }))
    }
    expect(screen.getByText(/the talk scored \d+ out of 100/i)).toBeInTheDocument()
    const log = useGame.getState().game!.crises![0].log
    expect(log[0]).toMatchObject({ choiceId: 'rescue_meeting' })
    expect(typeof log[0].score).toBe('number')
  })
})
