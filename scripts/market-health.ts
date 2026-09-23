/* AI-only market health over 40 quarters: npm run sim:market -- 20 [-v] */
import { createNewGame } from '../src/engine/newGame'
import { endTurn } from '../src/engine/turn'
import { isActive, quarterFinancials } from '../src/engine/economy'
import { seatTotal } from '../src/engine/util'
import { marketCapacity } from '../src/engine/tenders'
const seeds = Number(process.argv[2] ?? 10)
const verbose = process.argv.includes('-v')
const deaths: Record<string, number> = {}
const ratios: number[][] = []
let totalDeaths = 0
for (let seed = 1; seed <= seeds; seed++) {
  let s = createNewGame({ seed, firmName: 'X', founderDisciplines: ['backend', 'frontend'], difficulty: 'normal' })
  s.firms.player.bankrupt = true // AI-only market
  for (let q = 0; q < 40; q++) {
    const cap = marketCapacity(s)
    const active = s.contracts.filter((c) => isActive(c, s.quarter)).reduce((a, c) => a + seatTotal(c.activeSeats), 0)
    ;(ratios[q] ??= []).push(active / cap)
    if (verbose && seed === 1 && q % 4 === 0) {
      const firms = s.firmOrder.map((id) => s.firms[id]).filter((f) => !f.bankrupt)
      const u = firms.map((f) => quarterFinancials(s, f.id).utilization).sort((a, b) => a - b)
      console.log(`Q${q} firms ${firms.length} cap ${cap} active ${active} ratio ${(active / cap).toFixed(2)} util p10 ${u[Math.floor(u.length * 0.1)]?.toFixed(2)} med ${u[Math.floor(u.length / 2)]?.toFixed(2)}`)
    }
    s = { ...endTurn({ ...s, status: 'playing' }), status: 'playing' }
  }
  for (const f of Object.values(s.firms)) if (!f.isPlayer && f.bankrupt) { deaths[f.id] = (deaths[f.id] ?? 0) + 1; totalDeaths++ }
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log('ratio by year:', ratios.filter((_, i) => i % 4 === 0).map((r) => med(r).toFixed(2)).join(' '))
console.log(`deaths/game ${(totalDeaths / seeds).toFixed(1)}`, Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '))
