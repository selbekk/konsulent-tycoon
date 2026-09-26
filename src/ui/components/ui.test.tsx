// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import '../../i18n'
import { Button, Meter, Modal, Stepper } from './ui'

afterEach(cleanup)

function Harness({ onRender }: { onRender?: () => void }) {
  const [n, setN] = useState(0)
  const [phase, setPhase] = useState<'a' | 'b'>('a')
  onRender?.()
  return (
    <>
      <button type="button">Outside</button>
      {/* An inline onClose, like most callers pass. */}
      <Modal title="Dialog" onClose={() => {}}>
        <button type="button" onClick={() => setN(n + 1)}>
          Count {n}
        </button>
        {phase === 'a' ? (
          <button type="button" onClick={() => setPhase('b')}>
            Last
          </button>
        ) : (
          <p>Done</p>
        )}
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('keeps Tab and Shift+Tab inside the dialog', () => {
    render(<Harness />)
    const close = screen.getByRole('button', { name: /close|lukk/i })
    const last = screen.getByRole('button', { name: 'Last' })
    expect(document.activeElement).toBe(close)

    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    // Focus that somehow got outside is pulled back in.
    screen.getByRole('button', { name: 'Outside' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('does not move focus when the parent re-renders', () => {
    render(<Harness />)
    const count = screen.getByRole('button', { name: /count/i })
    count.focus()
    fireEvent.click(count)
    expect(screen.getByRole('button', { name: 'Count 1' })).toBe(document.activeElement)
  })

  it('focuses the dialog when the focused button disappears', () => {
    render(<Harness />)
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.click(last)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  it('gives focus back when it closes', () => {
    function Opener() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          {open && (
            <Modal title="Dialog" onClose={() => setOpen(false)}>
              <p>Hi</p>
            </Modal>
          )}
        </>
      )
    }
    render(<Opener />)
    const open = screen.getByRole('button', { name: 'Open' })
    open.focus()
    fireEvent.click(open)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(open)
  })
})

describe('labels', () => {
  it('names the stepper buttons after what they change', () => {
    render(<Stepper label="Seats" value={2} onChange={() => {}} />)
    expect(screen.getAllByRole('button', { name: /seats/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument()
  })

  it('names a meter from its visible label or an explicit name', () => {
    render(
      <>
        <Meter label={<b>Morale</b>} value={50} />
        <Meter label="" name="Customer satisfaction" value={70} />
      </>,
    )
    expect(screen.getByRole('meter', { name: 'Morale' })).toBeTruthy()
    expect(screen.getByRole('meter', { name: 'Customer satisfaction' })).toBeTruthy()
  })
})
