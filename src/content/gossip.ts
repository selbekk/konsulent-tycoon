/**
 * Industry gossip for the news ticker: small, harmless stories so the ticker is more than tender
 * results. Text in `game:news.gossip.<id>`, with a story in `game:articles.gossip.<id>.1`.
 *
 * `subject` says which params the engine fills in:
 * - `none`: no params
 * - `firm`: `firm`, a random AI firm
 * - `twoFirms`: `firm` and `other`, two different AI firms
 * - `customer`: `customer`, a customer id
 * - `trend`: `trend`, a trend running right now (skipped if there is none)
 * - `biggest`: `firm`, the AI firm with the most people
 * - `topWinner`: `firm`, the AI firm with the most tenders won
 * - `bankrupt`: `firm`, an AI firm that went bankrupt in the last year (skipped if none did)
 */
export type GossipSubject = 'none' | 'firm' | 'twoFirms' | 'customer' | 'trend' | 'biggest' | 'topWinner' | 'bankrupt'

export interface GossipDef {
  id: string
  subject: GossipSubject
  /** Only in this quarter of the year (0 = Q1). */
  season?: 0 | 1 | 2 | 3
  weight?: number
}

export const GOSSIP: GossipDef[] = [
  { id: 'foosball_final', subject: 'firm' },
  { id: 'rebrand', subject: 'firm' },
  { id: 'hackathon', subject: 'firm' },
  { id: 'standing_desks', subject: 'firm' },
  { id: 'podcast', subject: 'firm' },
  { id: 'band', subject: 'firm' },
  { id: 'offsite', subject: 'firm' },
  { id: 'sourdough', subject: 'firm' },
  { id: 'slack_emoji', subject: 'firm' },
  { id: 'linkedin_marathon', subject: 'firm' },
  { id: 'office_dog', subject: 'firm' },
  { id: 'ai_assistant', subject: 'firm' },
  { id: 'bike_to_work', subject: 'firm' },
  { id: 'coffee_war', subject: 'twoFirms' },
  { id: 'table_tennis', subject: 'twoFirms' },
  { id: 'billboard', subject: 'twoFirms' },
  { id: 'innovation_lab', subject: 'customer' },
  { id: 'canteen', subject: 'customer' },
  { id: 'reorg', subject: 'customer' },
  { id: 'procurement_form', subject: 'customer' },
  { id: 'trend_conference', subject: 'trend', weight: 1.5 },
  { id: 'summer_party', subject: 'biggest' },
  { id: 'champagne', subject: 'topWinner' },
  { id: 'bankrupt_auction', subject: 'bankrupt', weight: 3 },
  { id: 'timesheets', subject: 'none' },
  { id: 'quiet_quarter', subject: 'none' },
  { id: 'ski_season', subject: 'none', season: 0, weight: 2 },
  { id: 'may_parade', subject: 'firm', season: 1, weight: 2 },
  { id: 'summer_holiday', subject: 'none', season: 2, weight: 2 },
  { id: 'julebord', subject: 'firm', season: 3, weight: 2 },
]
