// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isKeyTender, openTenders, quickBid, tenderLock } from '../../engine'
import { makeKeyTender } from '../../engine/testUtils'
import i18n from '../../i18n'
import { useGame } from '../../store/gameStore'
import { BidForm } from './BidForm'
import { bidChance } from './bidChance'
import { TenderBoard } from './TenderBoard'

const game = () => useGame.getState().game!
const biddable = () => openTenders(game()).filter((t) => !tenderLock(game().firms.player, t))

describe('bids on key and routine tenders', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
    useGame.getState().quit()
    useGame.getState().newGame({ seed: 5, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
  })

  afterEach(cleanup)

  it('key tenders show the customer needs and take a promise', () => {
    const tender = makeKeyTender(biddable()[0])
    render(<BidForm tenderId={tender.id} />)
    expect(screen.getByRole('heading', { name: /what the customer needs/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /the whole team is ready/i }))
    fireEvent.click(screen.getByRole('button', { name: /^place bid$/i }))
    expect(game().tenders.find((t) => t.id === tender.id)!.bids.find((b) => b.firmId === 'player')?.promise).toBe('fullTeam')
  })

  it('routine tenders have no meeting or promise', () => {
    const tender = biddable().find((t) => !isKeyTender(t))!
    render(<BidForm tenderId={tender.id} />)
    expect(screen.getByText(/routine job/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pitch meeting/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('sends a standard offer on a routine tender with one click, unless it would be turned down', () => {
    const routine = biddable().filter((t) => !isKeyTender(t))
    const weak = (id: string) => bidChance(game(), quickBid(game(), 'player', game().tenders.find((t) => t.id === id)!), game().tenders.find((t) => t.id === id)!).tooWeak
    expect(routine.some((t) => weak(t.id))).toBe(true)
    expect(routine.some((t) => !weak(t.id))).toBe(true)
    render(<TenderBoard />)
    const cards = screen.getAllByRole('article').filter((a) => within(a).queryByRole('button', { name: /send standard offer/i }))
    const buttons = cards.map((a) => within(a).getByRole('button', { name: /send standard offer/i }))
    expect(buttons.some((b) => b.hasAttribute('disabled'))).toBe(true)
    fireEvent.click(buttons.find((b) => !b.hasAttribute('disabled'))!)
    const placed = game().tenders.filter((t) => t.bids.some((b) => b.firmId === 'player'))
    expect(placed).toHaveLength(1)
    expect(isKeyTender(placed[0])).toBe(false)
    expect(weak(placed[0].id)).toBe(false)
  })
})
