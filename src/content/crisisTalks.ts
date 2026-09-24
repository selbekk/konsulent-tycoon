import type { CrisisMinigame } from '../engine/types'

/**
 * Crisis talks: three questions from the press, your own people or the client. Every question has
 * one answer per style. Each audience secretly prefers one style and hates its opposite; the intro
 * gives a clue and the reactions tell you the rest. Texts: `minigames:crisisTalk.<kind>.questions.<id>.a.<style>`.
 */
export type TalkStyle = 'candid' | 'caring' | 'facts' | 'spin'
export const TALK_STYLES = ['candid', 'caring', 'facts', 'spin'] as const satisfies readonly TalkStyle[]

export const OPPOSITE_TALK_STYLE: Record<TalkStyle, TalkStyle> = { candid: 'spin', spin: 'candid', caring: 'facts', facts: 'caring' }

/** How likely each audience is to prefer each style. Spin rarely works, but sometimes it's all they want. */
export const TALK_PREFERENCE_WEIGHTS: Record<CrisisMinigame, Record<TalkStyle, number>> = {
  press: { candid: 3, facts: 2, caring: 1, spin: 0.4 },
  townhall: { caring: 3, candid: 2, facts: 1, spin: 0.3 },
  client: { facts: 3, candid: 2, caring: 1, spin: 0.6 },
}

export const CRISIS_TALK_QUESTIONS: Record<CrisisMinigame, readonly string[]> = {
  press: ['who_knew', 'responsible', 'again', 'affected', 'resign'],
  townhall: ['why_now', 'safe', 'bonus', 'trust', 'next'],
  client: ['what_happened', 'fix', 'money', 'again', 'trust'],
}

export const CRISIS_TALKS = Object.keys(CRISIS_TALK_QUESTIONS) as CrisisMinigame[]
