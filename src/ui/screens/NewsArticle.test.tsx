// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../i18n'
import type { NewsItem } from '../../engine'
import { useGame } from '../../store/gameStore'
import { NewsArticle } from './NewsArticle'
import { Shell } from './Shell'

const item = (key: string, params: NewsItem['params']): NewsItem => ({ id: 'n1', quarter: 3, key, params, tone: 'neutral' })

describe('news stories', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
    useGame.getState().dismissOnboarding()
  })

  afterEach(cleanup)

  it('opens the story behind a ticker line', () => {
    render(<Shell />)
    const ticker = screen.getByLabelText(/industry news/i)
    const first = within(ticker).getAllByRole('button')[0]
    fireEvent.click(first)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('The Daily Consultant')).toBeInTheDocument()
    expect(within(dialog).getByText(/· By \S+ \S+/)).toBeInTheDocument()
  })

  it('fills in names and numbers, with plurals where the story has them', () => {
    const { unmount } = render(<NewsArticle item={item('news.staff.arrived', { count: 3 })} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: /new faces in the corridors at test as/i })).toBeInTheDocument()
    expect(screen.getByText(/^3 new consultants have received/)).toBeInTheDocument()
    unmount()
    render(<NewsArticle item={item('news.staff.courseDone', { name: 'Kari Berg', count: 2 })} onClose={() => {}} />)
    expect(screen.getByText(/^2 people at Test AS finished courses/)).toBeInTheDocument()
  })

  it('resolves ids like customers in the story', () => {
    render(<NewsArticle item={item('news.contract.upsellFailed', { customer: 'kryptonitt' })} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: /no budget at kryptonitt/i })).toBeInTheDocument()
  })
})
