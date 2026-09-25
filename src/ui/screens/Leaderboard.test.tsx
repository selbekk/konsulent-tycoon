// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isoWeek, saveToSlot, weekSeed } from '../../engine'
import i18n from '../../i18n'
import type { RunSubmission, SubmitResult } from '../../online/submission'
import { useGame } from '../../store/gameStore'
import { EndGame } from './EndGame'
import { LeaderboardScreen } from './Leaderboard'
import { NewGame } from './Menus'

const online = vi.hoisted(() => ({
  joined: false,
  submitted: [] as RunSubmission[],
}))

vi.mock('../../online/leaderboard', () => ({
  SubmitFailed: class extends Error {},
  isOptedIn: () => online.joined,
  savedName: () => null,
  savedResult: () => null,
  myUid: async () => (online.joined ? 'me' : null),
  optIn: async () => {
    online.joined = true
  },
  submitRun: async (s: RunSubmission): Promise<SubmitResult> => {
    online.submitted.push(s)
    return {
      valuation: s.claimedValuation,
      title: 'midfield',
      rank: 9,
      status: 'finished',
      quarter: 40,
      minigameAvg: null,
      shady: 0,
      week: s.week,
      best: true,
      place: 2,
      players: 11,
      percentile: 90,
    }
  },
  weekBoard: async () => [
    {
      uid: 'someone',
      week: '2026-W39',
      name: ['moose', 'spreadsheet', 'as'],
      valuation: 90_000_000,
      title: 'industry_leader',
      rank: 1,
    },
    { uid: 'me', week: '2026-W39', name: ['owl', 'waffle', 'labs'], valuation: 40_000_000, title: 'midfield', rank: 9 },
  ],
  hallOfFame: async () => [],
  myHistory: async () => [],
  deleteAccount: async () => undefined,
}))

describe('leaderboard UI', () => {
  beforeEach(async () => {
    localStorage.clear()
    online.joined = false
    online.submitted = []
    await i18n.changeLanguage('en')
    useGame.getState().quit()
  })

  afterEach(cleanup)

  it('starts the weekly challenge on the week’s seed, on normal', () => {
    render(<NewGame />)
    fireEvent.click(screen.getByRole('button', { name: 'Firm of the Week' }))
    expect(screen.queryByLabelText(/seed/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /start|found/i }))
    const game = useGame.getState().game!
    const week = isoWeek(Date.now())
    expect(game.weekly?.week).toBe(week)
    expect(game.seed).toBe(weekSeed(week))
    expect(game.difficulty).toBe('normal')
  })

  it('lets you join and send in a finished weekly game from the end screen', async () => {
    const week = isoWeek(Date.now())
    useGame.getState().newGame({
      seed: weekSeed(week),
      firmName: 'Hemmelig AS',
      founderDisciplines: ['backend', 'frontend'],
      difficulty: 'normal',
      weekly: week,
    })
    // Declare the game over without playing 40 quarters; the log is what matters here.
    useGame.getState().endTurn()
    useGame.setState({ game: { ...useGame.getState().game!, status: 'finished' } })
    render(<EndGame />)
    fireEvent.click(screen.getByRole('button', { name: 'Join and send' }))
    expect(await screen.findByText(/number 2 of 11/i)).toBeInTheDocument()
    expect(screen.getByText(/beat 90% of the other players/i)).toBeInTheDocument()
    expect(online.submitted).toHaveLength(1)
    expect(online.submitted[0].log).toEqual(['end'])
    expect(JSON.stringify(online.submitted[0])).not.toContain('Hemmelig')
  })

  it('has no leaderboard panel for a free game', () => {
    useGame
      .getState()
      .newGame({ seed: 3, firmName: 'Fri AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'easy' })
    useGame.setState({ game: { ...useGame.getState().game!, status: 'finished' } })
    render(<EndGame />)
    expect(screen.queryByRole('button', { name: 'Join and send' })).not.toBeInTheDocument()
  })

  it('shows the week’s list with names in the reader’s language and marks your own row', async () => {
    online.joined = true
    render(<LeaderboardScreen />)
    expect(await screen.findByText('Moose & Spreadsheet Ltd')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Owl & Waffle Labs').closest('tr')).toHaveAttribute('data-me', 'true'))
    expect(screen.getByRole('button', { name: 'My games' })).toBeInTheDocument()
  })

  it('offers to send an autosaved weekly game that never got sent', async () => {
    const week = isoWeek(Date.now())
    useGame.getState().newGame({
      seed: weekSeed(week),
      firmName: 'Senere AS',
      founderDisciplines: ['backend', 'frontend'],
      difficulty: 'normal',
      weekly: week,
    })
    useGame.getState().endTurn()
    saveToSlot(localStorage, 'auto', { ...useGame.getState().game!, status: 'finished' })
    useGame.getState().quit()
    render(<LeaderboardScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Join and send' }))
    expect(await screen.findByText(/number 2 of 11/i)).toBeInTheDocument()
    expect(online.submitted[0].log).toEqual(['end'])
  })
})
