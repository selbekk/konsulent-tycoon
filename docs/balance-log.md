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

## Strategi, mål og kontor (2026-09-23)

Nytt: kontor per nivå (engangsløft for sosialt og brand), mål per nivå med små belønninger, og Strategi-fanen med spesialisering (nivå 3), partnerskap og lobbying (nivå 4), avdelinger (nivå 4), oppkjøp (nivå 5) og børsnotering (nivå 5). Botene `human`/`humanPro` bruker ingen av dem. `humanStrategic` bruker alle, og `humanSpecialty`, `humanPartner`, `humanDepartments`, `humanIpo`, `humanAcquire` og `humanNoAcquire` bruker hver sin del. Alle tall er fra 150 partier med `--seed 1000`.

| Bot | Konkurs | Median verdi | Medianplass |
|---|---|---|---|
| `human` (kontor og mål, ingen strategi) | 27/150 | 135 MNOK | 16 |
| `humanSpecialty` | 17/150 | 154 MNOK | 14 |
| `humanPartner` (partnerskap og lobbying) | 18/150 | 199 MNOK | 12 |
| `humanPartner` etter justering | 19/150 | 181 MNOK | 13 |
| `humanDepartments` | 22/150 | 171 MNOK | 13 |
| `humanIpo` | 25/150 | 118 MNOK | 18 |
| `humanAcquire` | 34/150 | 113 MNOK (p90 659) | 17 |
| `humanNoAcquire` (alt unntatt oppkjøp) | 11/150 | 253 MNOK | 10 |
| `humanStrategic` (alt, etter justering) | 13/150 | 365 MNOK | 6 |

Justering: partnerbonus 5 → 3, lobbying 400k → 600k og relasjon +6 → +4, fordi partnerskap og lobbying ga mest for minst.

Funn:
- Hver mekanikk hjelper litt for seg. Børsnotering er omtrent nøytral, som tenkt, fordi verdien etterpå bare teller eiernes andel.
- Oppkjøp alene er høy risiko og høy gevinst: flere konkurser, men p90 på 659 MNOK.
- Sammen gir de en stor effekt i sluttspillet. Kapitalen fra børsnoteringen finansierer oppkjøp, og strategiboten havner på plass 6 i median.
- Åpent spørsmål: skal en spiller som bruker alt, klatre så mye? Hvis ikke, er de naturlige knottene `ACQUIRE_PREMIUM` og grensen på ett oppkjøp om gangen.
- AI-markedet er uendret (0,1 konkurs per parti).

`human` mot tidligere: 27/150 og 135 MNOK med kontor og mål, mot 22/150 og 95 MNOK med bare nivåer. Samme seed-sett på `--seed 2000` ga 23 mot 25 konkurser, så konkursforskjellen er innenfor støyen, mens verdien er høyere.

## Kontrakthandlinger (2026-09-23)

Nytt på kontraktsskjermen: kundepleie og oppsigelse (nivå 1), reforhandling av pris (nivå 2) og mersalg (nivå 3), se `engine/contractActions.ts`. AI-ene og `human`-botene bruker de samme konservative reglene (`ai/contractMoves.ts`): pleie under 40 i tilfredshet, reforhandling når sjansen er minst 80 % (AI-ene i 40 % av tilfellene), mersalg av ett sete når minst to står på benken, og aldri oppsigelse. Alle tall er fra 150 partier med `--seed 1000`. Markedet er målt med `sim:market 60`.

| Kjøring | human konkurs | human median verdi | humanPro konkurs | humanPro median verdi | humanStrategic konkurs / verdi | AI-konkurser/parti |
|---|---|---|---|---|---|---|
| Referanse (ingen bruker handlingene) | 24/150 | 139 MNOK | 14/150 | 191 MNOK | 14/150 · 295 MNOK | 0,07 |
| Alle bruker handlingene | 16/150 | 156 MNOK | 3/150 | 242 MNOK | 8/150 · 468 MNOK | 0,02 |
| Som over, men botene uten mersalg | 17/150 | 158 MNOK | 5/150 | 219 MNOK | – | – |
| Som over, men botene uten reforhandling | 14/150 | 146 MNOK | 3/150 | 205 MNOK | – | – |

Funn:
- Mersalg og reforhandling gir hver 25–35 MNOK i median verdi for `humanPro`. Kundepleie brukes nesten aldri av botene: i 30 partier havnet de aldri under 40 i tilfredshet.
- Konkursene faller også når botenes mersalg eller reforhandling slås av hver for seg. Årsaken til det fallet er ikke isolert. AI-konkursene per parti svinger mellom kjøringene (0,02–0,1), så noe av det er støy.
- Mersalg skaper ikke ny etterspørsel i markedet. `committedDemand` teller `baseSeats`, så solgte seter trekkes fra volumet til nye anbud.
- Fra og med denne oppføringen bruker `human` og `humanPro` kontrakthandlingene. Tallene deres kan derfor ikke sammenlignes direkte med tidligere oppføringer.
- AI-markedet er friskt, med etterspørsel mot kapasitet som før (0,70–0,98).
- Åpent spørsmål: en spiller som bruker alt (`humanStrategic`), klatrer enda mer (median plass 8 → 6). Naturlige knotter hvis det blir for mye: `RENEGOTIATE_RATE_GAIN`, `UPSELL_COOLDOWN` og `UPSELL_BASE`.

## Bugjakt: rekruttering, stjerner, kapasitet og anbudsspam (2026-09-24)

En tester fant fire ting: nyansatte kom ett kvartal senere enn teksten lovet, samme stjerne kunne loves bort i overlappende kontrakter, kapasitetsoversikten trakk bud som starter om to kvartaler fra neste kvartal, og gratis bud til makspris på alle anbud, bemannet med frilansere, ga plass 2 med to ansatte. Alle tall er fra 150 partier med `--seed 1000` (spam: 60 partier). Markedet er målt med `sim:market 60`.

**Viktig: `humanProxy` hadde en feil som gjør tidligere `human*`-tall for lave.** Boten satte de samme stjernene på alle budene sine. Reduceren avviser bud nummer to med `errors.starPromised`, og AI-avvisninger er stille, så de fleste budene forsvant. Uten stjerner på CV-ene vant boten 329 anbud de første 12 kvartalene i 30 partier, med stjerner 211. Boten sporer nå lovede stjerner slik AI-planleggeren gjør. Tallene under kan derfor ikke sammenlignes med tidligere oppføringer.

| Kjøring | human konkurs / verdi / plass | humanPro konkurs / verdi / plass | humanStrategic verdi / plass | spam verdi / plass | AI-konkurser/parti |
|---|---|---|---|---|---|
| `main` før alt | 16/150 · 156 MNOK · 19 | 3/150 · 242 MNOK · 13 | 468 MNOK · 6 | 398 MNOK · 9 | 0,0 |
| `main` + botfiks (ny referanse) | 2/150 · 571 MNOK · 5 | 0/150 · 595 MNOK · 4 | 2020 MNOK · 1 | 398 MNOK · 9 | – |
| + rekruttering, stjerneregel og kapasitet | 0/150 · 659 MNOK · 4 | 0/150 · 796 MNOK · 3 | 2570 MNOK · 1 | 395 MNOK · 8 | 0,1 |
| + `MIN_AWARD_QUALITY = 35` | 0/150 · 627 MNOK · 4 | 0/150 · 947 MNOK · 2 | 2648 MNOK · 1 | **88 MNOK · 21** (17/60 konkurs) | 0,0 |

Endringer:
- **Rekruttering:** De som takker ja, begynner ved kvartalsskiftet og fakturerer fra neste kvartal, slik planen (§1.4) sier. Isolert (med den gamle boten) var effekten innenfor støyen: 16 → 20 konkurser, 156 → 135 MNOK.
- **Stjerner:** En stjerne kan bare tilbys hvis kontrakten stjernen sitter på er ferdig når den nye starter (`starBusyThrough`). Med den gamle boten så dette ut som et hopp fra 156 til 450 MNOK. Hele hoppet kom av at boten sluttet å sette opptatte grunnleggere på bud, slik at færre bud ble avvist. Det var botfeilen over, ikke regelen.
- **Kapasitet:** Bare bud som avgjøres dette kvartalet, teller mot neste kvartal. Påvirker ikke motoren.
- **Minstekvalitet ved tildeling:** Kunden avviser bud under 35 i kvalitet, også når budet er alene. Spambudet (copy-paste, ingen egne folk ledige) havner rundt 10–20, mens vanlige bud ligger på 45–65. Frilansergrense og prisreferanse for enslige bud ble ikke prøvd, fordi dette alene lukket hullet.

Funn:
- Med botfiksen er spillet mye lettere for en fornuftig spiller enn loggen har vist: `human` går nesten aldri konkurs og ender rundt plass 4, og `humanStrategic` vinner i median. Målene for `human` bør vurderes på nytt før videre justering.
- Et enslig bud får fortsatt full prisscore uansett pris, fordi det sammenlignes med seg selv. Det er ikke lenger lønnsomt å utnytte (se spam), men det er den naturlige knotten hvis det dukker opp igjen.

## Viktige anbud, løfter og forklaringer (2026-09-24)

Fase 1 av `docs/plans/2026-09-24-mindre-anbudsmas.md`. Bare viktige anbud (rammeavtaler og prosjekter med minst `KEY_TENDER_MIN_SEATS` = 6 seter) har kundemøte og løfte om oppstart. På rutineanbud får alle firma `ROUTINE_MEETING_SCORE` i møtescore. AI og boter møter bare på viktige anbud og velger løfte med `ai/promises.ts`. Alle tall er fra 60 partier med `--seed 1`, og markedet er målt med `sim:market 20`.

| Kjøring | human konkurs / verdi / plass | humanPro konkurs / verdi / plass | Etterspørsel/kap. | AI-døde/parti |
|---|---|---|---|---|
| Referanse (`main`) | 0/60 · 708 MNOK · 4 | 0/60 · 920 MNOK · 3 | 0,73–0,90 | 0,1 |
| Viktige anbud + løfter (`ROUTINE_MEETING_SCORE = 50`) | 0/60 · 604 MNOK · 5 | 0/60 · 785 MNOK · 3 | 0,69–0,89 | 0,0 |
| Samme, uten løfter hos botene | 0/60 · 609 MNOK · 5 | 0/60 · 786 MNOK · 3 | – | – |
| `ROUTINE_MEETING_SCORE = 60` (forkastet) | 0/60 · 635 MNOK · 4 | 0/60 · 725 MNOK · 3 | 0,71–0,89 | 0,0 |

Funn:
- Løftene er omtrent nøytrale for balansen. Nedgangen på 10–15 % i verdi kommer av at botene før spilte møtet på *alle* anbud med 70 (`human`) eller 90 (`humanPro`), mens AI-ene snitter rundt `qualityFocus × 80`. Når rutineanbud gir alle 50, forsvinner spillerens møtefordel på dem. Det er tilsiktet: møteferdighet skal bety mye der det er møter, ikke overalt.
- Med 60 ble tallene ikke entydig bedre (støy), så 50 beholdes. Kundene regner da med et møte på snittet av AI-markedet.
- AI-markedet er uendret innenfor støyen.

## Kriser (2026-09-24)

Nytt system: kriser over flere kvartaler med skjult alvorlighetsgrad (se `docs/plans/2026-09-24-kriser.md`). Det er 12 kriser i seks kategorier. Spilleren får omtrent én hvert 3.–4. kvartal (`CRISIS_CHANCE = 0.45`, `CRISIS_GAP = 2`). AI-firmaene får egne kriser med `CRISIS_AI_CHANCE = 0.05` per kvartal, og rammes halvt så hardt (`CRISIS_AI_IMPACT = 0.5`). Hendelsen `security_incident` er erstattet av krisen `data_leak`. Botene (`human*`) svarer med `ai/crises.ts` og en «fornuftig» stil (`HUMAN_CRISIS_STYLE`). Alle tall er fra 60 partier med `--seed 1`, og markedet er målt med `sim:market`.

| Kjøring | human konkurs / verdi / plass | humanPro konkurs / verdi / plass | Etterspørsel/kap. | AI-døde/parti |
|---|---|---|---|---|
| Referanse (før kriser) | 0/60 · 561 MNOK · 5 | 0/60 · 670 MNOK · 4 | 0,71–0,89 (20) | 0,0 (20) |
| Kriser for alle, botene snakker på 60 i samtaler (under `CRISIS_TALK_GOOD`) | 0/60 · 635 MNOK · 4 | 1/60 · 709 MNOK · 3 | 0,72–0,91 (20) | 0,2 (20) · 0,1 (60) |
| Samme, botene snakker som i kundemøtet (70 / 90) | 0/60 · 690 MNOK · 3 | 0/60 · 789 MNOK · 3 | – | – |
| + `talkGood` halvert (gjeldende) | 0/60 · 634 MNOK · 3 | 0/60 · 701 MNOK · 4 | – | – |
| Kriser bare for AI (spilleren slipper) | 0/60 · 622 MNOK · 4 | 0/60 · 746 MNOK · 3 | – | – |

Håndteringsstil, målt med `humanProxy` over 40 partier (`--seed 1`–`40`) med kriser på:

| Stil | Median verdi |
|---|---|
| Fornuftig (`HUMAN_CRISIS_STYLE`) | 597 MNOK |
| Ignorerer alt (reservevalget hver gang) | 529 MNOK |
| Billig og lyssky (`care 0`, `shady 0.8`, dårlig i samtaler), før skjerpet avsløring | 600 MNOK |
| Som over, med skjerpet avsløring | 506 MNOK |

Funn:
- Første kjøring snakket botene på 60, altså alltid i «greit»-sjiktet. `sim.ts` gir nå hver bot samme ferdighet i krisesamtaler som i kundemøter. Da ble krisene netto *positive* (690 / 789 MNOK), så gevinsten ved en god samtale (`talkGood`) er halvert. Tabellen over «håndteringsstil» er målt før denne endringen.
- For en fornuftig spiller er krisene nå omtrent nøytrale på verdi (634 mot 622 MNOK for `human`, 701 mot 746 for `humanPro`), innenfor støyen. Konkursraten er uendret. Det svir i kvartalet det skjer, med 5–25 000 kr per ansatt, folk av oppdrag eller en tapt kontrakt, men en godt håndtert krise kan også gi noe tilbake.
- Å ignorere kriser koster rundt 11 % av verdien. Eskaleringen virker.
- Med den første avsløringen (omdømme −5, skandale 6, heat 10) lønte det seg like godt å dysse ned alt som å håndtere krisene ordentlig. Avsløringen (`EXPOSED_STAGE`) gir nå omdømme −8, skandale 8, heat 15 og −5 i tilfredshet på alle kontrakter. Da faller den lyssky stilen til 506 MNOK. Den fornuftige boten dysser aldri ned, så tallene dens er uendret.
- Spilleren får 9,9 kriser per parti (20 partier). Utfallene er 68 % godt, 28 % greit og 4 % dårlig for den fornuftige boten. AI-firmaene får til sammen rundt 60 per parti, markedskriser medregnet. Det gir omtrent én sladdernyhet per kvartal.
- Boten avsluttet aldri et kvartal med et åpent krisepunkt på gjøremålslista (0 av 400 kvartaler). `endTurn` tar i snitt 9 ms, med maks 17 ms.
- AI-markedet er friskt. 0,2 AI-døde per parti på 20 partier falt til 0,1 på 60, som er innenfor det loggen har vist før (0,0–0,1).
- Spredningen i utfall økte ikke. For `humanPro` falt p90 fra 1458 til 1338 MNOK. Målet om mer spredning er ikke nådd.
- AI-firmaene dysser i praksis aldri ned (0 av 20 partier). Nedgraving scorer bare positivt i planleggeren ved `shadiness > 0,4`, og ingen arketype er så lyssky, så `news.crisis.exposedRival` vises aldri ennå.
- `whistleblower` dukket ikke opp i utvalget, fordi boten sjelden ansetter stjerner. Den er bare testet strukturelt.
- Naturlige knotter: `CRISIS_CHANCE`, `CRISIS_AI_IMPACT`, `CRISIS_EXPOSE_CHANCE`, og kostnadene per valg i `content/crises.ts`.

## Skjult vri i krisesamtalene, og AI-firmaer som dysser ned (2026-09-24)

**Samtalene:** Hvert spørsmål har nå fire svar, ett per stil: ærlig (`candid`), omsorgsfull (`caring`), fakta (`facts`) og spinn (`spin`). Publikum har en skjult favoritt, trukket per krise med hash-RNG etter `TALK_PREFERENCE_WEIGHTS`, og hater den motsatte stilen (ærlig mot spinn, omsorg mot fakta). Pressen liker oftest ærlighet, allmøtet omsorg og kunden fakta, men alle kan forekomme. Introen gir et hint, og reaksjonene underveis røper resten, som i kundemøtet. Poengskalaen er den samme som før: 33 for favoritten, 15 for de nøytrale og 0 for den hatede eller for å gå tom for tid. Botene bruker fortsatt en fast ferdighet, så spillersimen påvirkes ikke.

**AI som dysser ned:** Planleggeren leser lyst til å dysse ned fra `CRISIS_AI_HUSH` (grunnverdi + 3 × `shadiness` + 0,6 × (1 − `qualityFocus`)). Billige og store firmaer dysser ned, butikkfirmaene holder seg ærlige. AI-firmaenes nedgravde saker sprekker `CRISIS_AI_EXPOSE_FACTOR = 2` ganger så ofte, og `CRISIS_AI_CHANCE` er økt fra 0,05 til 0,07. Planleggeren vekter også penger som andel av kvartalsomsetningen, ikke per ansatt. Den gamle vektingen fikk store firmaer til å overvurdere små kostnader, for eksempel én person tatt av oppdrag. `ransomware.locked.pay_ransom` er nå en nedgraving («i all stillhet»).

| Kjøring (20 partier, `sim:market`-oppsett) | AI nedgravd/parti | Konkurrentavsløringer/parti |
|---|---|---|
| Før | 0 | 0 |
| + `CRISIS_AI_HUSH` (0,1 / 3 / 0,5) | 1,3 | 0,3 |
| + grunn 0,2, uforsiktighet 0,6, avsløring × 2 | 1,6 | 1,0 |
| + pengevekting mot omsetning | 2,1 | 1,4 |
| + `CRISIS_AI_CHANCE = 0,07` (gjeldende) | 3,0 | 1,9 |

Markedet med `sim:market 60` holder seg friskt: etterspørsel mot kapasitet er 0,72–0,90, og AI-døde per parti er 0,1. Spillerbotene (60 partier, `--seed 1`): `human` 2/60 konkurs · 678 MNOK · plass 3, `humanPro` 0/60 · 828 MNOK · plass 3. Tidligere var tallene 0/60 · 634 og 0/60 · 701. Økningen kommer trolig av at rivalene får flere kriser, pluss den nye pengevektingen i botenes krisevalg. To konkurser er innenfor støyen (±5 av 60).
