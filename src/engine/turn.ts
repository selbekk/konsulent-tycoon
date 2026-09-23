import { planAiTurn } from './ai/planner'
import { yearEndAwards } from './awards'
import { BANKRUPT_AFTER_QUARTERS, CREDIT_INTEREST, HISTORY_LENGTH } from './constants'
import { expireContracts, rollCallOffs, updateContracts } from './contracts'
import { updateCulture } from './culture'
import { creditLimit, headcount, quarterFinancials } from './economy'
import { autoResolveEvents, drawEvents } from './events'
import { pickAnnouncement } from './flavor'
import { updateTrends } from './market'
import { applyActionInPlace } from './reducer'
import { valuation } from './score'
import { decayHeatAndIntel, rollShadyDetection } from './shady'
import { applyTurnover, processHiring, updateMorale } from './staff'
import { refreshStarMarket, updateStars } from './stars'
import { publishTenders, resolveDueTenders, retenderContracts } from './tenders'
import type { GameState } from './types'
import { addNews, aiFirms, activeFirms } from './util'

export function runAiTurns(state: GameState) {
  for (const firm of aiFirms(state)) {
    for (const action of planAiTurn(state, firm.id)) applyActionInPlace(state, action)
  }
}

function runFirmQuarter(state: GameState) {
  for (const firm of activeFirms(state)) {
    firm.quarterFines = 0
    const fin = quarterFinancials(state, firm.id)
    firm.cash += fin.ebitda
    const interest = firm.cash < 0 ? -firm.cash * CREDIT_INTEREST : 0
    firm.cash -= interest
    updateContracts(state, firm, fin.staffing)
    const hc = headcount(firm)
    updateCulture(firm)
    updateMorale(firm, fin.utilization)
    updateStars(state, firm, fin.utilization, hc)
    applyTurnover(state, firm)
    processHiring(state, firm)
    firm.history.push({
      quarter: state.quarter,
      revenue: fin.revenue,
      costs: fin.total,
      ebitda: fin.ebitda,
      headcount: hc,
      utilization: fin.utilization,
      hires: firm.quarterHires,
      leavers: firm.quarterLeavers,
      fines: 0,
    })
    if (firm.history.length > HISTORY_LENGTH) firm.history.shift()
    firm.quarterHires = 0
    firm.quarterLeavers = 0
  }
}

function checkBankruptcies(state: GameState) {
  for (const firm of activeFirms(state)) {
    firm.negativeCashQuarters = firm.cash < -creditLimit(firm) ? firm.negativeCashQuarters + 1 : 0
    if (firm.isPlayer && firm.negativeCashQuarters === 1) {
      addNews(state, 'news.firm.bankWarning', {}, 'bad', { firmId: firm.id, personal: true })
    }
    if (firm.negativeCashQuarters >= BANKRUPT_AFTER_QUARTERS) {
      firm.bankrupt = true
      const live = state.contracts.filter((c) => c.firmId === firm.id && !c.terminated && c.endQuarter > state.quarter + 1)
      for (const c of state.contracts) if (c.firmId === firm.id) c.terminated = true
      retenderContracts(state, live, state.quarter + 1)
      for (const t of state.tenders) t.bids = t.bids.filter((b) => b.firmId !== firm.id)
      addNews(state, firm.isPlayer ? 'news.firm.playerBankrupt' : 'news.firm.bankrupt', { firm: firm.name }, 'sassy', {
        firmId: firm.id,
        personal: firm.isPlayer,
      })
    }
  }
}

/**
 * Advances the game by one quarter. Pure: returns a new state.
 * Order matters – see docs/plans for the pipeline description.
 */
export function endTurn(input: GameState): GameState {
  if (input.status !== 'playing') return input
  const state = structuredClone(input)
  autoResolveEvents(state)

  runAiTurns(state)
  runFirmQuarter(state)
  rollShadyDetection(state)
  decayHeatAndIntel(state)
  // Fines from this quarter's scandals end up in the report.
  for (const f of activeFirms(state)) {
    const last = f.history[f.history.length - 1]
    if (last && last.quarter === state.quarter) last.fines = f.quarterFines
  }

  resolveDueTenders(state)
  const next = state.quarter + 1
  expireContracts(state, next)
  rollCallOffs(state, next)
  updateTrends(state, next)
  publishTenders(state, next)
  if (state.quarter % 4 === 3) yearEndAwards(state)
  else state.lastAwards = []

  checkBankruptcies(state)
  for (const f of Object.values(state.firms)) f.valuationHistory.push(valuation(f))

  state.quarter = next
  const player = state.firms[state.playerId]
  if (player.bankrupt) {
    state.status = 'lost'
    return state
  }
  if (state.quarter >= state.maxQuarters) {
    state.status = 'finished'
    return state
  }
  refreshStarMarket(state)
  drawEvents(state)
  pickAnnouncement(state)
  return state
}
