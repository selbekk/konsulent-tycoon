import type { EventCtx } from './events'

export interface AnnouncementDef {
  id: string
  weight: number
  condition?: (ctx: EventCtx) => boolean
  /** Uses a random star's first name as {{name}}. */
  needsStar?: boolean
}

export const ANNOUNCEMENTS: AnnouncementDef[] = [
  { id: 'mug_meeting_room', weight: 1, needsStar: true },
  { id: 'friday_beer_alcohol_free', weight: 1 },
  { id: 'fridge_cleanup', weight: 1 },
  { id: 'printer_on_fire', weight: 0.5 },
  { id: 'wifi_password', weight: 1 },
  { id: 'standup_standing', weight: 1 },
  { id: 'cake_in_kitchen', weight: 1 },
  { id: 'timesheet_reminder', weight: 1.5 },
  { id: 'lost_macbook_charger', weight: 1 },
  { id: 'fire_drill', weight: 0.7 },
  { id: 'parking_spot', weight: 0.8, needsStar: true },
  { id: 'jira_down', weight: 1 },
  { id: 'someone_microwaved_fish', weight: 1 },
  { id: 'meeting_room_hostage', weight: 1 },
  { id: 'sprint_retro_cake', weight: 0.8 },
  { id: 'dress_code', weight: 0.6 },
  { id: 'intern_lost', weight: 0.6 },
  { id: 'ceo_birthday', weight: 0.5 },
  { id: 'coffee_beans_out', weight: 1, condition: ({ firm }) => firm.sosialt < 40 },
  { id: 'fagdag_room', weight: 1, condition: ({ firm }) => firm.fagmiljo >= 50 },
  { id: 'kombucha_on_tap', weight: 1, condition: ({ firm }) => firm.sosialt >= 60 },
  { id: 'bench_reminder', weight: 2, condition: ({ utilization }) => utilization < 0.6 },
  { id: 'overtime_pizza', weight: 2, condition: ({ utilization }) => utilization > 0.95 },
  { id: 'compliance_tor', weight: 2, condition: ({ firm }) => firm.heat > 30 },
  { id: 'shredder_busy', weight: 2, condition: ({ firm }) => firm.heat > 50 },
  { id: 'journalists_in_lobby', weight: 1.5, condition: ({ firm }) => firm.heat > 60 },
  { id: 'morale_survey', weight: 2, condition: ({ morale }) => morale < 50 },
  { id: 'pingpong_final', weight: 1, condition: ({ firm }) => firm.sosialt >= 50 },
  { id: 'new_office_plants', weight: 1, condition: ({ headcount }) => headcount >= 20 },
  { id: 'elevator_pitch', weight: 1, condition: ({ headcount }) => headcount >= 50 },
  { id: 'small_office', weight: 1.5, condition: ({ headcount }) => headcount < 10 },
  { id: 'cash_low', weight: 2, condition: ({ firm }) => firm.cash < 1_000_000 },
]
