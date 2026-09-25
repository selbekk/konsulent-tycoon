import { describe, expect, it } from 'vitest'
import { CRISES, EXPOSED_STAGE } from '../content/crises'
import { CRISIS_TALKS, CRISIS_TALK_QUESTIONS, TALK_STYLES } from '../content/crisisTalks'
import { EVENTS } from '../content/events'
import { ANNOUNCEMENTS } from '../content/announcements'
import { THOUGHTS } from '../content/thoughts'
import { FIRMS } from '../content/firms'
import { CUSTOMERS, CUSTOMER_METRICS } from '../content/customers'
import { TRENDS } from '../content/trends'
import { TRAITS } from '../content/traits'
import { QUIRKS } from '../content/quirks'
import { articleVariants } from '../content/articles'
import { BUZZWORDS } from '../content/buzzwords'
import { MEETING_QUESTIONS, MEETING_STYLES } from '../content/meetingQuestions'
import { MISSIONS } from '../content/missions'
import { MILESTONES } from '../content/milestones'
import { GOSSIP } from '../content/gossip'
import { DEPARTMENTS, PARTNERSHIPS } from '../content/strategy'
import { SHADY_IDS } from '../engine/shady'
import { AWARDS } from '../engine/awards'
import { DISCIPLINES } from '../engine/types'
import { FEATURE_LEVEL } from '../engine/constants'
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
    for (const c of CRISES) {
      check(game, `crises.${c.id}.title`)
      check(game, c.scope === 'market' ? `crises.${c.id}.news` : `crises.${c.id}.gossip`)
      for (const st of c.stages) {
        if (st.route) continue
        if (st.reveals) for (const sev of ['low', 'high']) check(game, `crises.${c.id}.${st.id}.body.${sev}`)
        else check(game, `crises.${c.id}.${st.id}.body`)
        for (const ch of st.choices) check(game, `crises.${c.id}.${st.id}.choices.${ch.id}`)
      }
      check(ui, `crisis.categories.${c.category}`)
    }
    check(game, `crises.${EXPOSED_STAGE.id}.body`)
    for (const ch of EXPOSED_STAGE.choices) check(game, `crises.${EXPOSED_STAGE.id}.choices.${ch.id}`)
    for (const a of ANNOUNCEMENTS) check(game, `announcements.${a.id}`)
    for (const th of THOUGHTS) for (let v = 1; v <= th.variants; v++) check(game, `thoughts.${th.id}.${v}`)
    for (const m of MISSIONS) check(content, `missions.${m.id}.name`)
    for (const m of MILESTONES) {
      check(content, `milestones.${m.id}.name`)
      check(content, `milestones.${m.id}.desc`)
      check(game, `news.milestone.${m.id}`)
    }
    for (const g of GOSSIP) check(game, `news.gossip.${g.id}`)
    for (const p of PARTNERSHIPS) check(content, `partnerships.${p.id}.name`)
    for (const d of DEPARTMENTS) check(content, `departments.${d.id}.name`)
    for (const f of FIRMS) check(content, `firms.${f.id}.tagline`)
    for (const c of CUSTOMERS) {
      check(content, `customers.${c.id}.name`)
      check(content, `customers.${c.id}.blurb`)
      check(content, `customers.${c.id}.about`)
    }
    for (const m of [...CUSTOMER_METRICS, 'priceFocus', 'budget']) check(ui, `customer.metrics.${m}.label`)
    for (const t of TRENDS) check(content, `trends.${t.id}.name`)
    for (const t of TRAITS) check(content, `traits.${t.id}.name`)
    for (const q of QUIRKS) {
      check(content, `quirks.${q.id}.name`)
      check(content, `quirks.${q.id}.desc`)
    }
    for (const s of SHADY_IDS) {
      check(content, `shady.actions.${s}.name`)
      check(game, `news.scandal.${s}`)
    }
    for (const a of AWARDS) {
      check(content, `awards.${a.id}`)
      check(game, `news.award.${a.id}`)
    }
    for (const d of DISCIPLINES) check(ui, `disciplines.${d}`)
    for (const f of Object.keys(FEATURE_LEVEL)) {
      check(ui, `level.features.${f}`)
      check(ui, `onboarding.features.${f}`)
    }
    for (const b of BUZZWORDS) check(mg, `buzzwords.${b}`)
    for (const st of TALK_STYLES) check(mg, `crisisTalk.learned.${st}`)
    for (const k of CRISIS_TALKS) {
      check(mg, `crisisTalk.${k}.title`)
      check(mg, `crisisTalk.${k}.intro`)
      check(ui, `crisis.talk.${k}`)
      for (const st of TALK_STYLES) check(mg, `crisisTalk.${k}.clues.${st}`)
      for (const q of CRISIS_TALK_QUESTIONS[k]) {
        check(mg, `crisisTalk.${k}.questions.${q}.q`)
        for (const a of TALK_STYLES) check(mg, `crisisTalk.${k}.questions.${q}.a.${a}`)
      }
    }
    for (const q of MEETING_QUESTIONS) for (const s of MEETING_STYLES) check(mg, `meeting.questions.${q}.a.${s}`)
    expect(missing).toEqual([])
  })

  it('every news line has a story behind it', () => {
    const game = resources.nb.game as Tree
    const news = keys(game.news as Tree, 'news.').map((k) => k.replace(/_(one|other)$/, ''))
    const crisisNews = CRISES.map((c) => `crises.${c.id}.${c.scope === 'market' ? 'news' : 'gossip'}`)
    const missing: string[] = []
    for (const key of new Set([...news, ...crisisNews])) {
      for (let v = 1; v <= articleVariants(key); v++) {
        const base = `articles.${key.replace(/^news\./, '')}.${v}`
        if (!has(game, `${base}.headline`)) missing.push(`${base}.headline`)
        if (!has(game, `${base}.body`) && !has(game, `${base}.body_one`)) missing.push(`${base}.body`)
      }
    }
    expect(missing).toEqual([])
  })
})
