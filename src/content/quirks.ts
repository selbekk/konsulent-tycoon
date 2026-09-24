/**
 * Small personal quirks for ordinary employees. Mostly colour; a few nudge growth or potential.
 * `becomesTrait` is the star trait they grow into when promoted (content/traits.ts).
 * Texts: content:quirks.<id>.name / .desc.
 */
export interface QuirkDef {
  id: string
  /** Multiplies every development gain. */
  growth?: number
  /** Added to the potential draw (0–1). */
  potential?: number
  /** Shown morale offset in the profile. Display only. */
  mood?: number
  becomesTrait?: string
}

export const QUIRKS: QuirkDef[] = [
  { id: 'fagdag_speaker', growth: 1.1, becomesTrait: 'conference_speaker' },
  { id: 'docs_volunteer', becomesTrait: 'tech_debt_hunter' },
  { id: 'coffee_nerd', mood: 2, becomesTrait: 'kaffesnobb' },
  { id: 'linkedin_daily', becomesTrait: 'linkedin_influencer' },
  { id: 'cert_hoarder', growth: 1.15, becomesTrait: 'certification_collector' },
  { id: 'explains_well', becomesTrait: 'mentor' },
  { id: 'client_whisperer', becomesTrait: 'sjefsdiplomat' },
  { id: 'slack_emoji', mood: 3, becomesTrait: 'slack_poet' },
  { id: 'never_offline', growth: 1.1, mood: -3, becomesTrait: 'workaholic' },
  { id: 'home_office', mood: -1, becomesTrait: 'remote_hardliner' },
  { id: 'rewrites_everything', potential: 0.05, becomesTrait: 'tenx_ego' },
  { id: 'been_here_forever', growth: 0.9, becomesTrait: 'loyal_as_a_dog' },
  { id: 'raspberry_pi', growth: 1.1 },
  { id: 'vim_user' },
  { id: 'cake_baker', mood: 3 },
  { id: 'dark_mode' },
  { id: 'side_projects', potential: 0.05 },
  { id: 'standup_novelist', mood: -1 },
  { id: 'quiet_genius', growth: 1.1, potential: 0.1 },
  { id: 'focus_time' },
  { id: 'jira_poet' },
  { id: 'board_gamer', mood: 2 },
  { id: 'runs_to_work' },
  { id: 'hobby_scrum_master' },
  { id: 'loud_keyboard', mood: -1 },
  { id: 'framework_hopper', growth: 1.15, potential: 0.05 },
  { id: 'excel_wizard' },
  { id: 'plant_parent', mood: 1 },
  { id: 'five_whys', growth: 1.05 },
  { id: 'late_bloomer', growth: 1.2 },
]

export const QUIRK_MAP: Record<string, QuirkDef> = Object.fromEntries(QUIRKS.map((q) => [q.id, q]))
