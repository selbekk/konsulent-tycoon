import { describe, expect, it } from 'vitest'
import { isoWeek, weekBounds, weekOpen, weekSeed } from './weekly'

describe('weekly challenge', () => {
  it('finds the ISO week in UTC, across year boundaries', () => {
    expect(isoWeek(Date.UTC(2026, 8, 25))).toBe('2026-W39')
    expect(isoWeek(Date.UTC(2026, 8, 21, 0, 0))).toBe('2026-W39') // Monday
    expect(isoWeek(Date.UTC(2026, 8, 20, 23, 59))).toBe('2026-W38') // Sunday
    expect(isoWeek(Date.UTC(2027, 0, 1))).toBe('2026-W53')
    expect(isoWeek(Date.UTC(2024, 11, 30))).toBe('2025-W01')
  })

  it('gives each week its Monday-to-Monday bounds', () => {
    expect(weekBounds('2026-W39')).toEqual({ start: Date.UTC(2026, 8, 21), end: Date.UTC(2026, 8, 28) })
    expect(weekBounds('2025-W01')!.start).toBe(Date.UTC(2024, 11, 30))
    expect(weekBounds('2026-W53')!.start).toBe(Date.UTC(2026, 11, 28))
    for (const bad of ['2025-W53', '2026-W00', '2026-39', 'W39', '']) expect(weekBounds(bad)).toBeNull()
  })

  it('has a stable seed per week', () => {
    expect(weekSeed('2026-W39')).toBe(weekSeed('2026-W39'))
    expect(weekSeed('2026-W39')).not.toBe(weekSeed('2026-W40'))
  })

  it('is open during the week and a few days after', () => {
    expect(weekOpen('2026-W39', Date.UTC(2026, 8, 20))).toBe(false)
    expect(weekOpen('2026-W39', Date.UTC(2026, 8, 21))).toBe(true)
    expect(weekOpen('2026-W39', Date.UTC(2026, 8, 30, 23))).toBe(true)
    expect(weekOpen('2026-W39', Date.UTC(2026, 9, 1))).toBe(false)
    expect(weekOpen('nonsense', Date.UTC(2026, 8, 25))).toBe(false)
  })
})
