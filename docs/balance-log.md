# Balanseringslogg

Mål (AI-marked alene, 40 kvartaler): ≤ 2 konkurser per parti, ingen firma dør i > 30 % av seedene, realisert etterspørsel/kapasitet 0,75–0,85.
Mål: `npm run sim:market -- 20` (AI-marked) og `npm run sim` (med spillerbot).

| # | Endring | Konkurser/parti | Verst | Etterspørsel/kap. |
|---|---|---|---|---|
| 0 | Utgangspunkt | 12,9 | Sopp Steria 9/10 | 0,75–0,90 |
| 1 | Etterspørsel uavhengig av kapasitet + konkursfirmaers kontrakter på anbud igjen + AI trekker fra egne åpne bud | 10,8 | Itera Igjen 10/10 | 0,70–0,96 |
| 2 | AI byr i påvente av å ansette (30 % av egen kapasitet teller) | 8,2 | Kapp & Gjemini 10/10 | ~0,9 |
| 3 | AI foretrekker anbud i sin størrelse og unngår fulle anbud (andel seter uten bud falt fra ~55 % til ~10 %) | 4,6 | Sopp Steria 10/10 | 0,9–1,0 |
| 4 | Billige firma: pris 0,86–0,87, lønn under markedet (break-even 0,77 → 0,70) | 5,3 (20 seeds) | Itera Igjen 15/20 | 0,85–0,9 |
| 5 | Oppsigelse bare ved kort runway (for strengt, reversert delvis) | 7,2 | – | – |
| 6 | **Forlengelse**: fornøyde kunder (≥ 60) forlenger prosjekter 2–4 kvartaler | 3,3 | Itera Igjen 11/20 | 0,75–0,86 |
| 7 | Generalister pris 0,96, AI-startkontanter 650k per hode | 3,9 (støy) | – | ~0,83 |
| 8 | **Fleksbemanning**: benkede folk dekker manglende seter i andre fag (faktureres nivå 2,2) | 0,6 | Kantegne 4/20 | ~0,72 |
| 9 | Etterspørselsvekst 5 % per år | **0,4 (30 seeds)** | Itera Igjen 5/30 | ~0,75 |

Funn: De viktigste årsakene var strukturelle, ikke tallene. Etterspørselen fulgte kapasiteten ned (dødsspiral), AI-ene klumpet seg på de samme små anbudene, og fagområdene var for rigide.
