# Utviklerguide

Slik er Konsulent Tycoon bygget, og slik jobber du med koden. Hva spillet er og hvorfor, står i [`spilldesign.md`](spilldesign.md). Stier er relative til rotmappen i repoet.

## Innhold

- [Kommandoer](#kommandoer)
- [Arkitektur](#arkitektur)
- [Mappestruktur](#mappestruktur)
- [Spillmotoren](#spillmotoren)
- [UI-et](#ui-et)
- [Tekster og språk (i18n)](#tekster-og-språk-i18n)
- [Lagring og migrasjoner](#lagring-og-migrasjoner)
- [PWA (installerbar app)](#pwa-installerbar-app)
- [Innhold: slik legger du til ting](#innhold-slik-legger-du-til-ting)
- [Balansering og simulator](#balansering-og-simulator)
- [Testing](#testing)
- [Konvensjoner og fallgruver](#konvensjoner-og-fallgruver)
- [Kjente mangler](#kjente-mangler)

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Starter Vite-utviklingsserver med hot reload |
| `npm run build` | Typesjekker og bygger en statisk versjon til `dist/` |
| `npm run preview` | Serverer `dist/` lokalt |
| `npm test` | Kjører alle tester én gang (Vitest) |
| `npm run test:watch` | Kjører testene i watch-modus |
| `npm run typecheck` | Kjører TypeScript uten å bygge |
| `npm run lint` | Kjører oxlint |
| `npm run sim -- [flagg]` | Spiller hele partier headless med spillerboter (se [Balansering](#balansering-og-simulator)) |
| `npm run sim:market -- 20 [-v]` | Måler hvor sunt AI-markedet er over 40 kvartaler, uten spiller |
| `npm run icons` | Genererer app-ikonene i `public/` fra `public/icon.svg` |

Før du committer, bør `npm run typecheck`, `npm test` og `npm run build` være grønne.

## Arkitektur

```
┌──────────────────────────────┐        ┌───────────────────────────┐
│ React-UI  (src/ui, App.tsx)  │ leser  │ Zustand-store             │
│ skjermer, modaler, minispill │◄──────►│ (src/store/gameStore.ts)  │
└──────────────────────────────┘ sender │ state · dispatch · endTurn│
                                 actions└────────────┬──────────────┘
                                                     │ kaller
                                        ┌────────────▼──────────────┐
                                        │ Spillmotor (src/engine)   │
                                        │ ren TypeScript, ingen DOM │
                                        │ applyAction · endTurn     │
                                        └────────────┬──────────────┘
                                                     │ leser data fra
                                        ┌────────────▼──────────────┐
                                        │ Innhold (src/content)     │
                                        │ firma, kunder, hendelser… │
                                        └───────────────────────────┘
```

Fire prinsipper styrer arkitekturen:

1. **Motoren er ren TypeScript.** Den importerer aldri fra React, DOM eller Vite. Derfor kan simulatoren (`tsx scripts/sim.ts`) kjøre motoren direkte i Node.
2. **Hele spillet er én serialiserbar `GameState`.** State består bare av vanlig JSON: ingen klasser, funksjoner, `Date` eller `Map`. Du kan lagre den med `JSON.stringify` og få den tilbake med `JSON.parse`.
3. **All tilfeldighet er seeded.** RNG-tilstanden (`state.rng`) ligger inne i state. Samme seed og samme handlinger gir alltid samme parti, også etter lagring og innlasting. Det gjør bugs reproduserbare og tester deterministiske.
4. **Spilleren og AI-ene er likestilte.** Begge er av typen `Firm`, og begge endrer spillet gjennom de samme `Action`-ene i den samme reduceren. AI-en har ingen snarveier.

## Mappestruktur

```
src/
  engine/             Spillmotoren (ren TS)
    types.ts          Alle typer: GameState, Firm, Tender, Contract, Action …
    constants.ts      ALLE balansetall. Juster her, ikke i modulene.
    rng.ts            Seeded RNG (mulberry32) + hjelpere
    newGame.ts        createNewGame(): firma, kunder, backlog, første anbud
    reducer.ts        applyAction() og handlers for hver Action
    turn.ts           endTurn(): kvartalspipelinen
    economy.ts        Bemanning, omsetning, kostnader, kassekreditt
    staff.ts          Trivsel, turnover, rekruttering
    stars.ts          Stjernekonsulenter, traits, stjernemarkedet
    culture.ts        Fagmiljø, sosialt miljø, arbeidsgiverbrand
    tenders.ts        Anbud: generering, kvalitet, scoring, tildeling, forklaring
    contracts.ts      Kontrakter, avrop, forlengelse, løfter
    contractActions.ts Pleie, oppsigelse, reforhandling, mersalg
    levels.ts         Firmanivåer og låser
    missions.ts       Mål per nivå
    strategy.ts       Spesialisering, partnerskap, lobbying, avdelinger, børs
    acquisitions.ts   Oppkjøp
    crises.ts         Krisemotoren
    shady.ts          Bakrommet: katalog, heat, oppdagelse, skandaler
    events.ts         Hendelsesmotor og effekt-DSL
    market.ts         Markedstrender
    flavor.ts         Høyttalermeldinger og ansattes tanker
    awards.ts         Årets priser
    score.ts          Verdivurdering, rangering, sluttitler
    metrics.ts        Nøkkeltall: FG, OT, vekst, retention, kapasitet, bransjesnitt
    todos.ts          Gjøremålslista for kvartalet
    minigames.ts      Rene scoringsfunksjoner for minispillene
    save.ts           Serialisering, migrasjoner, lagringsplasser
    saveShape.ts      Sjekker at en lagring har riktig form
    ai/
      personalities.ts  AI-personligheter og arketyper
      planner.ts        planAiTurn(): hva et AI-firma gjør hvert kvartal
      crises.ts         Hvordan AI-er og boter svarer på kriser
      contractMoves.ts  Kontrakthandlinger for AI-er og boter
      promises.ts       Valg av løfte på viktige anbud
      humanProxy.ts     En «fornuftig menneskelig» bot for balansering
    index.ts          Offentlig API mot UI-et
  content/            Spilldata (firma, kunder, hendelser, kriser, trender …)
  i18n/               i18next-oppsett + locales/{nb,en}/*.json
  store/              Zustand-store (tynn bro mellom UI og motor)
  ui/
    components/       Felles komponenter, Icon (pikselikoner), Bjørn
    screens/          Skall, faner, modaler, menyer
    minigames/        Presentasjonsmøte, buzzword-bingo og krisesamtaler
    office/           Pikselkontoret på dashbordet
    pwa/              Oppdateringsvarsel og installering
    theme/            Design-tokens og global CSS
    format.ts         Penger, prosent, kvartaler og nyhetstekster
    sound.ts          8-bit-lyder med Web Audio
scripts/
  sim.ts              Balansesimulator med spillerboter
  market-health.ts    Helsesjekk for AI-markedet alene
docs/
  spilldesign.md      Hva spillet er og hvorfor
  utvikling.md        Denne guiden
  balance-log.md      Logg over alle balanseendringer, med resultater
  plans/              Planer og beslutninger for større systemer
```

## Spillmotoren

### Offentlig API

UI-et importerer fra `src/engine` (`index.ts`). De viktigste funksjonene er:

```ts
createNewGame({ seed, firmName, founderDisciplines, difficulty }): GameState
applyAction(state, action): { state, error? }   // ren: muterer aldri input
endTurn(state): GameState                       // ren: returnerer ny state
```

Hjelpere som er trygge å kalle fra UI-et for estimater og visning: `quarterFinancials`, `staffFirm`, `bidQuality`, `bidScoreEstimate`, `valuation`, `rankings`, `employeeThoughts`, `riskLevel` og flere.

### Actions

Alle endringer i spillet går gjennom en `Action` (se `types.ts`):

`setBudgets`, `orderHires`, `fire`, `hireStar`, `giveRaise`, `placeBid`, `withdrawBid`, `recordMinigame`, `resolveEvent`, `resolveCrisis`, `startCrisisTalk`, `shady`, strategihandlingene og kontrakthandlingene (`renegotiateContract`, `cancelContract`, `upsellContract`, `nurtureContract`).

- `applyAction` lager en kopi med `structuredClone`, kjører handleren og returnerer den nye staten.
- Ved feil returneres den **opprinnelige** staten sammen med en feilnøkkel, for eksempel `'errors.notEnoughCash'`. Feilnøkkelen er en i18n-nøkkel i `game`-namespacet.
- Inne i motoren (AI-turer, simulator) brukes `applyActionInPlace` på én felles draft. Da slipper vi hundrevis av kloner per tur.

### Kvartalspipelinen (`turn.ts`)

`endTurn` kjører stegene i fast rekkefølge. Rekkefølgen er viktig, så ikke endre den uten å tenke deg om:

1. Ubesvarte hendelser løses automatisk (siste valg firmaet har råd til).
2. AI-firmaene planlegger og utfører turen sin (`planAiTurn`), og svarer først på sine kriser.
3. Ubesvarte krisefaser tar reservevalget sitt (`autoResolveCrises`). Det skjer før faktureringen, så folk som tas av oppdrag koster allerede dette kvartalet.
4. For hvert firma:
   - fakturering og kostnader (`quarterFinancials`), deretter kassekredittrente
   - kundetilfredshet og mulig oppsigelse
   - kultur og trivsel, deretter avdelinger (akademiet)
   - stjerner
   - turnover og ansettelser
   - kvartalsrapport, deretter børspress for noterte firma
5. Oppdagelse av lyssky handlinger, og nedgang i heat. Kriser som er lagt i skuffen, kan sprekke (`rollCrisisExposure`).
6. Anbud med frist dette kvartalet avgjøres og blir til kontrakter. Deretter rykker firmaer opp i nivå (`updateLevels`), så kvartalets seire teller.
7. Kontrakter utløper eller forlenges. Rammeavtalene får avrop for neste kvartal.
8. Trender oppdateres, og nye anbud publiseres.
9. Etter Q4 deles årets priser ut. Deretter sjekkes spillerens mål per nivå (`checkMissions`).
10. Konkurssjekk. Kontraktene til konkursfirma legges ut på nytt som anbud.
11. `quarter++`. Deretter fornyes stjernemarkedet, besvarte kriser går til neste fase (`advanceCrises`), nye hendelser og kriser trekkes (`drawCrises`), og en høyttalermelding velges.

### Tidslinjen for et anbud

```
kvartal q      : anbudet publiseres (publishedQuarter = q)
kvartal q, q+1 : firmaene kan by (AI-ene byr i begynnelsen av endTurn)
slutt av q+1   : anbudet avgjøres (dueQuarter = q+1)
kvartal q+2    : kontrakten starter
```

### Viktige mekanikker

Hva mekanikkene er ment å gjøre, står i [`spilldesign.md`](spilldesign.md). Tallene står i `constants.ts`, som er fasit.

- **Økonomi:** Hver konsulent fakturerer `BILLABLE_HOURS` timer per kvartal til `listRate(nivå)`, ganget med budets prisfaktor. Lønn, overhead og kulturbudsjetter trekkes hvert kvartal.
- **Bemanning (`staffFirm`):** Egne folk i riktig fagområde fyller setene først. Deretter kommer **fleks**, altså ledige folk fra andre fagområder, fakturert på nivå `FLEX_LEVEL`. Til slutt fylles resten med **frilansere** (`FREELANCER_LEVEL`, `FREELANCER_MARKUP`), som gir et lite tap.
- **Kassekreditt:** Et firma kan ha negativ kontantbeholdning ned til `creditLimit` (minst `CREDIT_MIN`, ellers en andel av årsomsetningen), med `CREDIT_INTEREST` i rente per kvartal. Firmaet går konkurs etter to kvartaler under grensen.
- **Anbud:** Score = `prisvekt × prisscore + kvalitetsvekt × kvalitet + 0,1 × relasjon + prioritetsbonus + støy`.
  - Kvaliteten avhenger av CV-nivå, fagmiljø, minispill, innsats, omdømme, stjernenes traits og løftet om oppstart. `bidQualityParts` gir hver del for seg, og `bidQuality` summerer dem.
  - **Viktige anbud** (`isKeyTender`: rammeavtaler og prosjekter med minst `KEY_TENDER_MIN_SEATS` seter) har kundemøte og **løfte om oppstart** (`fullTeam`, `phased`, `discovery`). Løftet følger kontrakten og sjekkes etter første kvartal i `contracts.ts`. **Rutineanbud** har ikke møte: alle får `ROUTINE_MEETING_SCORE`, og spilleren kan sende et standardtilbud (`quickBid`) med ett klikk.
  - Kundens behov (`customerNeeds`) vises før møtet: hvilket løfte kunden ønsker (`wants` i `content/customers.ts`), prisfølsomhet og, med god nok relasjon, møtestilen.
  - Ved tildeling forklarer nyheten til spilleren hvorfor budet vant eller tapte (`weak`/`strong`, se `game:factors`). Forklaringen sammenligner spillerens poeng per faktor med vinneren (eller beste taper), og sier «flaks» når støyen avgjorde mot resten.
  - Kapasitetsstraffen gjelder når du ikke har nok **ledige** folk ved oppstart.
  - Bud under `MIN_AWARD_QUALITY` i kvalitet avvises, også når ingen andre byr. Ellers kunne gratis bud på alt, bemannet med frilansere, vinne alle anbud uten konkurranse.
  - En stjerne kan stå på ett åpent bud om gangen, og bare hvis kontrakten stjernen sitter på er ferdig når den nye starter (`starBusyThrough`). Å flytte en stjerne midt i en kontrakt går bare via bakrommet (`bait_and_switch`).
- **Ansettelser:** De som takker ja til kvartalets bestillinger, begynner ved kvartalsskiftet og fakturerer fra neste kvartal.
- **Etterspørsel:** Markedet etterspør `baseDemand` (startkapasiteten × `TARGET_DEMAND_RATIO`) × vekst per år (`DEMAND_GROWTH_PER_YEAR`) × trender. Etterspørselen følger bevisst **ikke** kapasiteten nedover. Da ville markedet havnet i en dødsspiral (se `docs/balance-log.md`).
- **Bakrommet (`shady.ts`):**
  - Hver handling har kostnad, heat og en grunnsannsynlighet for å bli oppdaget. Heat øker sannsynligheten.
  - CV-juks sjekkes først når du faktisk vinner.
  - Pågående handlinger (outsourcing, muldvarp, bait-and-switch) kan oppdages hvert kvartal så lenge de pågår.
- **Nivåer (`levels.ts`):** Et firma har nivå 1–5. Spilleren starter på nivå 1, og AI-firmaene starter på nivået størrelsen gir.
  - Et firma rykker opp når det når **ett** av målene i `LEVELS`: antall ansatte, omsetning forrige kvartal eller antall vunne anbud totalt. Nivået går aldri ned.
  - Nivået styrer hvor store anbud firmaet kan by på (`maxSeats`), og når kultur, stjernemarkedet, rammeavtaler, bingo og bakrommet åpner (`FEATURE_LEVEL`). Hvert triks i bakrommet har sin egen `minLevel` i `SHADY_CATALOG`.
  - Låsene håndheves i reduceren med `errors.levelTooLow` / `errors.tenderTooBig`, altså likt for spiller og AI. `planAiTurn` og `planHumanProxy` filtrerer bort det som er låst, så de ikke bruker opp budplasser på bud som avvises.
  - Siden spilleren ikke kan endre kulturbudsjettet på nivå 1, starter spilleren med `PLAYER_START_BUDGETS`.
  - Hvert nytt nivå er en flytting til et større kontor: et navn og en ny møbelbit i `OfficeView`, og et engangsløft for sosialt miljø og arbeidsgiverbrand (`OFFICE_MOVE_*`).
- **Strategi (`engine/strategy.ts`, `engine/acquisitions.ts`, `content/strategy.ts`):** Egen fane fra nivå 3.
  - **Spesialisering** (nivå 3): en sektor eller et fagområde som gir bonus i `bidQuality` for anbud som passer. Første valg er gratis.
  - **Partnerskap** (nivå 4): kvartalsvis avgift for bonus i anbud med seter i partnerens fagområde, maks to.
  - **Lobbying** (nivå 4): løfter relasjonen til alle offentlige kunder, med nedkjøling.
  - **Avdelinger** (nivå 4): akademi (poolnivå vokser), salg (bonus på alle bud) og nearshore (billigere frilansere). Kostnaden ligger i `quarterFinancials().strategyCost`.
  - **Oppkjøp** (nivå 5): folk, stjerner, kontrakter og relasjoner flyttes, men ikke kontantene. Det oppkjøpte firmaet får `acquiredBy` og `bankrupt = true` (ute av markedet), men ingenting legges ut på anbud igjen.
  - **Børsnotering** (nivå 5): kontanter for en andel av selskapet. Etterpå teller `valuation` bare eiernes andel, og hvert kvartal sammenlignes med det forrige (`ipoPressure`).
  - Bare spilleren bruker dette i dag; AI-planleggeren gjør det ikke. Balansen måles med `humanStrategic`-variantene i simulatoren.
- **Kontrakthandlinger (`engine/contractActions.ts`, `ui/screens/ContractActions.tsx`):** Knappen «Handlinger» på hver kontrakt.
  - **Kundepleie** (nivå 1): koster penger og løfter tilfredsheten, men aldri over `NURTURE_MAX_SATISFACTION`. Den har nedkjøling og er ment som redning, ikke som fast kvartalsrutine. Kvartalslista (`nurture`) flagger kontrakter under `NURTURE_TODO_BELOW` når pleie er mulig.
  - **Oppsigelse** (nivå 1): bruddgebyr på ett kvartals omsetning, tap av omdømme og relasjon. Kontrakten får `cancelled`, stjernene blir ledige, og svindel som pågår på kontrakten slutter å kunne oppdages.
  - **Reforhandling** (nivå 2): én gang per kontrakt, etter minst ett kvartal med leveranse. Sjansen (`renegotiateChance`) øker med tilfredshet og relasjon og faller med kundens prisvekt.
  - **Mersalg** (nivå 3): bare prosjekter (rammeavtaler styres av avrop). Setene fakturerer fra samme kvartal, innenfor nivåets `maxSeats`, med nedkjøling.
  - Et nei fra kunden er et **utfall**, ikke en feil. Handleren returnerer `undefined`, så straffen og det brukte forsøket blir stående. En feilnøkkel ville fått `applyAction` til å kaste draften. Utfallet trekkes fra `state.rng` i reduceren (som `afterwork_poach`), og autolagringen hindrer nytt forsøk ved å laste inn på nytt.
  - `contractMoveBlock` er felles for reducer, planleggere og UI. AI-er og `planHumanProxy` bruker `ai/contractMoves.ts`: pleie ved fare, reforhandling når sjansen er høy og mersalg bare med folk på benken. Ingen av dem sier opp.
- **Kriser (`content/crises.ts`, `engine/crises.ts`):** Omtrent én krise hvert 3.–4. kvartal (`CRISIS_CHANCE`, `CRISIS_GAP`), aldri mens firmaet har negativ kasse utover kreditten. En krise går over flere kvartaler, og alvorlighetsgraden er skjult til en fase avslører den. Valg kan koste penger, ta folk av oppdrag dette kvartalet (`Firm.benched`, som `staffFirm` trekker fra), sette en krisesamtale i gang, eller dysse saken ned. Da kan den sprekke senere (`CRISIS_EXPOSE_CHANCE`). En ubesvart fase tar et gratis reservevalg, som ofte gjør saken verre. UI: `CrisisModal` dukker opp én gang per ny fase, `CrisisPanel` på oversikten følger alle kriser, og gjøremålslista har punktet `crisis`. Bakgrunn og beslutninger: [`plans/2026-09-24-kriser.md`](plans/2026-09-24-kriser.md).
- **Mål per nivå (`content/missions.ts`, `engine/missions.ts`):** Frivillige mål som vises fra et gitt nivå, med en liten belønning i samme effekt-DSL som hendelsene. Bare spilleren har mål (som gjøremålslista), og de legges aldri i `quarterTodos`.

### Tilfeldighet: den viktigste regelen

`state.rng` muteres av `nextFloat` og vennene. Derfor gjelder dette:

- **Bare motoren på en draft skal trekke fra `state.rng`.** UI-et skal aldri kalle en funksjon som bruker den. Da endres fremtiden hver gang en komponent rendres, og det blir ulikt etter innlasting.
- Funksjoner som UI-et bruker (`bidQuality`, `bidScoreEstimate`, `employeeThoughts` og lignende) er rene, og en test sjekker at de ikke rører `state.rng`.
- Minispillene har sin egen hash-baserte RNG: `createRng(hashString(tenderId + firmId))` i `minigames.ts`.

## UI-et

- **React 19 + Zustand.** `useGame` i `store/gameStore.ts` holder `game: GameState`, hvilken skjerm og fane som vises, åpne modaler og innstillinger.
- **`dispatch(action)`** kaller `applyAction`, lagrer til `auto`-plassen og oppdaterer staten. **`endTurn()`** kaller motoren, autolagrer og åpner kvartalsrapporten.
- **Skjermer:** `App.tsx` velger mellom menyene (`Menus.tsx`: hovedmeny, nytt spill, last inn, innstillinger, om spillet) og `Shell`. `Shell` inneholder toppfeltet, fanene, tickeren, «Avslutt kvartal» og alle modalene i spillet.
- **Styling:** CSS Modules og design-tokens i `ui/theme/tokens.css`.
  - Mørkt tema er standard, og det lyse ligger under `:root[data-theme='light']`.
  - Bruk tokens (`var(--accent)` osv.), ikke hardkodede farger.
  - Fontene ligger i appen via `@fontsource` (bare latin-delsettet), importert i `main.tsx`: «Press Start 2P» bare i logoen, «Bungee» i overskrifter og på store knapper, «IBM Plex Sans» i brødtekst og «IBM Plex Mono» for tall (`--font-mono`, klassen `.num`).
  - Uttrykket skal være retro, men rolig: avrundede hjørner (`--radius`), myke skygger og få harde kanter. Piksler hører hjemme i illustrasjonene (ikoner, kontoret, portretter), ikke i tekst og UI-elementer.
- **Gjøremålslista:** `quarterTodos()` (`engine/todos.ts`) gir noen få punkter per kvartal, og «Avslutt kvartal» (knappen og `Enter`) spør først om noe står igjen. Hvert punkt må kunne løses **dette kvartalet med én konkret handling**, ellers blir advarselen mas. Tersklene står i `constants.ts` (`TODO_*`). Spillerboten `human` skal nesten aldri få advarselen, så sjekk nye punkter med `planHumanProxy` over noen partier.
- **Ikoner:** Pikselikonene i `components/Icon.tsx` er 8×8 ASCII-bitmaps (`#` = fyll, `o` = aksentfarge). Nye ikoner legges til rett i objektet `ICONS`. Ikke bruk emoji i UI-et.
- **Lyd:** `ui/sound.ts` syntetiserer små 8-bit-effekter med Web Audio, uten lydfiler. Kall `playSound('win')` osv. fra UI-et.
  - Nye lyder er en liste med toner i `SOUNDS`: frekvens eller glidning, start, varighet og bølgeform.
  - Lyden respekterer innstillingene `sound` og `soundVolume`, og er en no-op der Web Audio mangler (tester, gamle nettlesere).
  - `AudioContext` lages først ved første avspilling, fordi nettleserne krever et brukerklikk.
  - Samme lyd to ganger innen 80 ms blir ignorert (React StrictMode).
- **Tilgjengelighet:**
  - Modaler fanger fokus og lukkes med Escape (bare den øverste).
  - Målere har `role="meter"`.
  - `prefers-reduced-motion` og innstillingen «Redusert bevegelse» slår av animasjoner.
  - Tastatursnarveier: `Enter` avslutter kvartalet, og tallene `1`, `2`, `3` … bytter mellom fanene som er synlige.
- **Mobil:** Layouten fungerer ned til 360 px bredde.

## Tekster og språk (i18n)

Motoren sender **aldri** ferdig tekst, bare nøkler og parametere, for eksempel `NewsItem { key: 'news.tender.playerWon', params: { customer: 'navet' } }`. UI-et oversetter.

Tekstene ligger i `src/i18n/locales/{nb,en}/`, fordelt på fire namespaces:

| Namespace | Innhold |
|---|---|
| `ui` | Alt UI-et selv viser: knapper, overskrifter, forklaringer, styreleder Bjørn |
| `game` | Alt motoren sender: `errors.*`, `news.*`, `events.*`, `crises.*`, `factors.*`, `announcements.*`, `thoughts.*` |
| `content` | Navn og beskrivelser av entiteter: firma, kunder, trender, traits, bakrommet, priser, mål, sluttitler |
| `minigames` | Buzzwords, møtespørsmål og svar, krisesamtaler, tekster i minispillene |

Praktisk:

- Ekstra namespaces bruker du med prefiks: `t('content:customers.navet.name')`, `t('game:news.…')`.
- Parametere som er id-er, oversettes automatisk i `ui/format.ts` (`resolveParams`/`newsText`):
  - `customer` blir kundenavnet
  - `trend` blir trendnavnet
  - `discipline` blir fagområdet
  - `fine` blir et formatert beløp
  - `mission` blir navnet på målet
  - `crisis` blir krisens tittel
  - `weak` og `strong` blir setningene om hvorfor et bud vant eller tapte (`game:factors`)

  Bruk disse parameternavnene når motoren skal referere til slike ting.
- Flertall: i18next bruker suffiksene `_one` og `_other` sammen med `count`.
- **`src/i18n/i18n.test.ts`** krever at `nb` og `en` har nøyaktig de samme nøklene. Testen sjekker også at alle id-er i `src/content` har tekst. Legger du til innhold uten tekst, feiler testen.

**Tone:** Tørr, varm og litt absurd, aldri slem. Hold det til maks én vits per skjerm, og la tall og knapper være nøkterne. Den engelske teksten skal være idiomatisk, ikke oversatt ord for ord. Parodiene på ekte konsulenthus skal være snille.

## Lagring og migrasjoner

- `save.ts` lagrer til `localStorage` under `kt.save.<plass>` og `kt.meta.<plass>`. Plassene er `auto`, `1`, `2` og `3`.
- Autolagring skjer etter **hver** handling og hvert kvartal. Da mister man aldri bud, og man kan ikke laste siden på nytt for å spille et minispill en gang til.
- All tilgang til lagring er pakket i `try/catch`. Spillet fungerer også i privat modus, bare uten lagring.
- Hver lagret state har `saveVersion`. **Når formen på `GameState` endres etter en lansering**, gjør du dette:
  1. Øk `SAVE_VERSION` i `constants.ts`.
  2. Legg til `migrations[gammelVersjon] = (s) => ({ ...s, nyttFelt: standard })` i `save.ts`.
  3. Skriv en test for migrasjonen i `save.test.ts`.

  Før første lansering holder vi `SAVE_VERSION = 1`. Nye felt gjøres valgfrie med en fornuftig standardverdi (se `baseDemand`).
- Etter eventuelle migrasjoner sjekker `saveShape.ts` at alle påkrevde felt finnes. Lister over påkrevde nøkler håndheves av typesjekken, så et nytt påkrevd felt må også legges inn der. Ved oppstart sletter `purgeIncompatibleSaves` lagringer som ikke kan leses (feil form, ødelagt JSON eller manglende migrasjon), og hovedmenyen sier fra om at spillet må startes på nytt. Lagringer fra en *nyere* versjon (`save.tooNew`, for eksempel fra en gammel service worker) blir aldri slettet.

## PWA (installerbar app)

Spillet er en Progressive Web App via `vite-plugin-pwa` (konfigurert i `vite.config.ts`).

- **Offline:** Service workeren legger alt i cache (JS, CSS, HTML, ikoner og fonter), så spillet virker uten nett. Det er ingen eksterne kall: fontene er lagt inn i appen, og lagringen skjer lokalt.
- **Manifest:** Navn, farger og ikoner er definert i `vite.config.ts`. Ikonene genereres fra `public/icon.svg` med `npm run icons` (`pwa-assets.config.ts`, skarp skalering for pikselkunst). Kjør kommandoen igjen etter at du har endret ikonet, og commit PNG-filene.
- **Oppdateringer:** `registerType: 'prompt'`. Når en ny versjon er klar, viser `ui/pwa/PwaPrompt.tsx` et varsel med «Oppdater nå». Vi oppdaterer ikke automatisk, fordi en ny innlasting midt i et minispill ville brukt opp forsøket.
- **Installering:** `ui/pwa/install.ts` fanger `beforeinstallprompt` (Chromium) og viser «Installer spillet» i hovedmenyen. På iOS Safari finnes ingen slik hendelse, så der vises et hint om «Del → Legg til på Hjem-skjerm».
- **Utvikling:** Service workeren er bare aktiv i bygget. Test PWA-oppførselen med `npm run build && npm run preview`. Under `npm run dev` er den av, så cachen ikke skaper forvirring.
- **Publisering:** Spillet publiseres på Vercel (`vercel.json`). `vercel.json` setter cache-headere slik at `sw.js` ikke caches for hardt. Ellers kommer ikke oppdateringer frem.

## Innhold: slik legger du til ting

Alt innhold er data i `src/content/` pluss tekster på to språk. Etter en endring kjører du `npm test`, og i18n-testen forteller deg hva som mangler.

**Ny hendelse** (`content/events.ts`):

```ts
{ id: 'team_offsite', weight: 1, cooldown: 6, minQuarter: 4,
  condition: ({ headcount }) => headcount >= 15,
  choices: [
    { id: 'go', effect: { cashPerHead: -8_000, sosialt: 6 } },
    { id: 'skip', effect: { morale: -2 } },
  ] }
```

Legg så til `events.team_offsite.{title, body, choices.go, choices.skip}` i `game.json` for både `nb` og `en`.

- Effekt-DSL-en (`Effect`) støtter `cash`, `cashPerHead`, `reputation`, `heat`, `fagmiljo`, `sosialt`, `morale`, `brand`, `salaryPremium`, `relationship`, `starLoyalty`, `starPremium` og `special`. Spesialhandlerne ligger i `engine/events.ts`.
- `params` kan velge en kunde (`activeCustomer`), en stjerne (`someStar`) eller en rival (`someRival`) som tekstene kan referere til.
- `cooldown: Infinity` gir en hendelse som bare skjer én gang.

**Ny krise** (`content/crises.ts`): En krise går over flere kvartaler, med skjult alvorlighetsgrad (`highChance`) som trekkes ved start. Den består av faser (`stages`), og hver fase har valg:

```ts
{ id: 'coffee_strike', category: 'hr', minLevel: 1, weight: 1, cooldown: 12, highChance: 0.4,
  stages: [
    { id: 'strike', choices: [
      { id: 'new_machine', effect: { cash: -80_000, sosialt: 4 }, outcome: 'good' },
      { id: 'wait', effect: {}, next: 'verdict', fallback: true },
    ] },
    { id: 'verdict', reveals: true, onEnter: { high: { leavers: 1 } }, choices: [
      { id: 'shrug', effect: {}, outcome: { low: 'good', high: 'bad' }, fallback: true },
    ] },
  ] }
```

- Et valg med `next` åpner neste fase kvartalet etter. Uten `next` avsluttes krisen med `outcome`. `bury: true` legger saken i skuffen, og da kan den sprekke senere som fasen `exposed` (felles for alle kriser).
- Hver fase har nøyaktig ett `fallback`-valg per alvorlighetsgrad. Det brukes når spilleren ikke svarer, og det skal aldri koste penger eller ha krav (`needs`).
- Faser med `reveals: true` viser den ekte alvorlighetsgraden. Bare der kan valg ha `only: 'low' | 'high'`. I faser som ikke avslører, kan valg med `next` ikke ha `low`/`high`-effekter, siden tallene ellers røper hvor ille det er.
- Effekt-DSL-en (`CrisisEffect`) har hendelsenes felt, og i tillegg `satisfaction`, `satisfactionAll`, `rateCut`, `contractRevenue`, `bench` (andel folk av oppdrag dette kvartalet), `benchStar`, `loseStar`, `leavers`, `hires`, `terminate` og `scandal`.
- `talk: 'press' | 'townhall' | 'client'` gjør valget til en krisesamtale (minispill). Poengsummen gir `talkGood` eller `talkBad` i tillegg.
- `scope: 'market'` treffer alle firma samtidig og starter en `trend` med `crisisOnly: true`.
- AI-firmaene får egne kriser (`CRISIS_AI_CHANCE`), men rammes med `CRISIS_AI_IMPACT`. De svarer gjennom `ai/crises.ts`. Lysten til å dysse ned regnes ut fra personligheten (`CRISIS_AI_HUSH`), og sakene deres sprekker oftere (`CRISIS_AI_EXPOSE_FACTOR`). Det blir sladder i nyhetsstripen.
- Tekster i `game.json`: `crises.<id>.title` og `gossip` (eller `news` for markedskriser), og per fase `<fase>.body` (eller `body.low`/`body.high` når fasen avslører) og `<fase>.choices.<valg>`. Kategorinavnet ligger i `ui:crisis.categories`. `engine/crises.test.ts` sjekker at krisen henger sammen, og i18n-testen sjekker tekstene.

**Andre typer innhold:**

- **Nytt konkurrentfirma:** Legg det til i `content/firms.ts` (id, arketype, antall ansatte, omdømme, farger). Legg også til `firms.<id>.tagline` og `.blurb` i `content.json`.
- **Ny kunde:** Legg den til i `content/customers.ts` (sektor, budsjett, møtepreferanse, prisvekt, foretrukne fagområder, vekt og ønsket oppstart `wants`). Legg også til `customers.<id>.name` og `.blurb`.
- **Ny trend:** `content/trends.ts` (etterspørsel per fagområde, volum og prisvekt).
- **Ny trait:** `content/traits.ts` (modifikatorer).
- **Ny høyttalermelding:** `content/announcements.ts` (valgfri betingelse).
- **Nytt buzzword:** `content/buzzwords.ts`.
- **Ny ansatt-tanke:** Øk `variants` for utløseren i `content/thoughts.ts`, og legg til teksten som `thoughts.<id>.<nummer>` i `game.json`. En ny utløser trenger også en betingelse i `employeeThoughts` (`engine/flavor.ts`). Hvilken variant som vises, avhenger av firma og kvartal, ikke av `state.rng`. Bland det realistiske og det litt absurde.
- **Nytt krisesamtalespørsmål:** `content/crisisTalks.ts`, med ett svar per stil (`candid`, `caring`, `facts`, `spin`) i `minigames.json` (`crisisTalk.<type>.questions.<id>.a.<stil>`). Publikum har en skjult favorittstil (`TALK_PREFERENCE_WEIGHTS` i `constants.ts`) og hater den motsatte (`OPPOSITE_TALK_STYLE`). Hver stil trenger et hint i `crisisTalk.<type>.clues.<stil>`. Hvert svar må være lett å kjenne igjen som sin stil.
- **Nytt møtespørsmål:** `content/meetingQuestions.ts`, med fire svar (ett per møtestil) i `minigames.json`. Hvert svar må være lett å kjenne igjen som sin stil, siden spilleren skal lese hva kunden liker. Spørsmål som bare passer for offentlige eller private kunder, merkes i `QUESTION_SECTOR`.
- **Ny lyssky handling:** Legg den til i `ShadyActionId` (`types.ts`) og `SHADY_CATALOG` (`shady.ts`) med en `minLevel`, og skriv effekten i `handleShady`. Du trenger også tekstene `content:shady.actions.<id>` og `game:news.scandal.<id>`.

## Balansering og simulator

**Alle tall ligger i `src/engine/constants.ts`.** AI-personlighetene ligger i `engine/ai/personalities.ts`.

```bash
# Spillerboter: human og variantene i HUMAN_VARIANTS (scripts/sim.ts),
# spam, og idle, balanced, greedy og shady (PLAYER_BOTS i personalities.ts)
npm run sim -- --games 60 --strategy human,humanPro
npm run sim -- --games 30 --strategy human --difficulty easy
npm run sim -- --games 50 --json          # rådata til sim-output/

# AI-markedet alene i 40 kvartaler
npm run sim:market -- 20 -v
```

Simulatoren skriver ut en tabell per år (kontanter p10/median/p90, antall ansatte, omsetning, trivsel, omdømme, heat og etterspørsel/kapasitet). Den viser også konkursrate, rangering, verdi, når nivåene nås og hvilke AI-er som går konkurs.

Botene `human*` spiller som et fornuftig menneske (`ai/humanProxy.ts`). `humanStrategic` og variantene bruker Strategi-fanen, og `spam` sender gratis bud på alt for å teste utnyttelse av reglene. Mål og siste status står i [`balance-log.md`](balance-log.md).

Slik jobber du med balansen:

1. Hold et fast sett med seeds og endre **én** ting per kjøring.
2. Kjør minst 30–60 partier, ellers drukner effekten i støy (±5 av 60).
3. Fiks AI-markedet (`sim:market`) før du justerer spilleropplevelsen.
4. Loggfør hver endring og hvert resultat i `docs/balance-log.md`.
5. Se etter strukturelle årsaker før du justerer tall. De største forbedringene hittil har kommet fra mekanikker (eksogen etterspørsel, fleksbemanning, forlengelse), ikke fra justering av konstanter.

Botene er grovere enn en ekte spiller. De bruker for eksempel ikke bakrommet eller innsyn. Test derfor alltid i nettleseren også.

## Testing

- **Vitest.** Testene ligger ved siden av koden (`*.test.ts`).
  - **Motortestene** kjører i Node.
  - **UI- og store-tester** som trenger DOM, starter med kommentaren `// @vitest-environment jsdom`.
- `src/engine/testUtils.ts` har `newTestGame(seed)` og `deepFreeze()`. `deepFreeze` fanger mutasjoner av input. Nivålåste funksjoner testes med `veteranTestGame()`.
- **Mønster for tilfeldige utfall:** Sett sannsynligheten til 0 eller 1 i testen (se `shady.test.ts`, som endrer `SHADY_CATALOG[...].baseDetection` og tilbakestiller i `afterEach`). Du kan også prøve noen seeds.
- **Ting som alltid skal være testet:**
  - determinisme (samme seed gir samme state)
  - at input ikke muteres
  - at lagring, innlasting og `endTurn` gir samme resultat som uten lagring
  - at UI-hjelpere ikke rører `state.rng`
  - i18n-paritet
- **Ende-til-ende i nettleser:** Det finnes ikke noe Playwright-oppsett i repoet. Start `npm run dev` og klikk deg gjennom et parti: nytt spill, alle faner, et bud med minispill, noen kvartaler og sluttskjermen. Sjekk konsollen for feil.

## Konvensjoner og fallgruver

- **Ingen tall i modulene.** Legg nye balansetall i `constants.ts` med et navn og en kommentar.
- **Ingen tekst i motoren.** Motoren sender i18n-nøkler og id-er, og UI-et oversetter.
- **Ikke bruk `state.rng` utenfor motoren**, se [Tilfeldighet](#tilfeldighet-den-viktigste-regelen).
- **Ikke importer Vite-spesifikke ting** (`import.meta.glob`, `?raw` o.l.) i `src/engine` eller `src/content`, ellers slutter simulatoren å virke.
- **TypeScript er strict**, med `noUnusedLocals` og `noUnusedParameters`. `scripts/` typesjekkes også, så hold dem rene.
- **`erasableSyntaxOnly` er på.** Bruk union-typer og `as const`, ikke `enum` eller parameter properties.
- **Ytelse:**
  - `endTurn` bør ta under ~20 ms. Én kloning per tur, `applyActionInPlace` inne i motoren.
  - `Firm.history` avkortes til 12 kvartaler, nyhetsloggen til 200 innslag, og gamle anbud og kontrakter ryddes bort etter ett år.
- **Parodinavn:** Snille ordspill på ekte konsulenthus. `parodyOf` i `firms.ts` er bare en kodekommentar og skal aldri vises i UI-et.

## Kjente mangler

- Det finnes bare noen få tester for UI-komponentene.
- Åpne designspørsmål (sluttrangering, AI og strategi) står i [`spilldesign.md`](spilldesign.md#åpne-spørsmål-og-mulige-neste-steg).
