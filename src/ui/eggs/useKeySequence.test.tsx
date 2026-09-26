// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeySequence } from './useKeySequence'

function Probe({ seq, onMatch }: { seq: string | string[]; onMatch: () => void }) {
  useKeySequence(seq, onMatch)
  return <input aria-label="field" />
}

const press = (keys: string[], opts: object = {}, target: Window | Element = window) =>
  keys.forEach((key) => fireEvent.keyDown(target, { key, ...opts }))

describe('useKeySequence', () => {
  afterEach(cleanup)

  it('matches a typed word, case-insensitively, after other keys', () => {
    const hit = vi.fn()
    render(<Probe seq="bingo" onMatch={hit} />)
    press([...'xxBINgo'])
    expect(hit).toHaveBeenCalledTimes(1)
  })

  it('matches named keys like the Konami code', () => {
    const hit = vi.fn()
    render(<Probe seq={['ArrowUp', 'ArrowUp', 'ArrowDown', 'b', 'a']} onMatch={hit} />)
    press(['ArrowUp', 'ArrowUp', 'ArrowDown', 'b', 'a'])
    expect(hit).toHaveBeenCalledTimes(1)
  })

  it('ignores modifiers, auto-repeat, text fields and open dialogs', () => {
    const hit = vi.fn()
    const { getByLabelText, container } = render(<Probe seq="abc" onMatch={hit} />)
    press([...'abc'], { ctrlKey: true })
    press([...'abc'], { repeat: true })
    press([...'abc'], {}, getByLabelText('field'))
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    container.appendChild(dialog)
    press([...'abc'])
    expect(hit).not.toHaveBeenCalled()
  })
})
