import { createNewGame } from './newGame'
import type { GameState } from './types'

export const newTestGame = (seed = 42): GameState =>
  createNewGame({ seed, firmName: 'Test AS', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v)
  }
  return o
}
