/* Headless balance simulator: npm run sim -- --games 50 --strategy balanced --seed 1 [--json] */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PLAYER_BOTS } from '../src/engine/ai/personalities'
import { planAiTurn, planEventAnswers } from '../src/engine/ai/planner'
import { averageMorale, headcount, quarterFinancials } from '../src/engine/economy'
import { createNewGame } from '../src/engine/newGame'
import { applyActionInPlace } from '../src/engine/reducer'
import { playerRank, rankings } from '../src/engine/score'
import { committedDemand, marketCapacity } from '../src/engine/tenders'
import { endTurn } from '../src/engine/turn'
import type { Difficulty, GameState } from '../src/engine/types'

const args = process.argv.slice(2)
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const games = Number(arg('games', '30'))
const strategies = arg('strategy', 'all') === 'all' ? Object.keys(PLAYER_BOTS) : arg('strategy', 'balanced').split(',')
const baseSeed = Number(arg('seed', '1'))
const difficulty = arg('difficulty', 'normal') as Difficulty
const asJson = args.includes('--json')

interface Sample { cash: number; hc: number; revenue: number; morale: number; rep: number; demandRatio: number; heat: number }

function playGame(seed: number, strategy: string) {
  let state: GameState = createNewGame({ seed, firmName: 'Sim AS', founderDisciplines: ['backend', 'frontend'], difficulty })
  const samples: Sample[] = []
  while (state.status === 'playing') {
    const draft = structuredClone(state)
    if (strategy !== 'idle') {
      for (const a of planEventAnswers(draft, draft.playerId)) applyActionInPlace(draft, a)
      for (const a of planAiTurn(draft, draft.playerId, PLAYER_BOTS[strategy])) applyActionInPlace(draft, a)
    }
    const me = draft.firms[draft.playerId]
    const fin = quarterFinancials(draft, me.id)
    samples.push({
      cash: me.cash,
      hc: headcount(me),
      revenue: fin.revenue,
      morale: averageMorale(me),
      rep: me.reputation,
      heat: me.heat,
      demandRatio: committedDemand(draft, draft.quarter) / Math.max(1, marketCapacity(draft)),
    })
    state = endTurn(draft)
  }
  const ranks = rankings(state)
  const aiBankrupt = Object.values(state.firms).filter((f) => !f.isPlayer && f.bankrupt).map((f) => f.id)
  return {
    samples,
    status: state.status,
    bankruptAt: state.status === 'lost' ? state.quarter : null,
    rank: playerRank(state),
    value: ranks.find((r) => r.firmId === state.playerId)!.value,
    top: ranks.slice(0, 3).map((r) => r.firmId),
    aiBankrupt,
    shady: state.firms[state.playerId].shadyLog.length,
    caught: state.firms[state.playerId].shadyLog.filter((e) => e.detected).length,
  }
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN
}
const m = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`)

const out: Record<string, unknown> = {}
const t0 = Date.now()
for (const strategy of strategies) {
  const results = Array.from({ length: games }, (_, i) => playGame(baseSeed + i, strategy))
  out[strategy] = results
  console.log(`\n=== ${strategy} (${games} games, ${difficulty}) ===`)
  console.log('Q   cash p10/med/p90          hc med  rev med  morale  rep  heat  demand/cap')
  for (let q = 0; q < 40; q += 4) {
    const at = results.map((r) => r.samples[q]).filter(Boolean)
    if (!at.length) break
    const col = (k: keyof Sample) => at.map((s) => s[k])
    console.log(
      `${String(q).padEnd(3)} ${m(pct(col('cash'), 0.1)).padStart(7)} ${m(pct(col('cash'), 0.5)).padStart(7)} ${m(pct(col('cash'), 0.9)).padStart(7)}   ` +
        `${String(pct(col('hc'), 0.5)).padStart(6)} ${m(pct(col('revenue'), 0.5)).padStart(8)} ${pct(col('morale'), 0.5).toFixed(0).padStart(7)} ` +
        `${pct(col('rep'), 0.5).toFixed(0).padStart(4)} ${pct(col('heat'), 0.5).toFixed(0).padStart(5)}  ${pct(col('demandRatio'), 0.5).toFixed(2).padStart(6)}`,
    )
  }
  const bankrupt = results.filter((r) => r.status === 'lost')
  console.log(`bankrupt: ${bankrupt.length}/${games} (median quarter ${pct(bankrupt.map((r) => r.bankruptAt!), 0.5)})`)
  console.log(`rank p10/med/p90: ${pct(results.map((r) => r.rank), 0.1)} / ${pct(results.map((r) => r.rank), 0.5)} / ${pct(results.map((r) => r.rank), 0.9)}`)
  console.log(`value median: ${m(pct(results.map((r) => r.value), 0.5))}, p90: ${m(pct(results.map((r) => r.value), 0.9))}`)
  if (strategy === 'shady') console.log(`shady actions median: ${pct(results.map((r) => r.shady), 0.5)}, caught: ${pct(results.map((r) => r.caught), 0.5)}`)
  const aiB: Record<string, number> = {}
  for (const r of results) for (const id of r.aiBankrupt) aiB[id] = (aiB[id] ?? 0) + 1
  console.log(`AI bankruptcies: ${Object.entries(aiB).map(([k, v]) => `${k}:${v}`).join(' ') || 'none'}`)
  const winners: Record<string, number> = {}
  for (const r of results) winners[r.top[0]] = (winners[r.top[0]] ?? 0) + 1
  console.log(`winners: ${Object.entries(winners).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')}`)
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (asJson) {
  mkdirSync('sim-output', { recursive: true })
  writeFileSync(`sim-output/sim-${Date.now()}.json`, JSON.stringify(out))
}
