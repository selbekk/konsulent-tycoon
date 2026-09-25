# Mindre anbudsmas, mer mening per valg

Utgangspunkt: nesten alt i spillet handler om å sende inn og vinne anbud, og møtet er en avgift du betaler på hvert bud. Målet er færre og viktigere møter, tydelig tilbakemelding og ett bindende løfte per viktig tilbud. Flere spørsmål løser ikke dette alene.

Status: fase 1 er ferdig, fase 2 er ikke bygget.

## Utgangspunktet (før fase 1)

- **Møtet var en skjult personlighet.** `meetingPreference` i `content/customers.ts` avgjorde svaret, og spilleren så den aldri.
- **Møtet var et krav.** `todos.ts` markerte hvert bud som ble avgjort i kvartalet uten møte. Et bud uten møte tapte opptil 15 kvalitetspoeng.
- **Ingen forklaring.** Tildelingen sa bare vant, tapte eller avvist.
- **Leveransen hadde allerede valg** (punkt 5): mersalg, reforhandling, pleie, oppsigelse og forlengelse (`contractActions.ts`, `contracts.ts`). Direkteoppdrag uten anbud manglet, og mangler fortsatt.

## Fase 1: færre møter, tydelig tilbakemelding, ett løfte (ferdig 2026-09-24)

### 1a. Møter bare på viktige anbud (punkt 4)

- `isKeyTender(tender)`: rammeavtale eller minst `KEY_TENDER_MIN_SEATS` = 6 seter. «Ny kunde» ble droppet. Spilleren starter med relasjon 25 hos alle, og et tap trekker relasjonen ned, så regelen ville gitt møter på de anbudene du nettopp tapte. Uten den er regelen også lik for alle firma, noe som gjør AI-likheten enkel.
- På rutineanbud får du ikke møte. Kvaliteten bruker da en nøytral verdi (`ROUTINE_MEETING_SCORE` = 50), slik at små bud ikke blir svekket i stillhet.
- Rutineanbud får knappen «Send standardtilbud» på anbudstavla (`quickBid`: pris 0,97, eller 0,90 når prisvekten er over 0,6, og standard innsats). «Tilpass» åpner budskjemaet som før.
- `todos.ts` tar bare med viktige anbud.
- AI-ene (`planner.ts`, `humanProxy.ts`) følger samme regel og registrerer bare møter på viktige anbud.

### 1b. Forklar resultatet (punkt 3)

- Del `bidQuality` i en ren `bidQualityParts` (CV, fagmiljø, møte, innsats, omdømme, `extras` for stjernenes traits, strategi og CV-juks, kapasitetsstraff og løfte). `bidQuality` summerer delene, så ingenting dupliseres.
- Ved tildeling sammenlignes spillerens poeng per faktor med vinneren (eller beste taper). Faktorene er pris, kvalitetsdelene, relasjon og prioritet. Forklaringen legges i nyhetens parametre (`weak`/`strong`), så ingen nye felt trengs på anbudet.
- Nyheten nevner den største årsaken, for eksempel «Dere tapte hovedsakelig på pris. Kvaliteten var konkurransedyktig.» Når støyen var større enn resten, står det «Det var jevnt, og flaksen avgjorde.»
- Avvist bud: oppgi grunnen (som regel kapasitetsstraffen, altså for få ledige folk).
- Etter møtet sier resultatet hvilken svarstil panelet likte best.

### 1c. Synlige behov (punkt 2)

- `customerNeeds` gir 2–3 lesbare behov i budskjemaet og før møtet: løftet kunden ønsker (`wants`), stramt budsjett eller kvalitet foran pris, og møtestilen.
- Møtestilen vises først ved relasjon på minst `NEEDS_STYLE_RELATION` = 40. Ellers står det at dere kjenner kunden for dårlig. Er stilen alltid synlig, blir møtet trivielt.

### 1d. Ett bindende løfte (punkt 1)

- Kun på viktige anbud: valgfritt `promise` på `Bid`, med tre valg:
  - `fullTeam`: «Hele teamet er klart.» +4 i kvalitet. Løftet er brutt hvis over 10 % av setene første kvartal fylles av frilansere, fleks eller offshore.
  - `phased`: «To nå, resten neste kvartal.» −2 i kvalitet, men bare 40 % av kapasitetsstraffen. Løftet er brutt over 50 %.
  - `discovery`: «Vi starter med en betalt kartlegging.» Første kvartal faktureres til halv pris, og sjansen for forlengelse ganges med 1,3. Løftet holdes alltid.
  - Løftet kunden ønsker (`wants`) gir +4 i tillegg. Holdt løfte gir +8 i tilfredshet og +3 i relasjon, brutt løfte −20 og −8.
- Løftet kopieres til `Contract`. `contracts.ts` sjekker det i første kvartals tilfredshetsoppdatering og lager en nyhet om løftet ble holdt eller brutt.
- AI-planleggeren velger et løfte ut fra ledig kapasitet og går gjennom samme reducer.

## Fase 2: leve av leveransen (punkt 5, ikke bygget)

- **Direkteoppdrag:** kunder med høy relasjon og en fornøyd kontrakt tilbyr av og til et oppdrag uten anbud. Du svarer ja eller nei innen kvartalet.
- **Leveransehendelser** knyttet til en kontrakt: kunden vil utvide omfanget, nøkkelpersonen trengs et annet sted, eller teamet vil bruke tid på kvalitet. Dette kan bygges på event-DSL-en med kontraktkontekst.

## Rammer

- Før lansering: `SAVE_VERSION` forblir 1, nye felt er valgfrie og legges i `saveShape.ts` der det trengs.
- Alle nye årsaker, behov og løfter får nøkler i både `nb` og `en`.
- UI-hjelpere (`bidQualityParts`, behov, forklaring) rører ikke `state.rng`.
- Balanse: kjør `npm run sim -- --games 60 --strategy human,humanPro` og `sim:market` med faste seeds før og etter 1a, og før og etter 1d. Logg resultatene i `docs/balance-log.md`.
