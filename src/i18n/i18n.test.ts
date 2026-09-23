import { describe, expect, it } from 'vitest'
import { EVENTS } from '../content/events'
import { ANNOUNCEMENTS } from '../content/announcements'
import { FIRMS } from '../content/firms'
import { CUSTOMERS } from '../content/customers'
import { TRENDS } from '../content/trends'
import { TRAITS } from '../content/traits'
import { BUZZWORDS } from '../content/buzzwords'
import { MEETING_QUESTIONS, MEETING_STYLES } from '../content/meetingQuestions'
import { MISSIONS } from '../content/missions'
import { PARTNERSHIPS } from '../content/strategy'
import { SHADY_IDS } from '../engine/shady'
import { AWARDS } from '../engine/awards'
import { DISCIPLINES } from '../engine/types'
import { resources } from './index'

type Tree = { [k: string]: string | string[] | Tree }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' || Array.isArray(v) ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  )
}

function has(tree: Tree, path: string): boolean {
  let cur: unknown = tree
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return false
    cur = (cur as Tree)[part]
  }
  return typeof cur === 'string' || Array.isArray(cur)
}

describe('i18n', () => {
  for (const ns of Object.keys(resources.nb) as (keyof typeof resources.nb)[]) {
    it(`nb and en have the same keys in ${ns}`, () => {
      const nb = keys(resources.nb[ns] as Tree).sort()
      const en = keys(resources.en[ns] as Tree).sort()
      expect(en).toEqual(nb)
    })
  }

  it('every content id has texts', () => {
    const game = resources.nb.game as Tree
    const content = resources.nb.content as Tree
    const ui = resources.nb.ui as Tree
    const mg = resources.nb.minigames as Tree
    const missing: string[] = []
    const check = (tree: Tree, path: string) => !has(tree, path) && missing.push(path)
    for (const e of EVENTS) {
      check(game, `events.${e.id}.title`)
      check(game, `events.${e.id}.body`)
      for (const c of e.choices) check(game, `events.${e.id}.choices.${c.id}`)
    }
    for (const a of ANNOUNCEMENTS) check(game, `announcements.${a.id}`)
    for (const m of MISSIONS) check(content, `missions.${m.id}.name`)
    for (const p of PARTNERSHIPS) check(content, `partnerships.${p.id}.name`)
    for (const f of FIRMS) check(content, `firms.${f.id}.tagline`)
    for (const c of CUSTOMERS) check(content, `customers.${c.id}.name`)
    for (const t of TRENDS) check(content, `trends.${t.id}.name`)
    for (const t of TRAITS) check(content, `traits.${t.id}.name`)
    for (const s of SHADY_IDS) {
      check(content, `shady.actions.${s}.name`)
      check(game, `news.scandal.${s}`)
    }
    for (const a of AWARDS) {
      check(content, `awards.${a.id}`)
      check(game, `news.award.${a.id}`)
    }
    for (const d of DISCIPLINES) check(ui, `disciplines.${d}`)
    for (const b of BUZZWORDS) check(mg, `buzzwords.${b}`)
    for (const q of MEETING_QUESTIONS) for (const s of MEETING_STYLES) check(mg, `meeting.questions.${q}.a.${s}`)
    expect(missing).toEqual([])
  })
})
