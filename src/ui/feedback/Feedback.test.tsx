// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { FeedbackForm, FeedbackPrompt } from './Feedback'
import { readFeedbackMemory } from './cadence'

const sendFeedback = vi.fn<(f: unknown) => Promise<void>>(() => Promise.resolve())
vi.mock('../../online/leaderboard', () => ({ sendFeedback: (f: unknown) => sendFeedback(f) }))

afterEach(() => {
  localStorage.clear()
  sendFeedback.mockClear()
})

describe('FeedbackForm', () => {
  it('sends the rating and trimmed comment, then says thanks and remembers it', async () => {
    const user = userEvent.setup()
    render(<FeedbackForm source="menu" quarter={null} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.click(screen.getByLabelText('4 stjerner'))
    await user.type(screen.getByRole('textbox'), '  Mer kaffe  ')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(sendFeedback).toHaveBeenCalledWith({
      rating: 4,
      text: 'Mer kaffe',
      lang: 'nb',
      source: 'menu',
      quarter: null,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Takk!')
    expect(readFeedbackMemory().sentAt).toBeGreaterThan(0)
  })
})

describe('FeedbackPrompt', () => {
  it('asks once, and backs off after "not now"', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<FeedbackPrompt context={{ at: 'end' }} quarter={39} />)
    await user.click(screen.getByRole('button', { name: 'Ikke nå' }))
    expect(screen.queryByRole('group')).toBeNull()
    expect(readFeedbackMemory()).toMatchObject({ dismissals: 1 })
    unmount()
    render(<FeedbackPrompt context={{ at: 'end' }} quarter={39} />)
    expect(screen.queryByRole('group')).toBeNull()
  })
})
