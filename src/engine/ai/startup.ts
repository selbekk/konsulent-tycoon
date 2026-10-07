import { STARTUP_LEADS } from '../constants'
import { creditLimit, headcount, quarterFinancials, staffFirm } from '../economy'
import { applyActionInPlace } from '../reducer'
import { offerChance, recruitBlock } from '../startup'
import type { Action, Candidate, GameState, LeadKind, RecruitMove } from '../types'
import { seatTotal } from '../util'

/** How keen the bot is on each kind of lead, before it looks at the rate. */
const LEAD_TASTE: Record<LeadKind, number> = { steady: 1, growth: 1.15, prestige: 1.05, insider: 1.2 }
/** The bot offers a job once interest is at least this. */
const OFFER_AT = 50
/** And stops recruiting when the money it is losing would run out within this many years. */
const MIN_RUNWAY = 1.5
/** Headcount the bot aims for before it stops hiring ahead of work (level 2 needs 9). */
const TARGET_HEADCOUNT = 10

function nextMove(c: Candidate): RecruitMove | undefined {
  if (!c.likesKnown && !c.tried.includes('coffee')) return 'coffee'
  if (c.likesKnown && !c.tried.includes(c.likes)) return c.likes
  return c.interest >= OFFER_AT ? 'offer' : undefined
}

/**
 * The "sensible human" in the co-working space: works its network first (coffee, then whatever the person likes,
 * then an offer), then takes the lead that suits it best for the people who are free. Plans on its own copy and
 * replays each step there, so it can see who said yes before it picks the lead. The offers draw from the roster
 * RNG in order, so the real run sees the same answers as long as the steps are applied in the same order.
 */
export function planStartup(input: GameState): Action[] {
  const state = structuredClone(input)
  const firmId = state.playerId
  const firm = state.firms[firmId]
  if (!firm.startup || firm.bankrupt) return []
  const actions: Action[] = []
  const act = (a: Action) => {
    if (!applyActionInPlace(state, a)) actions.push(a)
  }

  // Only a firm losing money worries about runway; freelancers on the leads make costs look scarier than they are.
  const tight = () => {
    const fin = quarterFinancials(state, firmId)
    return fin.ebitda < 0 && (firm.cash + creditLimit(firm) * 0.5) / Math.max(1, -fin.ebitda) < MIN_RUNWAY * 4
  }
  for (let guard = 0; guard < 20 && firm.startup.hours > 0; guard++) {
    if (tight() || headcount(firm) >= TARGET_HEADCOUNT) break
    const ranked = [...firm.startup.candidates].sort((a, b) => b.interest - a.interest)
    const pick = ranked
      .map((c) => ({ c, move: nextMove(c) }))
      .find(({ c, move }) => move && !recruitBlock(firm, c, move, state.quarter))
    if (!pick?.move) break
    // Don't bother offering to someone very unlikely to say yes.
    if (pick.move === 'offer' && offerChance(pick.c) < OFFER_AT / 100) break
    act({ type: 'recruit', firmId, candidateId: pick.c.person.id, move: pick.move })
  }

  const st = firm.startup
  // A lead is worth taking with free people, or with no work at all.
  const free = seatTotal(staffFirm(state, firm).idle)
  if (!st.takenLead && st.leads.length && free > 0) {
    const best = [...st.leads].sort(
      (a, b) =>
        LEAD_TASTE[b.kind] * STARTUP_LEADS[b.kind].rate * Math.min(b.duration, 4) -
        LEAD_TASTE[a.kind] * STARTUP_LEADS[a.kind].rate * Math.min(a.duration, 4),
    )[0]
    act({ type: 'takeLead', firmId, leadId: best.id })
  }
  return actions
}
