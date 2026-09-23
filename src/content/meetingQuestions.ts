import type { MeetingStyle } from '../engine/types'

/** Question ids. Each has four answers, one per style. Texts in minigames.meeting.questions.<id>. */
export const MEETING_QUESTIONS = [
  'continuity',
  'public_sector',
  'start_monday',
  'changes',
  'why_you',
  'price',
  'security',
  'team',
  'legacy',
  'ai',
] as const

export type MeetingQuestion = (typeof MEETING_QUESTIONS)[number]

export const MEETING_STYLES: MeetingStyle[] = ['concrete', 'visionary', 'humble', 'buzzword']

export const OPPOSITE_STYLE: Record<MeetingStyle, MeetingStyle> = {
  concrete: 'visionary',
  visionary: 'concrete',
  humble: 'buzzword',
  buzzword: 'humble',
}
