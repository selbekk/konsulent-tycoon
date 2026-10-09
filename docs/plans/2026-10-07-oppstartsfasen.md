# Oppstartsfasen: to gründere i et kontorfellesskap

Utgangspunkt: spillere sier at starten er «mye». Du får hele dashbordet, anbudstavla, bemanning, kontrakter og nøkkeltall fra første kvartal, med seks ansatte du ikke har valgt. Målet er en personlig og liten start der hvert valg er tydelig, og at dashbordet kommer først når firmaet har vokst ut av den.

Status: ferdig (2026-10-07). Tallene under er de som ble valgt; `constants.ts` er fasit.

## Beslutninger (intervju med Kristofer 2026-10-07)

| Spørsmål     | Valg                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tidslinje    | Fasen er de første kvartalene av de 40. Samme motor og `endTurn`, AI-ene spiller som før.                                                                                                   |
| Overgang     | Nivå 2 (dagens mål: ansatte, omsetning eller vunne anbud). Nivå 1 _er_ oppstartsfasen.                                                                                                      |
| Gründere     | Du (velger fagområde) + én medgründer fra et galleri med navngitte personer, fordeler og ulemper. Medgründeren velges i spillet, etter at selskapet er stiftet (endret etter første runde). |
| Navn         | Spillet spør hva du heter. Du er daglig leder og blir sitert i nyheter og artikler, og Bjørn bruker fornavnet ditt.                                                                         |
| Hoppe over   | Nei. Alle spiller fasen, også ukesutfordringen.                                                                                                                                             |
| Oppdrag      | Hvert kvartal får du 2–3 håndplukkede leads med tydelige tradeoffs. Du velger ett, og det er vunnet.                                                                                        |
| Rekruttering | Bare sideoppdrag (kaffeprat, drinks, LinkedIn, tilbud). Bestilling i bulk åpner på nivå 2.                                                                                                  |
| Begrensning  | Kveldstimer: et fast antall per kvartal. Hvert sideoppdrag koster én time.                                                                                                                  |
| Skjerm       | Egen skjerm uten faner. Rammen er et kontorfellesskap med kaffebar, ikke en garasje.                                                                                                        |
| Krydder      | Egne små hendelser fra kontorfellesskapet. Ingen kriser, ingen bakrom.                                                                                                                      |
| Startlag     | Bare dere to. Ingen ansatte og ingen startkontrakt.                                                                                                                                         |

## Motor

### Tilstand

- `Firm.startup?: StartupState` finnes bare på spillerens firma og bare mens fasen varer. Gamle lagringer har ikke feltet og spiller videre som før, også på nivå 1.
  - `cofounder`: id fra `content/cofounders.ts`.
  - `hours`: kveldstimer igjen dette kvartalet.
  - `leads: Lead[]`: kvartalets tilbud. `takenLead` er id-en til det du tok (ett per kvartal).
  - `candidates: Candidate[]`: folk i nettverket.
- `Contract.ramp?: { quarter, seats }`: vekstkunden vil ha flere folk fra et gitt kvartal.
- `GameState.weekly` blir `{ week, founder }` i stedet for `founders`. `NewGameOptions` får `founderDiscipline` og `ceoName` i stedet for `founderDisciplines`. Medgründeren er handlingen `chooseCofounder`, så den ligger i loggen.

### Medgründere (`content/cofounders.ts`)

Seks håndlagde personer. Hver har fagområde, nivå, stjernetraits fra `content/traits.ts` (så fordeler og ulemper lever videre etter fasen), eventuelt lønnstillegg, og en liten fordel i oppstartsfasen (`perk`: flere timer, flere kandidater, mer interesse, et ekstra lead, startkapital eller omdømme). Galleriet er det samme for alle, så ukesutfordringen er rettferdig.

### Leads

- Lages ved spillstart og ved hvert kvartalsskifte mens fasen varer, fra `state.rng`.
- Tre typer, én av hver per kvartal:
  - **Trygg** (offentlig kunde): lang (6–8 kvartaler), pris 0,85.
  - **Vekst** (hypet kunde): pris 0,9, 5–6 kvartaler, og kunden vil ha to seter til etter to kvartaler (`ramp`). Kul kunde gir bedre kandidater via porteføljen.
  - **Prestisje** (stor privat kunde): kort (2–3), pris 1,05, gir omdømme og relasjon. Ett sete ekstra, enten noen er ledige eller ikke.
  - **Innsidelead** (bare med Jonas): en fjerde avtale, pris 1,0.
- Hvert lead har en størrelse (1–3, trukket når det lages): så mange av de ledige tar kunden med, kundens favorittfag først. Minst ett sete. Først tok et lead alle ledige, men da satt ingen på benken, og botene endte langt over den gamle starten (se balanseloggen).
- Et lead du tar, blir en kontrakt som starter _samme kvartal_ (det er et direkteoppdrag, ikke et anbud). Leads teller ikke som vunne anbud, ellers ville tre kvartaler gitt nivå 2.

### Nettverket (rekruttering)

- Nye kandidater hvert kvartal (navn, nivå, særtrekk og potensial fra `newEmployee`, altså `rosterRng`). De blir i opptil tre kvartaler, og interessen synker litt hvert kvartal.
- Hver kandidat har en skjult favoritt: kaffe, drinks eller LinkedIn.
- Sideoppdrag (én kveldstime hver, hver tilnærming én gang per kandidat):
  - **Kaffeprat**: litt interesse, og du får vite favoritten.
  - **Drinks**: koster litt penger, mye interesse hvis det er favoritten, lite ellers.
  - **LinkedIn**: gratis, mye interesse hvis favoritten, ingenting ellers.
  - **Gi tilbud**: sjansen er interessen. Ja: personen begynner med en gang. Nei: interessen faller, og nytt tilbud må vente til neste kvartal.
- Startinteressen avhenger av omdømme, kundeporteføljen, medgründeren og nivået (flinke folk er vanskeligere å få).
- Ansettelse går gjennom en ny `hireEmployee` i `roster.ts`, så rosteret og poolene holder seg i takt.

### Porter mens fasen varer

- `placeBid`, `withdrawBid`, `recordMinigame` og `orderHires` avvises med `errors.startupPhase`. Porten er `firm.startup`, ikke nivået, fordi AI-firma på nivå 1 skal kunne by og ansette som før.
- Ingen kriser trekkes. Hendelser trekkes bare blant de som er merket `startup`, og de merkede trekkes aldri etterpå.
- Nivå 1-målene byttes ut med mål for fasen (første lead, første rekruttering, fullt belegg).

### Overgangen

`updateLevels` fjerner `firm.startup` når spilleren når nivå 2, og legger ut en nyhet. Kandidater og leads forsvinner. Kontraktene fra leads løper videre.

## UI

- **Nytt spill:** navn, ditt fagområde, vanskelighetsgrad og et galleri med medgründere (portrett, fag, nivå, en fordel og en ulempe).
- **Skallet:** uten faner mens `startup` finnes. Topplinja, tickeren og «Neste kvartal» er som før.
- **Kontorfellesskapet** (ny skjerm): dere to og de dere har fått med, kvartalets leads som kort med tradeoffs, nettverket med interessemåler og knapper for sideoppdragene, kveldstimene som prikker, løpende avtaler og veien til eget kontor (nivåpanelet).
- **Introen** forklarer bare fasen. Ved nivå 2 åpnes introen til dashbordet (anbud, folk og hva som kommer).
- **Gjøremål:** «Velg et oppdrag» når dere har ledige folk og ikke har tatt et lead, og «Bruk kveldstimene» når timer og kandidater er igjen.

## Toppliste, lagring og analyse

- Innsendingen får `founder` i stedet for `founders`, også i Cloud Function og Firestore. Navnet ditt sendes aldri; serveren bruker en plassholder. Motorendringen gir ny `ENGINE_VERSION` uansett.
- `SAVE_VERSION` 1 → 2. Migreringen fjerner `weekly` fra pågående ukespill, siden de ikke kan spilles likt av den nye motoren. Spillet fortsetter, men utenfor topplista.
- Nye handlinger (`chooseCofounder`, `takeLead`, `recruit`) i `ACTION_EVENTS`, i `hostile.test.ts` og i humanProxy. `game_started` sender `founder` og om spilleren skrev inn et navn (aldri navnet).

## Balanse

Mål: `human` når nivå 2 rundt Q4–Q6 (i dag median Q5), uten flere konkurser og uten stor endring i sluttverdi. Måles med `npm run sim -- --games 60 --strategy human,humanPro` før og etter, og logges i `balance-log.md`.
