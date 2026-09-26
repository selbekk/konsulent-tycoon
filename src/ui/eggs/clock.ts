/**
 * The real-world clock for the easter eggs (night office, Christmas). UI only: the engine never looks at the
 * time. Tests pin `clock.now` in `src/test/setup.ts` so they don't change behaviour at 3 a.m. or in December.
 */
export const clock = { now: () => Date.now() }

/** Midnight to five in the morning, local time. */
export function isNight(ms = clock.now()) {
  return new Date(ms).getHours() < 5
}

/** The first of December up to and including Boxing Day, local time. */
export function isChristmas(ms = clock.now()) {
  const d = new Date(ms)
  return d.getMonth() === 11 && d.getDate() <= 26
}

/** Christmas decorations: December, or a weekly challenge from the last weeks of the year. */
export function isChristmasSeason(weeklyWeek?: string, ms = clock.now()) {
  return isChristmas(ms) || /-W5[1-3]$/.test(weeklyWeek ?? '')
}
