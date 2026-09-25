/**
 * Names on the leaderboard are put together from these words ("Elg & Regneark AS"), never typed, so they
 * need no moderation and nothing the player wrote leaves the device. Stored as ids, shown in the viewer's
 * language (`content:leaderboardNames.*`). Two nouns and a suffix, so no adjective has to agree with a gender.
 */
export const NAME_NOUNS = [
  'moose',
  'spreadsheet',
  'coffee',
  'herring',
  'viking',
  'llama',
  'owl',
  'intern',
  'ferry',
  'sprint',
  'slide',
  'unicorn',
  'waffle',
  'fjord',
  'troll',
  'invoice',
  'standup',
  'backlog',
  'sofa',
  'puffin',
  'cloud',
  'bunad',
  'brunost',
  'sauna',
] as const

export const NAME_SUFFIXES = ['as', 'group', 'partners', 'labs', 'consulting', 'holding'] as const

export type NameNoun = (typeof NAME_NOUNS)[number]
export type NameSuffix = (typeof NAME_SUFFIXES)[number]
/** [first noun, second noun, suffix]. */
export type LeaderboardName = [NameNoun, NameNoun, NameSuffix]

export function isLeaderboardName(x: unknown): x is LeaderboardName {
  return (
    Array.isArray(x) &&
    x.length === 3 &&
    (NAME_NOUNS as readonly unknown[]).includes(x[0]) &&
    (NAME_NOUNS as readonly unknown[]).includes(x[1]) &&
    x[0] !== x[1] &&
    (NAME_SUFFIXES as readonly unknown[]).includes(x[2])
  )
}
