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

## Spillersiden

Boten `human` (i `src/engine/ai/humanProxy.ts`) prøver å spille som et fornuftig menneske. Den byr bare der egne ledige folk dekker minst 50 %, priser rundt 0,95, spiller minispillene rundt 70, ansetter i små steg og nedbemanner ved to svake kvartaler. `humanPro` er den samme boten med pris 0,90 og minispill rundt 90.

| # | Endring | human konkurs | humanPro konkurs |
|---|---|---|---|
| 0 | Første versjon av boten | 30/30 | – |
| 1 | Boten byr bredere når den har lite å gjøre, og nedbemanner | 29/30 | – |
| 2 | Boten vokser bare når det er arbeid i sikte. Spilleren starter med omdømme 40, fagmiljø 35 og relasjon 25 | 26/30 | 18/30 |
| 3 | Boten svarer på hendelser som et forsiktig menneske (ikke det dyreste valget), og UI-et fremhever ikke lenger første valg | 15/30 | 7/30 |
| 4 | Ledige folk fra andre fagområder teller i kapasitetsstraffen (FLEX_AVAILABILITY 0,5). Hjalp AI-ene mer, så den er satt til 0 | 19/30 | 13/30 |
| 5 | Referanse med 60 partier | 26/60 (43 %) | 17/60 (28 %) |
| 6 | Faste kostnader 150k → 90k (nøytralt, beholdt) | 28/60 | 22/60 |

Status: Den dyktige boten overlever i omtrent 70 % av partiene og vokser til rundt 20 ansatte og 15–80 MNOK. På `easy` går den vanlige boten konkurs i 12 av 30 partier. Boten bruker verken stjerner, bakrommet, innsyn eller aktiv prising, så en menneskelig spiller bør gjøre det bedre. Det viktigste neste steget er ekte spilltesting.

Åpent: Sluttrangeringen bruker absolutt verdi, og topp-AI-ene er verdt 100–900 MNOK. Forslaget er å rangere på verdivekst i forhold til startstørrelse (venter på beslutning).

## Småoppdrag (2026-09-23)

3–5 anbud per kvartal på 1–2 konsulenter i 1–3 kvartaler publiseres alltid, i tillegg til den vanlige etterspørselen.

| # | Endring | human konkurs | humanPro konkurs | AI-konkurser/parti |
|---|---|---|---|---|
| 0 | Referanse (fra forrige runde) | 26/60 | 17/60 | 0,3 |
| 1 | Småoppdrag trukket fra etterspørselsbudsjettet | 45/60 | 43/60 | 1,3 |
| 2 | Småoppdrag som ekstra etterspørsel | 39/60 | 41/60 | 1,4 |
| 3 | + AI vekter anbud etter hvor mye ledig kapasitet de fyller, og boten velger flest dekkbare seter først | **6/60** | **3/60** | **0,1** |
| 3b | Samme som 3, men uten småoppdrag (A/B) | 18/60 | – | 0,1 |

Funn: Småoppdragene fylte budplassene til små firma (2–3 plasser) fordi de alltid dekkes 100 %. Da ble de mellomstore anbudene liggende. Løsningen var å la både AI-er og bot vekte etter hvor mye av benken et anbud fyller. Med det på plass gir småoppdragene en klar forbedring: konkurs 18/60 → 6/60 og median verdi 36 → 86 MNOK.

Status nå: En `human`-spiller vokser til rundt 40 ansatte, havner på medianplass 19 av 25 (p10: plass 9), og verdien er 86 MNOK i median. `idle` går konkurs i 59/60. Uten innsats går det altså ikke, men fornuftig spill holder.

## Bud på kassekreditt (2026-09-23)

Innsatsen på et bud kan nå betales med kassekreditten (`spendable(firm) = cash + creditLimit`), og et bud uten innsats er alltid lov. Før kunne et firma med negativ saldo ikke by i det hele tatt, heller ikke med innsats 0. Det gjaldt både spilleren og AI-ene.

| # | Endring | human konkurs | humanPro konkurs | AI-konkurser/parti |
|---|---|---|---|---|
| 0 | Referanse | 6/60 | 3/60 | 0,1 |
| 1 | Innsats fra kassekreditt, gratis bud alltid lov | 6/60 | 2/60 | 0,1 |

Funn: Innenfor støyen. `human` fikk median verdi 86 → 98 MNOK og medianplass 19 → 18. Endringen er først og fremst en UX-fiks: knappen blir ikke lenger grå uten grunn.

## Nivåsystem (2026-09-23)

Spilleren starter på nivå 1 og rykker opp ved å nå ett av tre mål: ansatte, omsetning forrige kvartal eller vunne anbud. Nivået låser opp større anbud, kultur, stjerner, rammeavtaler, bingo og bakrommet (se `LEVELS` og `FEATURE_LEVEL`). AI-firmaene starter på nivået størrelsen gir, og følger de samme reglene. Alle tallene under er fra 150 partier med `--seed 1000`. Det krevde 150 partier å skille effekten fra støyen; 30 og 60 partier ga motstridende A/B-resultater.

| # | Endring | human konkurs | human median verdi | humanPro konkurs |
|---|---|---|---|---|
| 0 | Referanse uten nivåer | 28/150 | 92 MNOK | 8/150 |
| 1 | Nivåer, rammeavtaler fra nivå 3 | 37/150 | 67 MNOK | – |
| 1b | Som 1, men spilleren har alt ulåst fra start | 19/150 | 83 MNOK | – |
| 1c | Som 1, men AI-ene har alt ulåst fra start | 34/150 | 67 MNOK | – |
| 2 | Som 1, men rammeavtaler fra nivå 2 | 28/150 | 105 MNOK | – |
| 3 | Som 2, pluss fornuftige startbudsjetter for spilleren (15k/12k/+2 %) | **22/150** | **95 MNOK** | **6/150** |

Funn: Det var spillerens låser som kostet, ikke AI-enes. Det største enkeltbidraget var rammeavtalene, som er viktige for å vokse fra rundt 10 til 20 ansatte. Siden spilleren ikke kan endre kulturbudsjettet på nivå 1, starter spilleren nå med det en fornuftig spiller ville valgt. AI-markedet er uendret (0,1 konkurs per parti).

Når nivåene nås (median): `human` nivå 2 i Q5, nivå 3 i Q12, nivå 4 i Q20 og nivå 5 i Q30 (101 av 150 når nivå 5). `humanPro` når dem i Q4, Q11, Q18 og Q27 (135 av 150). `npm run sim` skriver nå dette ut.

Andre spillerboter (60 partier, før → etter): `balanced` 0 → 0 konkurser, median 183 → 200 MNOK. `greedy` 3 → 7 konkurser, 85 → 87 MNOK. `shady` 0 → 2 konkurser, 92 → 82 MNOK, og 26 → 18 lyssky handlinger fordi bakrommet først åpner på nivå 3 (rundt Q10). Målet om at `shady` skal slå `balanced` i median verdi var ikke nådd før nivåene heller, og er fortsatt åpent.
