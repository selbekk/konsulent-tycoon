import type { TFunction } from 'i18next'
import type { Crisis, Params } from '../engine'

/** i18n prefix for a stage's texts; the shared "it came out" stage lives outside the crisis. */
export const stageKey = (c: Crisis, stage = c.stage) =>
  stage === 'exposed' ? 'game:crises.exposed' : `game:crises.${c.defId}.${stage}`

export function crisisTitle(c: Crisis, t: TFunction, params: Params) {
  return t(`game:crises.${c.defId}.title`, params)
}
