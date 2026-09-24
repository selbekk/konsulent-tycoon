import type { CrisisMinigame } from '../engine/types'

/**
 * Crisis talks: three questions from the press, your own people or the client. Every question has
 * one answer per style. Each audience secretly prefers one style and hates its opposite; the intro
 * gives a clue and the reactions tell you the rest. Texts: `minigames:crisisTalk.<kind>.questions.<id>.a.<style>`.
 */
export type TalkStyle = 'candid' | 'caring' | 'facts' | 'spin'
export const TALK_STYLES = ['candid', 'caring', 'facts', 'spin'] as const satisfies readonly TalkStyle[]

export const OPPOSITE_TALK_STYLE: Record<TalkStyle, TalkStyle> = { candid: 'spin', spin: 'candid', caring: 'facts', facts: 'caring' }

export const CRISIS_TALK_QUESTIONS: Record<CrisisMinigame, readonly string[]> = {
  press: ['who_knew', 'responsible', 'again', 'affected', 'resign'],
  townhall: ['why_now', 'safe', 'bonus', 'trust', 'next'],
  client: ['what_happened', 'fix', 'money', 'again', 'trust'],
}

export const CRISIS_TALKS = Object.keys(CRISIS_TALK_QUESTIONS) as CrisisMinigame[]
