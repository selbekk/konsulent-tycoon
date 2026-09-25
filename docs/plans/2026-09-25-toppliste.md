# Toppliste og valgfri konto

Status: bygget 2026-09-25 (Firestore og Auth er deployet, funksjonene venter på Blaze-planen). Hvordan det henger sammen i koden, står i `docs/utvikling.md` under «Toppliste (Firebase)».

## Hvorfor

Spillet har i dag bare én sammenligning: spilleren mot 24 AI-firmaer. Det er morsomt, men det gir ingen grunn til å spille én gang til for å slå noen du kjenner. Vi vil at spillere kan sammenligne seg med hverandre uten at det ødelegger det som er bra i dag: ingen innlogging, ingen backend-avhengighet, og spillet fungerer helt offline.

## Grunnideen: send inn partiet, ikke poengsummen

En toppliste for et spill som bare kjører i nettleseren er vanligvis verdiløs, fordi hvem som helst kan sende inn et oppdiktet tall. Vi har to egenskaper som løser det:

- Motoren er deterministisk. Samme seed og samme handlinger gir samme `GameState`.
- Motoren er ren TypeScript og kjører allerede i Node (`scripts/sim.ts`).

Klienten sender derfor inn **oppsett + handlingslogg**. En Cloud Function spiller partiet på nytt med samme motor og regner selv ut selskapsverdi, sluttittel og plassering (`score.ts`). Topplista inneholder bare resultater serveren har regnet ut.

Målt 2026-09-25 med `human`-boten over tre seeds:

| | Verdi |
|---|---|
| Handlinger per parti | 600–920 (inkludert kvartalsskifter) |
| Logg, rå JSON | 60–96 kB |
| Logg, gzip | 5–7 kB |
| Replay i Node | cirka 0,4 s |
| Replay lik originalen | ja, `JSON.stringify` av hele tilstanden er lik |

Det er godt innenfor grensene for Firestore og callable functions.

### Hva replay beskytter mot, og hva det ikke beskytter mot

Replay stopper **oppdiktede resultater**, men ikke **verktøyassistert spill**. Motoren er åpen og deterministisk, og ukens seed er offentlig. Den som vil, kan kjøre spillet lokalt, se framtidige anbud og hendelser, og prøve mange handlingsrekker før hen sender inn det beste. Anonyme kontoer gjør det umulig å håndheve «bare første forsøk».

Vi aksepterer dette og sier det åpent: **ditt beste innsendte parti teller**. Å prøve ukens seed flere ganger er en lovlig del av spillet, akkurat som i daglige utfordringer i andre spill. Det er det ærlige alternativet til å late som vi kan hindre det.

**Minispill** er stolt input. Poengsummen kommer som et tall i `recordMinigame` og `resolveCrisis`, og tidsbruken (`ms`, `secondsLeft`) kan aldri verifiseres. Å logge svarene og beregne dem på nytt på serveren hjelper lite, fordi den riktige preferansen kan utledes av kildekoden med den samme hash-RNG-en. Vi godtar derfor tallet som det er. Det er allerede begrenset til 0–100 per anbud og krise, så det verste tilfellet er et perfekt minispill hver gang. Det er litt bedre enn `humanPro` (cirka 90) og vil ikke dominere topplista. Serveren lagrer snittet av minispillene per innsending, så vi kan se etter avvik senere.

## Omfang

### Før lansering

1. **Ukens konsulenthus.** Alle spiller samme seed i én uke, på `normal`. Seeden er `hashString('2026-W39')` (ISO-uke), så klienten kan beregne den offline. Det er den eneste rettferdige sammenligningen, fordi seeden betyr mye. Innsending er åpen til uka er slutt, pluss en slingringsmonn på tre dager for partier som ble startet i uka.
2. **Rangert = ukens seed.** Frie partier med egen seed (feltet i `Menus.tsx`) kommer ikke på lista. Ellers kan man lete etter en heldig seed.
3. **Ukelista og Hall of Fame.** Hall of Fame er de beste ukeresultatene gjennom tidene, og hver oppføring viser hvilken uke den var fra.
4. **Persentil på sluttskjermen.** «Du slo 73 % av spillerne denne uken». Serveren regner den ut ved innsending. (Bygget: bare for spillere som har blitt med. En anonym innsending uten navn på lista er ikke laget.)
5. **Personlig historikk.** Dine innsendte partier med uke, selskapsverdi, sluttittel og plassering.
6. **Valgfri konto** (se under).

### Etterpå

- Koble kontoen til Google eller e-post, så historikken følger med til andre enheter.
- Delbart resultatkort (bilde eller lenke med ukens seed): «Slå meg på uke 39».
- Spøkelsesfirma: forrige ukes vinner spilles som ett av de 24 firmaene, styrt av handlingsloggen.
- Globale utmerkelser: «Bare 2 % har fått sluttittelen *Etisk mester*».
- Ikke synkroniser lagringen via skyen. Autosave-regelen finnes for å hindre at man laster inn på nytt og prøver igjen, og skylagring åpner det hullet på nytt.

## Konto: opt-in med Firebase Anonymous Auth

- Uten opt-in lastes ikke Firebase, og ingenting sendes. Spillet oppfører seg nøyaktig som i dag.
- Spilleren trykker «Vær med på topplista» på sluttskjermen eller i menyen. Da opprettes en anonym bruker (`signInAnonymously`), og hen velger et visningsnavn.
- Kontoen kan senere kobles med `linkWithCredential`. Uid-en og historikken beholdes.
- Firebase-SDK-et lastes dynamisk (`import()`) først ved opt-in, så offline-bundelen ikke vokser.
- Handlingsloggen registreres alltid lokalt, fra første kvartal. Da kan man bestemme seg for å sende inn etter at partiet er ferdig.

### Visningsnavn

Firmanavnet er tekst spilleren har skrevet, og det kan ikke vises offentlig uten moderering. Visningsnavnet på lista **settes sammen av forhåndsdefinerte ord**, for eksempel `Smidig` + `Tannlege` + `AS`, med ordlister i `content` og oversettelser i begge språk. Det passer tonen, gjør moderering unødvendig, og følger analytics-regelen om aldri å sende tekst spilleren har skrevet. Firmanavnet i selve partiet sendes ikke. `firmName` påvirker ikke RNG-en (sjekket: ingen `hashString` bruker navnet), så serveren kan spille på nytt med et fast plassholdernavn.

## Arkitektur

```
Klient (UI/store)                          Firebase
─────────────────                          ────────
store logger vellykkede handlinger  ──▶    callable function submitRun
+ 'end' per kvartal                         ├─ validerer oppsett, uke og motorversjon
                                            ├─ spiller partiet på nytt (src/engine)
sluttskjerm: send inn (opt-in)              ├─ avviser hvis en handling feiler
                                            └─ skriver til Firestore (bare funksjonen)
topplister/historikk: les Firestore  ◀──   weeks/{week}/entries/{uid}, users/{uid}/history
```

- **Motoren forblir ren.** Firebase-koden ligger i `src/online/` (tilsvarende `src/analytics/`), og bare UI og store kaller den. Funksjonen importerer `src/engine` direkte, på samme måte som `scripts/sim.ts`.
- **Hosting forblir på Vercel.** Firebase brukes bare til Auth, Firestore og Functions. Cloud Functions krever Blaze-planen (betal etter bruk). Med 0,4 s per replay er gratiskvoten stor, men sett et budsjettvarsel. Alternativet er en Vercel Function for replay og Firestore som database, men da får vi to backends. Vi velger Firebase alene.
- **Firestore-regler:** Klienter kan lese topplistene og sine egne partier. Bare funksjonen kan skrive (Admin SDK). Ingen direkte klientskriving.
- **App Check** (reCAPTCHA Enterprise) på den callable funksjonen, så det ikke er gratis å sende inn søppel i stor skala. *Ikke bygget ennå:* krever en reCAPTCHA-nøkkel fra konsollen. Inntil da begrenses innsending til én per 10 sekunder per konto, og loggen har et tak (`RUN_LOG_MAX`).
- **Authorized domains** i Firebase Auth: produksjonsdomenet og Vercels preview-domener.

### Innsending

```ts
// Slik det ble bygget: src/online/submission.ts
interface RunSubmission {
  engineVersion: string        // hash av engine + content, satt ved build
  week: string                 // '2026-W39'; seeden utledes av uka, vanskelighetsgraden er alltid normal
  gameId: string               // så samme parti sendt to ganger teller én gang
  founders: [Discipline, Discipline]
  log: (Action | 'end')[]      // ukomprimert JSON: 60–100 kB er godt innenfor grensene
  name: LeaderboardName        // ord-id-er, ikke fritekst
  claimedValuation: number     // kryssjekk; serveren stoler ikke på den
}
```

Serveren:

1. Sjekker at `week` er åpen, at `engineVersion` er lik sin egen, at formen er gyldig, og at loggen ikke overstiger `RUN_LOG_MAX` (6 000).
2. `createNewGame({ seed: weekSeed(week), firmName: 'Spiller AS', ... })`.
3. For hver oppføring: `'end'` gir `endTurn`, ellers `applyActionInPlace`. **Én feilende handling avviser hele innsendingen**, og det gjør også en handling for et annet firma enn spillerens. Handlere kan endre tilstanden delvis før de feiler, så en feilende handling i loggen betyr enten en bug eller tukling.
4. Krever `status` `finished` eller `lost`. Et halvspilt parti kan ikke sendes inn.
5. Regner ut `valuation`, `endTitle`, `playerRank` og minispillsnittet og lagrer dem. Avvik fra `claimed` logges. Det er et varsel om en determinismefeil, ikke en grunn til å avvise.
6. Beholder bare det beste partiet per uid og uke på ukelista. Alle partier havner i `runs` (med logg, bare server) og `users/{uid}/history` (uten logg, lesbart for eieren).

### Motorversjon og gamle PWA-er

Service workeren gjør at klienter kan kjøre en gammel build i flere dager. Hver build stempler en `ENGINE_VERSION`, en hash av `src/engine` og `src/content` (`scripts/engineVersion.ts`), som bakes inn av Vite både i appen og i funksjonens build.

- Funksjonen godtar bare sin egen versjon. Balanseendringer deployes derfor mellom ukene, med appen og funksjonene samtidig.
- Kommer en innsending med feil versjon, svarer serveren `online.errors.outdated` («Oppdater spillet for å sende inn»). Partiet ligger lokalt, men det kan ikke spilles på nytt med den nye motoren, så det kan ikke sendes inn. Det må stå tydelig på sluttskjermen, og aller helst allerede når ukens parti startes med en utdatert build.
- En hurtigfiks midt i uka som endrer motoren, betyr at funksjonen må ha begge versjoner bundlet ut uka. Unngå det: rene UI-endringer påvirker ikke `ENGINE_VERSION`.

## Forutsetninger i motoren (gjøres først)

1. **Fjern `localeCompare` fra motoren.** Det finnes fem kall (`score.ts`, `flavor.ts` ×2, `roster.ts`, `people.ts`). Sortering med `localeCompare` avhenger av locale: med `nb` havner `'aa'` sist (som å), med `en` først. En norsk nettleser og en server med engelsk ICU kan dermed rangere ulikt og spille ulikt. Erstatt med en locale-fri `compareIds(a, b)` i `util.ts` (`a < b ? -1 : a > b ? 1 : 0`), og legg til en lint- eller test-sjekk som hindrer `localeCompare` og `Intl` i `src/engine`.
2. **Replaytest via store-stien.** Spill et parti gjennom store-ets `dispatch`/`endTurn` (jsdom), med minispill, kriser og feilende handlinger underveis. Spill så loggen på nytt og krev identisk tilstand (uten `gameId`). Bot-stien alene er ikke nok: målingen viste at `planHumanProxy` trekker fra `state.rng` når den planlegger. Det er greit for boten, men det betyr at logging må skje der handlingene faktisk brukes.
3. **Allerede i orden** (sjekket 2026-09-25): ingen `Math.random`, `Date` eller transcendente `Math`-funksjoner i motoren. Eneste `**` med variabel eksponent er `POTENTIAL_EXPONENT = 2`. Store-et skriver bare `game` via ny, last inn, `dispatch` og `endTurn`.

## Lagring av handlingsloggen

- Loggen lagres **ved siden av** `GameState` under en egen nøkkel (`kt.log.auto`, `{ gameId, log }`), ikke inne i `GameState`. Den ville ellers blitt klonet ved hver handling (`applyAction` bruker `structuredClone`).
- Store-et legger til handlingen etter en vellykket `applyAction` og `'end'` etter `endTurn`, og lagrer loggen rett etter tilstanden. Skulle de likevel komme i utakt (en feilet skriving), ser `readLog` at antallet `'end'` ikke stemmer med kvartalet, og partiet kan da ikke sendes inn.
- Feltet er valgfritt. Før lansering blir `SAVE_VERSION` stående på 1. En lagring uten logg kan spilles videre, men ikke sendes inn.
- 60–100 kB per parti er uproblematisk for `localStorage`.

## Personvern og analytics

- Oppdater `about.privacy` i begge språk: hva som sendes (uid, ord-navn, handlingslogg, resultat), når (bare etter opt-in), og hvordan man sletter.
- **Slett konto** i innstillingene: en callable function som sletter `runs` og ukeoppføringer for uid-en og deretter selve brukeren.
- Nye PostHog-hendelser: `online_opt_in`, `run_submitted` (uke, verdi, plassering), `run_rejected` (årsak). Ingen fritekst.
- Handlingsloggen inneholder ingen tekst spilleren har skrevet. Det må sjekkes hvis nye handlinger med fritekst dukker opp.

## Rekkefølge

1. Motorforutsetningene: `compareIds`, lint-sjekk og replaytest.
2. Handlingslogg i store og lagring, med tester. Nyttig i seg selv for feilsøking.
3. `ENGINE_VERSION` og `weekSeed(week)` i motoren, pluss UI for å starte ukens parti.
4. Firebase-prosjekt, Auth (anonym), Firestore-regler, App Check.
5. `submitRun`: replay, validering, skriving. Tester med ekte logger fra steg 2.
6. UI: opt-in, visningsnavn, sluttskjerm med innsending og persentil, topplisteskjerm og historikk. i18n i begge språk. Må fungere ned til 360 px og offline (knappen deaktiveres uten nett, og innsendingen legges i kø).
7. Personvern, sletting og analytics.

## Beslutninger (2026-09-25)

1. **Startdisipliner** i ukens parti er fritt valg, en del av strategien.
2. **Bare `normal`** blir rangert til å begynne med.
3. **AI-firmaene vises ikke** på topplista.
4. **Innsendte logger beholdes** så lenge kontoen finnes, og slettes sammen med den. Det holder døra åpen for spøkelsesfirma og ny statistikk.
