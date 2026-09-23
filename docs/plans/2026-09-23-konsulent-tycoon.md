# Konsulent Tycoon – implementeringsplan

> **For Claude:** REQUIRED SUB-SKILL: Bruk `executing-plans` for å implementere planen oppgave for oppgave.

**Mål:** Et turbasert, retro strategispill i nettleseren der du bygger et IT-konsulentselskap i 40 kvartaler, konkurrerer om anbud og rammeavtaler mot AI-selskaper, bygger fag- og sosialt miljø, rekrutterer og beholder folk, og kan jukse deg til toppen hvis du tør.

**Arkitektur:** Spillmotoren er ren TypeScript uten React- eller DOM-avhengigheter: `applyAction(state, action) → state` og `endTurn(state) → state`. All tilfeldighet kommer fra en seeded RNG som ligger i state. Spilleren og AI-selskapene er samme `Firm`-type og bruker samme action-API. React-UI-et leser state og sender actions. Motoren sender aldri ferdig tekst, bare i18n-nøkler med parametere. En headless simulator (`npm run sim`) spiller hele partier med bot-strategier for balansering.

**Tech stack:** Vite + React 19 + TypeScript (strict), Vitest, i18next + react-i18next, Zustand (tynn store rundt motoren), CSS Modules med design-tokens, Google Fonts («Press Start 2P» til titler og «Pixelify Sans» til brødtekst), tsx til sim-skriptet. Lagring skjer i localStorage.

---

## 0. Designbeslutninger (standardvalg du kan overstyre)

| Tema | Valg |
|---|---|
| Tur | 1 tur = 1 kvartal. Spillet starter Q1 2027 og slutter etter Q4 2036 (40 turer). |
| Seier | Høyest **selskapsverdi** ved slutt. Verdien er EBITDA for de siste 4 kvartalene × multippel (4–8, styrt av omdømme) + kontanter. Resultatet rangeres mot AI-ene, og spilleren får en «tittel» (f.eks. «Bransjens Bekkerson», «Kjøpt opp for en slikk og ingenting»). |
| Tap | Negative kontanter to kvartaler på rad gir konkurs og game over. |
| Stil | Moderne retro: pixelfonter, begrenset palett, CRT-aktig mørkt tema (med lyst alternativ), moderne responsiv layout og subtile animasjoner. Ingen lyd i v1. |
| Språk | Bokmål (`nb`, standard) og engelsk (`en`). All tekst ligger i locale-filer. |
| Konkurrenter | 24 AI-firma, alle kjærlige parodier (se §0.1). Fire av dem er **hovedrivaler** med egne personligheter: **Bekkerson** (fagnerder, høy kvalitet, høy pris), **Accentura** (stor, dyr, aggressiv poaching), **Knowit-All** (bred, middels på alt, liker oppkjøp) og **Sopp Steria** (billig, glad i stille outsourcing). De 20 andre er nordiske hus som bygger på arketyper. |
| Kunder | Parodier på offentlige og private kunder: *NAVet*, *Skatteetat'n*, *Statens Veivesen*, *Helse Sør-Øst-Vest*, *DNBank*, *Equinær*, *Kommune-Norge IKS*, *Posten & Bring-meg*, *Fintech-startupen Kryptonitt*. |
| Fagområder | `frontend`, `backend`, `cloud`, `data`, `design`, `architecture`, `pm` |
| Ansatte | Hybridmodell. Anonyme **pools** per fagområde har antall, snittnivå (1–5) og trivsel (0–100). I tillegg finnes **stjernekonsulenter** med navn, traits, ambisjon og lojalitet. |
| Lagring | 3 manuelle slots og autosave hver tur. Save-filen har `saveVersion` og migrasjoner. |

### 0.1 Konkurrentene

Alle navnene er snille ordspill på ekte nordiske konsulenthus. Ingen av firmaene skal fremstilles som kriminelle eller dumme, bare litt karikerte. Spilleren er den eneste som *må* jukse. AI-ene gjør det sjeldnere og mer tøysete. I footeren og på «Om»-siden står det: «Alle likheter med virkelige selskaper er helt tilfeldige (og kjærlig ment).»

**Arketyper:**

| Arketype | Beskrivelse |
|---|---|
| `boutique_nerd` | lite, høy kvalitet, høy pris |
| `boutique_design` | design/frontend-tungt |
| `mid_generalist` | middels på alt |
| `nordic_giant` | stort, bredt, billig til middels, byr på alt |
| `budget_bulk` | billig og mange |
| `specialist_cloud` / `specialist_data` | nisjespesialister |

**Hovedrivaler:**

| Navn | Parodi på | Land | Arketype / personlighet | Hoder ved start | Tagline (nb) |
|---|---|---|---|---|---|
| Bekkerson | Bekk | NO | egen: fagnerd | 35 | «Vi har en faggruppe for det.» |
| Accentura | Accenture | global | egen: aggressiv | 60 | «Vi har en deck for det.» |
| Knowit-All | Knowit | SE/NO | egen: generalist + oppkjøp | 45 | «Vi kan alt. Spør oss.» |
| Sopp Steria | Sopra Steria | FR/NO | egen: budsjett + skyggeoutsourcing | 50 | «Vokser best i mørket.» |

**De 20 nordiske husene (`src/content/firms.ts`):**

| # | Navn | Parodi på | Land | Arketype | Hoder | Tagline (nb) |
|---|---|---|---|---|---|---|
| 1 | Kompottas | Computas | NO | mid_generalist | 40 | «Alt blir bedre med litt syltetøy.» |
| 2 | Itera Igjen | Itera | NO | mid_generalist | 30 | «Vi gjør det én gang til. Og én til.» |
| 3 | Smiles | Miles | NO | boutique_nerd | 25 | «Verdens gladeste konsulenter (egenrapportert).» |
| 4 | Webstepdans | Webstep | NO | mid_generalist | 35 | «Fem, seks, sju, åtte – deploy!» |
| 5 | Kantegne | Kantega | NO | boutique_design | 20 | «Vi tegner det først. På tavla. Lenge.» |
| 6 | TietoEvig | Tietoevry | NO/FI | nordic_giant | 120 | «Prosjektet ditt varer evig. Det gjør vi også.» |
| 7 | Bouffet | Bouvet | NO | nordic_giant | 90 | «Forsyn deg. Alle fagområder på ett bord.» |
| 8 | Invariant | Variant | NO | boutique_nerd | 15 | «Samme høye kvalitet, uansett input.» |
| 9 | Reiterate | Iterate | NO | boutique_nerd | 12 | «Har du prøvd å skru det av og på igjen?» |
| 10 | Geita | Capra | NO | specialist_cloud | 18 | «Vi klatrer dit andre ikke kommer.» |
| 11 | Fargestift | Crayon | NO | specialist_cloud | 40 | «Vi fargelegger skyregningen din.» |
| 12 | Kapp & Gjemini | Capgemini | FR/NO | budget_bulk | 70 | «Kappen på, tallene gjemt.» |
| 13 | Nattlys | Netlight | SE | boutique_nerd | 30 | «Vi lyser opp de mørkeste backlogger.» |
| 14 | Hikke-Q | HiQ | SE | mid_generalist | 35 | «Hikk! Vi mener: høy IQ.» |
| 15 | Riddertech | Knightec | SE | specialist_data | 25 | «Til hest mot teknisk gjeld.» |
| 16 | Rektor | Reaktor | FI | boutique_nerd | 20 | «Møt opp på kontoret mitt. Med en god PR.» |
| 17 | Futuriis | Futurice | FI | boutique_design | 25 | «Framtiden, servert med ris.» |
| 18 | Solitær | Solita | FI | specialist_data | 25 | «Vi spiller best alene, men leverer i team.» |
| 19 | Trigaffel | Trifork | DK | specialist_cloud | 20 | «Tre tinder. Null spagettikode.» |
| 20 | Nettkompaniet | Netcompany | DK | nordic_giant | 80 | «Offentlig sektor? Vi har lest anbudsloven. To ganger.» |

Taglines og beskrivelser ligger i locale-filene (`content.firms.<id>.tagline` / `.blurb`). Firmadataene har `id`, `parodyOf` (bare i en kodekommentar, ikke i UI), `country`, `archetype`, `startHeadcount`, `startReputation` og `colors` (2 palettfarger til pixel-glyphen).

**Konsekvenser av 25 firma:**
- **Anbudsvolum skalerer med markedet:** `antall anbud per kvartal = clamp(round(markedsHoder / 60), 6, 20)`. I tillegg styres setene slik at total etterspørsel holder seg rundt 75–85 % av markedets kapasitet. Simulatoren rapporterer dette.
- **AI-er byr bare der de passer:** Et firma byr bare på anbud der setene er ≤ 60 % av egen kapasitet i relevante fagområder, så boutiquene tar de små og gigantene de store. Hvert AI-firma kan ha maks 3 åpne bud samtidig.
- **Ytelse:**
  - `applyAction` kloner state. `runAiTurns` bruker derfor en intern `applyActionInPlace(draft, action)` på én felles draft, slik at det ikke blir 100+ kloner per tur.
  - `Firm.history` avkortes til de siste 12 kvartalene. I tillegg lagres en egen `valuationHistory: number[]` for sluttgrafen.
  - **Mål:** `endTurn` under 20 ms. `npm run sim -- --games 200` skal ta under ett minutt.
- **Marked-skjermen:** Viser topp 10 og spillerens plass, med «Vis alle 25». Den kan filtreres på land og arketype.

### 0.2 Tone og stemning

Stemningen er inspirert av Theme Hospital og RollerCoaster Tycoon, men dempet. Tørr, varm og litt absurd humor, aldri slem og aldri memes.

- **Tonen:** Spillet tar seg selv helt seriøst, og det er det som er morsomt. Hold det til maks én vits per skjerm eller dialog, og la tallene og knappene være nøkterne. Skriv på naturlig bokmål som bransjefolk kjenner igjen, uten engelske hashtags. Engelsk oversettelse er idiomatisk, ikke ordrett.
- **Høyttaleranlegget (à la Theme Hospital):** Innimellom dukker det opp en liten meldingsstripe øverst, f.eks. «Vil konsulent Kjetil vennligst ta med seg koppen sin fra møterom Fjordgløtt.» og «Minner om at fredagspilsen i dag er alkoholfri. Ingen vet hvorfor.» Maks én per kvartal, og den kan slås av. Innholdet ligger i `src/content/announcements.ts` (minst 30), og noen av meldingene avhenger av betingelser (f.eks. lav trivsel eller høy heat).
- **Tankebobler (à la RCT-gjester):** Ansatte-skjermen har en «Hva tenker folka?»-feed med 3–5 korte tanker generert fra state, f.eks. «Jeg har ikke fakturert på 3 uker og begynner å kjede meg.», «Fagdagen var faktisk bra.», «Hørte Accentura har sushi-fredag…». Tankene fungerer samtidig som en diskret hjelpetekst om hva som påvirker trivselen. De genereres av en ren funksjon `employeeThoughts(state, firmId)` og vises uten RNG i UI-et, deterministisk ut fra state.
- **Årets priser (à la Theme Hospital):** Etter Q4 hvert år kommer en liten prisutdeling i en modal med pokal-pixelart. Eksempler:
  - «Årets fagmiljø» (+omdømme)
  - «Mest kreative timeføring» (går til firmaet med høyest heat)
  - «Bransjens beste kaffemaskin»
  - «Årets anbudsvinner»
  - «Årets Glassdoor-katastrofe»

  Prisene går til AI-er og spilleren på lik linje. Logikken ligger i `awards.ts` (ren funksjon med test), og vinnerne loggføres i nyhetene.
- **Kontoret:** Dashboardet har et lite pixel-kontor (CSS-grid med SVG-tiles) der pultene fylles etter antall ansatte, og det blir flere etasjer og nye rom (kantine, fagrom, sofakrok, pingpong) etter hvert som kultur-nivåene stiger. Det er bare pynt og ikke klikkbart i v1. En figur som går rundt og en kaffemaskin som damper er nok animasjon, og begge slås av med `prefers-reduced-motion`.
- **Rådgiveren:** «Styreleder Bjørn» er rådgiveren, med små portretter og korte kommentarer i kvartalsrapporten og ved viktige øyeblikk. Han sier aldri mer enn 1–2 setninger.
- **Visuelt:**
  - Varme, litt mettede farger med tykke pixel-kanter og knapper som «trykkes ned» (translate 2px og mindre skygge).
  - Små lydløse «pling»-animasjoner når du vinner et anbud: konfetti i 6–8 pixels, maks 600 ms.
  - Tall formateres pent. Ikke bruk emoji i UI-et, bruk heller egne pixel-ikoner (inline SVG).

---

## 1. Spillmodell (referanse for alle oppgaver)

> **Endringer etter første balanserunde (2026-09-23).** Disse gjelder foran tallene lenger ned, og `src/engine/constants.ts` er fasit.
> - **Kassekreditt:** Du kan gå i minus ned til `max(2 MNOK, 12,5 % av årsomsetningen)`, med 3 % rente per kvartal. Konkurs inntreffer først etter 2 kvartaler under grensen.
> - **Kapasitetsstraff:** Straffen avhenger av hvor mange **ledige** folk du har når oppdraget starter. Opptil halvparten av setene kan komme fra underleverandører uten straff. Deretter øker straffen lineært til −30 kvalitet.
> - **Prioritetsbonus:** Kunden gir +8 poeng (eller +4) når oppdraget utgjør ≥ 25 % (eller ≥ 10 %) av firmaets størrelse. Dermed har små firma en sjanse på små anbud.
> - **Frilansere:** De faktureres på nivå 3 og koster 1,05 × det, så de gir et lite tap i stedet for et stort.
> - **Startprosjektet:** 4 seter i 6 kvartaler (grunnleggerne pluss to), slik at to personer er ledige til første anbud.
> - **Anbudsvolum:** Målet er at etterspørselen tilsvarer 92 % av markedskapasiteten. Størrelsene følger en fast fordeling, antallet styres av gapet, og fagområdene vektes etter hvilke folk markedet har.
> - **Timer og overhead:** 420 fakturerbare timer per kvartal og 30 000 kr i overhead per hode.
> - **Etterspørsel utenfra:** Markedet etterspør `startkapasitet × 0,85 × 1,05^år × trend`, uavhengig av hvor mange konsulenter som gjenstår. Kontraktene til konkursfirma legges ut på nytt som anbud.
> - **Forlengelse:** Prosjekter med kundetilfredshet på minst 60 kan forlenges med 2–4 kvartaler uten nytt anbud. Sjansen er `0,5 × tilfredshet/80`.
> - **Fleksbemanning:** Ledige folk dekker manglende seter i andre fagområder før frilansere hentes inn. De faktureres på nivå 2,2 og trekker kundetilfredsheten litt ned.
> - **Spillerens start:** Omdømme 40, fagmiljø 35, sosialt 30 og relasjon 25 til alle kunder (45 til Kryptonitt). Faste kostnader er 90 000 kr per kvartal.
> - **Minispill:** Når du starter et minispill, registreres det som et forsøk med score 0 (foreløpig). Det kan erstattes én gang av det ferdige resultatet. Autolagring skjer etter hver handling.
> - **Småoppdrag:** 3–5 anbud per kvartal på 1–2 konsulenter i 1–3 kvartaler, i tillegg til den vanlige etterspørselen. AI-er og bot vekter anbud etter hvor mye ledig kapasitet de fyller.
> - **AI-marked:** 0,1–0,4 konkurser per 40-kvartalers parti. Se `docs/balance-log.md` og `npm run sim:market`.


### 1.1 Økonomi (per kvartal)
- **Fakturerbare timer per konsulent:** 400
- **Listepris per time:** `900 + 200 × nivå` NOK (nivå 3 gir 1 500)
- **Lønn per år:** `600 000 + 150 000 × nivå` × `(1 + salaryPremium)`. Arbeidsgiverkostnad ×1,3, delt på 4 per kvartal.
- **Omsetning per kontrakt:** `Σ bemannede seter × 400 × listepris(nivå) × rateMultiplier`
- **Overhead:** 40 000 per hode (kontor, lisenser osv.), pluss budsjettene for fagmiljø og sosialt, pluss rekrutteringskostnad på 50 000 per ansettelse
- **Ubemannede seter** fylles automatisk av innleide frilansere. De koster 1,15 × listepris, så du taper penger på dem, og kundetilfredsheten synker litt.
- **Benk:** Ansatte som ikke sitter på en kontrakt koster lønn uten å gi inntekt.

### 1.2 Kultur
- `fagmiljo` og `sosialt` går fra 0 til 100. Hvert kvartal: `ny = gammel × 0.85 + (budsjett per hode / 1000) × 0.5`, klemt til 0–100. Et budsjett på 20 000 per hode gir likevekt rundt 66.
- **Arbeidsgiverbrand** = `0.4 × fagmiljo + 0.3 × sosialt + 0.3 × omdømme`

### 1.3 Trivsel og turnover (per pool og per stjerne)
- `mål = 50 + 0.2 × fagmiljo + 0.2 × sosialt + utnyttelsesEffekt + lønnsEffekt − skandaleStraff`
  - utnyttelsesEffekt: 75–90 % gir +10, over 95 % gir −15 (utbrenthet), under 50 % gir −10 (kjedsomhet)
  - lønnsEffekt: `salaryPremium × 100`, klemt til ±15
- `trivsel += (mål − trivsel) × 0.3`
- Turnover-sannsynlighet per hode: `0.02 + max(0, 60 − trivsel) / 400`
- Stjerner har i tillegg en ambisjon (`salary`, `growth`, `leadership`, `remote`). Hvis ambisjonen ikke blir møtt, synker lojaliteten. Lav lojalitet øker sjansen for å bli poachet.

### 1.4 Rekruttering
- Spilleren legger inn en bestilling per fagområde (antall ønskede ansettelser).
- Antall som takker ja = `bestilt × clamp(0.3 + brand/150 + salaryPremium × 2 + omdømme/200, 0, 1)`, rundet med RNG.
- Nyansatte kommer **neste kvartal**. Snittnivået deres er 2 + fagmiljø/50 ± støy.
- Av og til dukker det opp en stjerne i markedet (event). Da kan du by på vedkommende.

### 1.5 Anbud og rammeavtaler
- Hvert kvartal publiseres 2–4 anbud. De avgjøres ved slutten av neste kvartal.
- Et anbud har kunde, type (`project` over 2–6 kvartaler eller `framework` over 8–16 kvartaler), seter per fagområde, vekting mellom pris og kvalitet, buzzwords og møtepreferanse.
- **Et bud består av:** `rateMultiplier` (0.7–1.4), tilbudte stjerner, tilbudsinnsats (0–3, der hvert nivå koster 30 000), resultat fra minispill (0–100) og eventuell CV-juks.
- **Kvalitet (0–100):** `0.5 × CV-snitt/5 × 100 + 0.2 × fagmiljo + 0.15 × minispill + 0.15 × innsats/3 × 100`, pluss juksebonus
- **Score:** `vPris × (lavesteMultiplier / egenMultiplier) × 100 + vKvalitet × kvalitet + 0.1 × relasjon + støy(±5)`
- **Prosjektanbud:** Den med høyest score vinner.
- **Rammeavtaler:** De 3 beste rangeres, og avropsandelen fordeles 60/30/10 %. Hvert kvartal ruller kunden avrop: basisseter × (0.5–1.5) × andel.

### 1.6 AI-firma
Samme `Firm`-struktur som spilleren. En personlighet styrer:
- `priceBias` (Sopp Steria 0.8, Bekkerson 1.2)
- `qualityFocus` (budsjett til fagmiljø)
- `aggression` (poaching)
- `shadiness` (sannsynlighet for lyssky handlinger)
- `growthAppetite` (ansettelser)

AI-en planlegger turen sin ved å produsere en liste med `Action`s som går gjennom samme reducer som spillerens.

### 1.7 Lyssky handlinger (bakrommet)
Hver handling har en kostnad, en effekt, `baseDetection` og en `heat`-verdi. Firmaets **heat** (0–100) øker med hver handling og synker med 10 per kvartal. Oppdagelsessannsynligheten er `baseDetection + heat/200`.

| id | Effekt | Kostnad | baseDetection | Oppdaget |
|---|---|---|---|---|
| `spy_bids` | Se konkurrentenes bud på ett anbud | 100k | 0.10 | −8 omdømme, bot 250k |
| `spy_salaries` | Se lønnsnivå og trivsel hos et firma | 50k | 0.05 | −4 omdømme |
| `plant_mole` | Løpende innsyn i et firma i 4 kvartaler | 300k | 0.15/kv | −12 omdømme, bot 500k |
| `afterwork_poach` | Forsøk å stjele en stjerne fra et firma | 80k + lønn | 0.20 | −5 omdømme, dårligere relasjon |
| `silent_outsource` | Toggle per kontrakt: X % av setene gjøres offshore til 30 % av kostnaden, med lavere kvalitet | 0 | 0.08/kv | kontrakten termineres, bot 1 MNOK, −15 omdømme, −10 trivsel |
| `cv_pad` | +10 kvalitet på et bud | 20k | 0.12 | vunnet kontrakt tapes, −10 omdømme |
| `ghost_cv` | Tilby «konsulenter vi kanskje ansetter»: +15 kvalitet | 40k | 0.18 | som over, pluss bot 400k |
| `bait_and_switch` | Etter tildeling blir de tilbudte stjernene erstattet av juniorer (frigjør stjerner) | 0 | 0.15/kv | −12 omdømme, −30 relasjon |
| `rumor` | −6 omdømme for mål-firma | 60k | 0.10 | −8 omdømme |
| `dn_leak` | Mål-firma får skandale: −12 omdømme | 200k | 0.20 | −15 omdømme, bot 300k |
| `linkedin_post` | Ditt brand +5, målets brand −3 | 10k | 0.05 | −3 omdømme («cringe») |

Konsekvensene er valgt å være **omdømme og bøter**. Når en handling blir oppdaget, gir det i tillegg −5 trivsel i hele firmaet og en saftig nyhetssak.

### 1.8 Hendelser og nyheter
- Hendelsene er datadrevne: `{ id, weight, condition(state, firm), choices: [{ id, effects }] }`. Spilleren får 0–2 hendelser per kvartal.
- Effektene bruker en enkel DSL: `{ cash, reputation, heat, fagmiljo, sosialt, morale, relationship: {customerId, delta}, starLoyalty }`.
- Motoren skriver `NewsItem { quarter, key, params, tone }` til en logg som UI-et viser som ticker og kvartalsrapport.
- Markedstrender (f.eks. «GenAI-hype», «Sky-migrering», «Budsjettkutt i staten») øker eller senker etterspørselen etter fagområder i 4–8 kvartaler.

---

## 2. Filstruktur

```
konsulent-tycoon/
  index.html
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts (via vite.config)
  scripts/sim.ts
  src/
    main.tsx, App.tsx
    engine/
      types.ts          # All state- og action-typer
      rng.ts            # Seeded RNG (mulberry32)
      constants.ts      # Balansetall fra §1
      newGame.ts        # createNewGame(seed, options)
      reducer.ts        # applyAction(state, action)
      turn.ts           # endTurn(state), pipeline
      economy.ts        # omsetning, kostnader, utnyttelse
      staff.ts          # pools, trivsel, turnover, rekruttering
      stars.ts          # stjernekonsulenter
      culture.ts        # fagmiljø, sosialt, brand
      tenders.ts        # generering, kvalitet, scoring, avgjørelse
      contracts.ts      # kontrakter, rammeavtaler, avrop
      shady.ts          # lyssky katalog, heat, oppdagelse
      events.ts         # hendelsesmotor + effekt-DSL
      market.ts         # trender
      news.ts           # nyhetslogg-hjelpere
      score.ts          # verdivurdering, rangering, titler
      save.ts           # serialize/deserialize, migrasjoner, slots
      ai/
        personalities.ts
        planner.ts      # planAiTurn(state, firmId) → Action[]
      index.ts          # offentlig API
    content/
      firms.ts customers.ts events.ts trends.ts traits.ts starNames.ts buzzwords.ts meetingQuestions.ts announcements.ts thoughts.ts awards.ts
    i18n/
      index.ts
      locales/nb/{ui,events,news,content,shady,minigames}.json
      locales/en/{…same…}.json
    store/
      gameStore.ts      # Zustand: state + dispatch + endTurn + save/load
    ui/
      theme/tokens.css, global.css
      components/ (Panel, PixelButton, Stat, Meter, Modal, Tabs, Ticker, Tooltip, NumberInput)
      screens/
        MainMenu.tsx NewGame.tsx SaveLoad.tsx
        Dashboard.tsx StaffScreen.tsx CultureScreen.tsx TenderBoard.tsx BidForm.tsx
        ContractsScreen.tsx MarketScreen.tsx BackroomScreen.tsx
        QuarterReport.tsx EventModal.tsx EndGame.tsx Settings.tsx
      minigames/
        PresentationMeeting.tsx BuzzwordBingo.tsx
  tests/ (co-located *.test.ts i src/engine er ok, bruk samme mappe)
```

---

## Milepæl 0 – Oppsett

### Oppgave 0.1: Scaffold prosjektet

**Filer:** Oppretter hele Vite-skjelettet.

**Steg 1:** Mappen er ikke tom (`docs/` finnes), og Bash-verktøyet kan ikke svare på interaktive prompts. Scaffold derfor i en tom scratch-mappe og kopier inn. Sjekk først `npm create vite@latest -- --help` for et ikke-interaktivt flagg.
```bash
SCRATCH=$(mktemp -d)   # eller scratchpad-mappen
cd "$SCRATCH" && npm create vite@latest kt -- --template react-ts   # legg til no-interactive-flagg hvis det finnes
cp -R "$SCRATCH/kt/." /Users/selbekk/code/side-projects/konsulent-tycoon/
cd /Users/selbekk/code/side-projects/konsulent-tycoon
git init
npm install
npm install zustand i18next react-i18next
npm install -D vitest @vitest/coverage-v8 tsx @testing-library/react @testing-library/jest-dom jsdom
```

**Steg 2:** Legg til scripts i `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc -b --noEmit",
  "sim": "tsx scripts/sim.ts"
}
```

**Steg 3:** Legg til test-konfig i `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
```
UI-testfiler starter med kommentaren `// @vitest-environment jsdom` (ikke `environmentMatchGlobs`, den er deprecated). `src/engine` og `src/content` skal aldri bruke Vite-spesifikke imports (`import.meta.glob`, `?raw`). Da kan `tsx scripts/sim.ts` kjøre dem direkte.

**Steg 4:** Kjør `npm run build && npm test -- --passWithNoTests`. Begge skal lykkes.

**Steg 5:** Commit: `chore: scaffold vite react-ts project`

### Oppgave 0.2: Tema, fonter og i18n-skjelett

**Filer:**
- Opprett: `src/ui/theme/tokens.css`, `src/ui/theme/global.css`, `src/i18n/index.ts`, `src/i18n/locales/{nb,en}/ui.json`
- Endre: `index.html` (Google Fonts-lenke, `<title>Konsulent Tycoon</title>`), `src/main.tsx`

**tokens.css:** Definer farger som tokens på `:root`. Det mørke CRT-temaet er standard, og det lyse temaet ligger under `:root[data-theme="light"]`:
```css
:root {
  --bg: #0f0e17; --panel: #1b1a2e; --panel-2: #26244a; --border: #3d3a6b;
  --text: #fffffe; --muted: #a7a9be; --accent: #ff8906; --accent-2: #e53170;
  --good: #2cb67d; --bad: #ef4565; --warn: #ffd803; --info: #7f5af0;
  --font-title: 'Press Start 2P', monospace; --font-body: 'Pixelify Sans', system-ui, sans-serif;
  --radius: 2px; --shadow: 4px 4px 0 #000;
}
:root[data-theme="light"] { --bg: #f4f1de; --panel: #fffdf5; --panel-2: #ece6cc; --border: #3d405b; --text: #1b1b2f; --muted: #5c5f7a; --shadow: 4px 4px 0 #3d405b; }
```
`global.css` skal sette `body { background: var(--bg); color: var(--text); font-family: var(--font-body); }`, `image-rendering: pixelated`, `prefers-reduced-motion` og en mobil gutter på 16px.

**i18n/index.ts:** Bruk i18next med namespaces (`ui`, `events`, `news`, `content`, `shady`, `minigames`), `fallbackLng: 'nb'`, og lagre valgt språk i localStorage (med try/catch).

**Test (`src/i18n/i18n.test.ts`):** Sjekk at alle nøkler i `nb` finnes i `en` og omvendt, for alle namespaces. Testen går rekursivt over JSON-treet. Den må bestå **i hver milepæl**.

**Commit:** `feat: theme tokens, pixel fonts and i18n setup`

---

## Milepæl 1 – Motorkjerne og økonomi (spillbar: ansett nobody, klikk «neste kvartal», se kontantene synke)

### Oppgave 1.1: Seeded RNG

**Filer:** Opprett `src/engine/rng.ts` og `src/engine/rng.test.ts`

**Steg 1 – test:**
```ts
import { describe, it, expect } from 'vitest'
import { createRng, nextFloat, nextInt, pick, chance } from './rng'

describe('rng', () => {
  it('is deterministic for same seed', () => {
    const a = createRng(42), b = createRng(42)
    const xs = [nextFloat(a), nextFloat(a), nextFloat(a)]
    const ys = [nextFloat(b), nextFloat(b), nextFloat(b)]
    expect(xs).toEqual(ys)
  })
  it('state is plain serializable data', () => {
    const r = createRng(1); nextFloat(r)
    const copy = JSON.parse(JSON.stringify(r))
    expect(nextFloat(copy)).toBe(nextFloat(r))
  })
  it('nextInt is inclusive and in range', () => {
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) { const n = nextInt(r, 2, 5); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(5) }
  })
  it('pick and chance work', () => {
    const r = createRng(3)
    expect(['a', 'b']).toContain(pick(r, ['a', 'b']))
    expect(chance(r, 0)).toBe(false); expect(chance(r, 1)).toBe(true)
  })
})
```

**Steg 2:** `npx vitest run src/engine/rng.test.ts` skal feile (modul mangler).

**Steg 3 – implementasjon:**
```ts
export interface RngState { s: number }

export const createRng = (seed: number): RngState => ({ s: seed >>> 0 })

/** mulberry32 – muterer state-objektet (kalles bare på en draft-kopi av state). */
export function nextFloat(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0
  let t = r.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const nextInt = (r: RngState, min: number, max: number) => min + Math.floor(nextFloat(r) * (max - min + 1))
export const pick = <T>(r: RngState, xs: readonly T[]): T => xs[Math.floor(nextFloat(r) * xs.length)]
export const chance = (r: RngState, p: number) => nextFloat(r) < p
export const noise = (r: RngState, amp: number) => (nextFloat(r) * 2 - 1) * amp
export function weightedPick<T>(r: RngState, xs: readonly T[], w: (x: T) => number): T | undefined {
  const total = xs.reduce((s, x) => s + w(x), 0); if (total <= 0) return undefined
  let roll = nextFloat(r) * total
  for (const x of xs) { roll -= w(x); if (roll < 0) return x }
  return xs[xs.length - 1]
}
```

**Steg 4:** Testen skal bestå. **Steg 5:** Commit: `feat(engine): seeded rng`

### Oppgave 1.2: Typer og konstanter

**Filer:** Opprett `src/engine/types.ts` og `src/engine/constants.ts`

```ts
// types.ts
import type { RngState } from './rng'

export const DISCIPLINES = ['frontend', 'backend', 'cloud', 'data', 'design', 'architecture', 'pm'] as const
export type Discipline = typeof DISCIPLINES[number]
export type FirmId = string
export type Seats = Partial<Record<Discipline, number>>

export interface Pool { count: number; level: number; morale: number }

export type Ambition = 'salary' | 'growth' | 'leadership' | 'remote'
export interface Star {
  id: string; name: string; discipline: Discipline; level: number // 3–5
  traits: string[]; ambition: Ambition; morale: number; loyalty: number // 0–100
  salaryPremium: number; assignedContractId?: string
}

export interface Budgets { fagmiljoPerHead: number; sosialtPerHead: number; salaryPremium: number }

export interface Firm {
  id: FirmId; name: string; isPlayer: boolean; personalityId?: string
  cash: number; reputation: number; heat: number; fagmiljo: number; sosialt: number
  budgets: Budgets
  pools: Record<Discipline, Pool>; stars: Star[]
  hiringOrders: Seats; pendingHires: Seats
  negativeCashQuarters: number; bankrupt: boolean
  history: QuarterReport[]; intel: Intel[]
}

export interface Intel { targetFirmId: FirmId; kind: 'bids' | 'salaries' | 'mole'; tenderId?: string; untilQuarter: number }

export interface QuarterReport { quarter: number; revenue: number; costs: number; ebitda: number; headcount: number; utilization: number; hires: number; leavers: number }

export interface Customer { id: string; sector: 'public' | 'private'; budgetFactor: number; meetingPreference: MeetingStyle; relationships: Record<FirmId, number> }
export type MeetingStyle = 'concrete' | 'visionary' | 'humble' | 'buzzword'

export type ContractKind = 'project' | 'framework'
export interface Tender {
  id: string; customerId: string; kind: ContractKind; seats: Seats; duration: number
  priceWeight: number; qualityWeight: number; publishedQuarter: number; dueQuarter: number
  buzzwords: string[]; bids: Bid[]; resolved: boolean
  minigameResults: Record<FirmId, { kind: 'meeting' | 'bingo'; score: number }>
}
export interface Bid {
  firmId: FirmId; rateMultiplier: number; starIds: string[]; effort: 0 | 1 | 2 | 3
  cvPad: boolean; ghostCv: boolean // minigame-score leses fra tender.minigameResults
}
export interface Contract {
  id: string; tenderId: string; firmId: FirmId; customerId: string; kind: ContractKind
  baseSeats: Seats; activeSeats: Seats; rateMultiplier: number; share: number // rammeavtale-andel 1 for prosjekt
  startQuarter: number; endQuarter: number; starIds: string[]
  satisfaction: number; outsourcedShare: number; fraud: { cvPad: boolean; ghostCv: boolean; baitAndSwitch: boolean }
  terminated: boolean
}

export interface ActiveTrend { id: string; untilQuarter: number }
export interface PendingEvent { id: string; eventId: string; firmId: FirmId; params: Record<string, string | number> }
export interface NewsItem { quarter: number; key: string; params: Record<string, string | number>; tone: 'good' | 'bad' | 'neutral' | 'sassy'; firmId?: FirmId }

export interface GameState {
  saveVersion: number; seed: number; rng: RngState
  quarter: number; maxQuarters: number; locale?: never // språk er UI-anliggende
  playerId: FirmId; firms: Record<FirmId, Firm>
  customers: Record<string, Customer>; tenders: Tender[]; contracts: Contract[]
  trends: ActiveTrend[]; pendingEvents: PendingEvent[]; news: NewsItem[]
  starMarket: Star[]; status: 'playing' | 'won' | 'lost' | 'finished'; idCounter: number
}

export type Action =
  | { type: 'setBudgets'; firmId: FirmId; budgets: Partial<Budgets> }
  | { type: 'orderHires'; firmId: FirmId; discipline: Discipline; count: number }
  | { type: 'fire'; firmId: FirmId; discipline: Discipline; count: number }
  | { type: 'hireStar'; firmId: FirmId; starId: string; salaryPremium: number }
  | { type: 'placeBid'; bid: Bid; tenderId: string }
  | { type: 'withdrawBid'; firmId: FirmId; tenderId: string }
  | { type: 'recordMinigame'; firmId: FirmId; tenderId: string; kind: 'meeting' | 'bingo'; score: number }
  | { type: 'resolveEvent'; pendingEventId: string; choiceId: string }
  | { type: 'shady'; firmId: FirmId; actionId: ShadyActionId; targetFirmId?: FirmId; tenderId?: string; contractId?: string; starId?: string; share?: number }
  | { type: 'giveRaise'; firmId: FirmId; starId: string; amount: number }

export type ShadyActionId = 'spy_bids' | 'spy_salaries' | 'plant_mole' | 'afterwork_poach' | 'silent_outsource'
  | 'cv_pad' | 'ghost_cv' | 'bait_and_switch' | 'rumor' | 'dn_leak' | 'linkedin_post'

export interface ActionResult { state: GameState; error?: string }
```

`constants.ts` inneholder alle tallene fra §1 som navngitte konstanter (`BILLABLE_HOURS = 400`, `listRate(level)`, `annualSalary(level, premium)`, `OVERHEAD_PER_HEAD = 40_000`, `HIRE_COST = 50_000`, `FREELANCER_MARKUP = 1.15`, `CULTURE_DECAY = 0.85` osv.). Ingen tall skal være hardkodet i andre moduler.

**Commit:** `feat(engine): core types and balance constants`

### Oppgave 1.3: `createNewGame`

**Filer:** Opprett `src/engine/newGame.ts`, `src/engine/newGame.test.ts`, `src/content/firms.ts`, `src/content/customers.ts`, `src/content/starNames.ts`, `src/content/traits.ts`

**Tester:**
- Samme seed gir identisk state (`toEqual`).
- 25 firma: spilleren pluss 24 AI-er (4 hovedrivaler med egen `personalityId`, 20 med arketype-personlighet), med data fra §0.1.
- Spilleren starter med 3 MNOK, omdømme 30, 2 grunnlegger-stjerner (i disiplinene spilleren har valgt) og 4 konsulenter i pools.
- AI-ene starter med antall hoder fra §0.1 (±10 % støy) og høyere omdømme enn spilleren.
- 3 åpne anbud med `dueQuarter = 1`.
- **Oppstartsdrift:** Første anbud avgjøres tidligst etter tur 2, og uten grep går alle konkurs før de får inn noe.
  - Spilleren får et lite **startprosjekt** («Vennetjenesten hos Kryptonitt»): 4 kvartaler med seter til grunnleggerne og poolen, multiplier 1.0.
  - Hvert AI-firma får en **eksisterende backlog** av kontrakter som gir 70–80 % utnyttelse, med varierende sluttkvartal (2–10).
  - Testene sjekker at spillerens utnyttelse i Q1 er over 0, at hver AI har en utnyttelse på 0.7–0.8, og at spilleren ikke går konkurs de første 4 kvartalene i en `idle`-sim på `normal`.
- `JSON.parse(JSON.stringify(state))` gir lik state (alt er serialiserbart).

**Signatur:** `createNewGame({ seed, firmName, founderDisciplines: [Discipline, Discipline], difficulty: 'easy'|'normal'|'hard' }): GameState`. Vanskelighetsgraden skalerer startkontanter (5/3/1,5 MNOK) og AI-aggresjon.

**Commit:** `feat(engine): new game setup with firms and customers`

### Oppgave 1.4: Reducer og immutabilitet

**Filer:** Opprett `src/engine/reducer.ts` og `src/engine/reducer.test.ts`

**Mønster:** Bruk `structuredClone(state)` som draft. Handlerne muterer draften, og `applyAction` returnerer `{ state, error }`. Den originale staten blir aldri endret. Ukjente eller ugyldige actions returnerer original state og en `error`-nøkkel (i18n-nøkkel, f.eks. `errors.notEnoughCash`).

```ts
export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status !== 'playing') return { state, error: 'errors.gameOver' }
  const draft = structuredClone(state)
  const error = handlers[action.type](draft, action as never)
  return error ? { state, error } : { state: draft }
}
```

**Tester i denne oppgaven:** `setBudgets` (klemmer premium til −0.1..0.3), `orderHires` (ikke negativt), `fire` (fjerner fra pool, koster 1 kvartal lønn i sluttpakke, gir −3 trivsel) og en sjekk på at original state er uendret (deep-freeze-helper i testen). De andre action-typene får stub-handlers som returnerer `'errors.notImplemented'` og implementeres i senere milepæler.

**Commit:** `feat(engine): action reducer with budgets, hiring orders, firing`

### Oppgave 1.5: Økonomi og `endTurn`-pipeline

**Filer:** Opprett `src/engine/economy.ts`, `src/engine/economy.test.ts`, `src/engine/turn.ts`, `src/engine/turn.test.ts`, `src/engine/news.ts`

**economy.ts – rene funksjoner (test hver av dem):**
- `headcount(firm)`: summen av pools pluss stjerner
- `staffContract(firm, contract) → { staffed: Seats, freelance: Seats }`: fyller seter fra pools per disiplin (stjerner tildelt kontrakten teller først)
- `quarterFinancials(state, firmId) → { revenue, salaryCost, overhead, cultureCost, freelanceCost, hireCost, total, utilization }`

**turn.ts – `endTurn(state)`** i fast rekkefølge. Hvert steg er en egen funksjon som tar `draft`. Stegene fra senere milepæler starter som no-ops:
1. `runAiTurns` (M5)
2. `resolveDueTenders` (M3)
3. `rollCallOffs` (M3)
4. `applyFinancials`: kontanter ± og push `QuarterReport`
5. `updateCulture`, `updateMorale`, `applyTurnover`, `processHiring` (M2)
6. `rollShadyDetection`, `decayHeat` (M6)
7. `drawEvents`, `updateTrends` (M7)
8. `publishTenders` (M3)
9. `checkBankruptcy`: negative kontanter to kvartaler på rad gir `bankrupt`. Hvis spilleren er konkurs, blir status `lost`.
10. `quarter++`. Hvis `quarter >= maxQuarters`, blir status `finished`.

Hvis spilleren har uløste `pendingEvents`, kaster `endTurn` ikke feil. UI-et sperrer knappen, og motoren auto-velger første valg (dokumentert oppførsel for sim).

**Tester:**
- Et firma med 4 konsulenter på nivå 3 og ingen kontrakter taper `4 × lønn + overhead` per kvartal.
- Med en kontrakt på 4 seter (backend, multiplier 1.0) blir omsetningen `4 × 400 × 1500`.
- Ubemannede seter gir frilanskostnad.
- `endTurn` øker `quarter`, er deterministisk og muterer ikke input.
- Konkurs etter 2 negative kvartaler.

**Commit:** `feat(engine): economy and end-turn pipeline`

### Oppgave 1.6: Lagring og migrasjoner

**Filer:** Opprett `src/engine/save.ts` og `src/engine/save.test.ts`

```ts
export const SAVE_VERSION = 1
type Migration = (s: any) => any
const migrations: Record<number, Migration> = { /* 1: v1→v2 legges til når state endres */ }

export function serialize(state: GameState): string { return JSON.stringify(state) }
export function deserialize(raw: string): GameState {
  let s = JSON.parse(raw)
  while (s.saveVersion < SAVE_VERSION) { s = migrations[s.saveVersion](s); s.saveVersion++ }
  if (s.saveVersion > SAVE_VERSION) throw new Error('save.tooNew')
  return s
}
export interface SlotMeta { slot: string; firmName: string; quarter: number; savedAt: string; cash: number }
export function saveToSlot(storage: Storage, slot: 'auto' | '1' | '2' | '3', state: GameState): boolean // try/catch
export function loadFromSlot(storage: Storage, slot: string): GameState | null
export function listSlots(storage: Storage): SlotMeta[]
export function deleteSlot(storage: Storage, slot: string): void
```
Nøklene i storage er `kt.save.<slot>` og `kt.meta.<slot>`. Testene bruker en fake `Storage` basert på `Map`, og én fake som kaster ved `setItem`.

**Tester:** Round-trip gir lik state. Etter round-trip gir `endTurn` identisk resultat som uten lagring (bevarer RNG). En falsk v0→v1-migrasjon kjøres (testen injiserer den). En for ny versjon kaster feil.

**Regel fra nå:** Hver gang `GameState` endres, bump `SAVE_VERSION` og legg til en migrasjon med test.

**Commit:** `feat(engine): save/load with versioned migrations`

### Oppgave 1.7: Simulator

**Filer:** Opprett `scripts/sim.ts` og `src/engine/index.ts` (eksporterer offentlig API)

```bash
npm run sim -- --games 50 --strategy balanced --seed 1
```
Bot-strategiene for spilleren er `idle`, `balanced`, `greedy` og `shady` (fylles ut etter hvert som systemene kommer). Hver strategi bruker `planAiTurn` med en gitt personlighet når M5 er ferdig. Frem til da gjør strategien ingenting.

Skriptet skriver ut en tabell per kvartal (median og p10/p90) over kontanter, antall hoder, omsetning, trivsel og omdømme, **markedets etterspurte seter mot tilgjengelige konsulenter** (for å fange ubalanse tidlig), pluss sluttrangeringen og andelen konkurser. Med `--json` skrives rådata til `sim-output/`.

**Kvalitetskrav (sjekkes i M9):** `balanced` går konkurs i under 10 % av partiene, `idle` går konkurs innen kvartal 8, og ingen AI går konkurs i over 20 % av partiene.

**Commit:** `feat: headless balance simulator`

### Oppgave 1.8: Minimal UI – dashboard og «Neste kvartal»

**Filer:** Opprett `src/store/gameStore.ts`, `src/ui/components/{Panel,PixelButton,Stat,Meter}.tsx` + `.module.css`, `src/ui/screens/Dashboard.tsx`, og endre `src/App.tsx`

**gameStore (Zustand):** Holder `state: GameState | null` og `lastError`. Den har metodene `newGame(opts)`, `dispatch(action)` (setter alltid `firmId = playerId` for spillerens actions) og `endTurn()` (autosave etterpå), pluss `load(slot)` og `save(slot)`.

**Dashboard:** En topplinje med kvartal («Q3 2029»), kontanter, omdømme, heat (skjult til M6), antall ansatte og trivsel. Paneler viser siste `QuarterReport` og en sparkline for kontantene. Knappen er stor: «Avslutt kvartal ▶».

**Test (`Dashboard.test.tsx`):** Komponenten rendrer med en ny game-state og viser kvartal og kontanter. Klikk på «Avslutt kvartal» øker kvartalet.

**Manuell sjekk:** `npm run dev` gir et spillbart dashboard der kontantene synker hvert kvartal.

**Commit:** `feat(ui): store, dashboard and end-turn`

---

## Milepæl 2 – Ansatte, stjerner og kultur (spillbar: ansett, bygg kultur, se folk slutte)

### Oppgave 2.1: `culture.ts`
Implementer `updateCulture(firm)` og `employerBrand(firm)` fra §1.2.
**Tester:** Likevekt rundt 66 ved 20k per hode etter 30 iterasjoner, klemming til 0–100, og at brand-formelen stemmer.
**Commit:** `feat(engine): culture levels and employer brand`

### Oppgave 2.2: `staff.ts` – trivsel, turnover, rekruttering
- `utilization(firm, state)` bruker `staffContract`
- `moraleTarget(firm, util, scandalPenalty)`, `updateMorale`
- `applyTurnover(draft, firmId)`: binomisk trekk per pool med RNG. Loggfør `news.staff.left` når ≥ 3 slutter, eller når en stjerne slutter.
- `processHiring(draft, firmId)`: flytter `pendingHires` inn i pools (vektet snittnivå) og regner ut neste `pendingHires` fra `hiringOrders` etter formelen i §1.4. Trekker `HIRE_COST`.

**Tester:**
- Høy kultur gir lavere turnover enn lav kultur over 20 kvartaler med samme seed (sammenlign snitt).
- Utnyttelse over 95 % senker trivselsmålet.
- Nyansatte kommer først kvartalet etter at de ble bestilt.
- Pool-nivået er et vektet snitt.

**Commit:** `feat(engine): morale, turnover and recruitment`

### Oppgave 2.3: `stars.ts`
- `generateStar(rng, discipline)` bruker navn fra `starNames.ts` (humoristiske norske navn som «Kjetil 'Kubernetes' Kvamme» og «Ingrid Agil-Aas») og 1–2 traits fra `traits.ts`.
- Traits er data med modifiers. Eksempler:
  - `linkedin_influencer`: +3 brand, lojalitet −
  - `kaffesnobb`: sosialt +, krever kaffemaskin-event
  - `tech_debt_hunter`: +satisfaction
  - `sjefsdiplomat`: +relasjon
  - `10x_ego`: +kvalitet, −trivsel i poolen
  - `hjemmekontor_hardliner`
- `updateStars(draft, firmId)`: Lojaliteten påvirkes av om ambisjonen blir møtt:
  - `salary`: premium ≥ 0.1
  - `growth`: fagmiljø ≥ 60
  - `leadership`: firmaet har ≥ 20 hoder
  - `remote`: event-flagg
  - Lav lojalitet og lav trivsel gjør at stjernen slutter, eller blir sårbar for poaching (M5).
- Handlers: `hireStar` (fra `starMarket`) og `giveRaise`.
- `starMarket` fornyes med 0–2 stjerner per kvartal i `endTurn`.

**Tester:** Traits påvirker det de skal. En stjerne med ambisjonen `salary` mister lojalitet uten premium. `hireStar` feiler uten kontanter til signeringsbonus (1 kvartal lønn).

**Commit:** `feat(engine): star consultants with traits and ambitions`

### Oppgave 2.4: UI – Ansatte og Kultur
- `StaffScreen`: tabell per fagområde (antall, nivå, trivsel-meter, bestilt, på vei inn), knapper for +/− bestilling og oppsigelse, og kort for hver stjerne (navn, traits som badges, ambisjon, lojalitet, lønnstillegg). En «Stjernemarked»-seksjon lar deg ansette.
- `CultureScreen`: sliders for fagmiljø og sosialt budsjett per hode (0–40k) og for lønnspremie (−10 % til +30 %), med en live-estimert kvartalskostnad og likevektsnivå. Sassy hjelpetekster, f.eks. «0 kr i sosialt budsjett? Folk kommer til å begynne å ha fredagspils med Accentura.»
- Navigasjon: tabs eller sidemeny (Dashboard / Ansatte / Kultur / Anbud / Kontrakter / Marked / Bakrommet). På mobil ligger den nederst.

**Test:** `StaffScreen` rendrer pools og dispatcher `orderHires`.

**Commit:** `feat(ui): staff and culture screens`

---

## Milepæl 3 – Anbud, kontrakter og rammeavtaler (spillbar: tjen penger)

### Oppgave 3.1: `tenders.ts` – generering
- `publishTenders(draft)`: publiserer 2–4 anbud per kvartal. Antall og fagområder vektes av aktive trender og kundens `budgetFactor`. Omtrent 30 % er rammeavtaler. Setene er 2–12 for prosjekt og 4–20 basisseter for ramme. Kunden bestemmer vektingen: offentlige kunder vekter ofte kvalitet 60/40, og `Kryptonitt` bryr seg bare om pris.
- Buzzwords trekkes fra `buzzwords.ts` (f.eks. «smidig», «skalerbar», «brukerreise», «GenAI», «plattformteam», «DevSecOps», «datadrevet», «bærekraft»).

**Tester:** Deterministisk, riktig antall og riktig `dueQuarter = quarter + 1`.

**Commit:** `feat(engine): tender generation`

### Oppgave 3.2: Kvalitet, scoring og avgjørelse
- `bidQuality(state, bid, tender)` og `bidScoreEstimate(...)` er rene funksjoner uten støy, som UI-et kan kalle. Støyen (`noise(±5)` fra `state.rng`) legges bare på i `resolveDueTenders`.
  - **Regel:** UI-et skal aldri kalle noe som bruker `state.rng`.
  - **Test:** `bidScoreEstimate` endrer ikke `state.rng`.
- Handler for `placeBid`:
  - Validerer at anbudet er åpent, at `rateMultiplier` er innenfor grensene, og at stjernene tilhører firmaet og ikke allerede er lovet bort til et annet åpent bud.
  - Trekker innsatskostnaden og erstatter et eksisterende bud fra samme firma.
- Handler for `withdrawBid`.
- `resolveDueTenders(draft)`:
  - Prosjekt: vinneren får en `Contract`.
  - Ramme: topp 3 får hver sin `Contract` med andel 0.6/0.3/0.1.
  - Relasjonen til kunden går +5 for vinner og −2 for tapere.
  - Loggfør en nyhet per anbud («Bekkerson knuste konkurrentene på NAVet-rammeavtalen. Igjen.»).

**Tester:**
- Lavest pris vinner når vPris = 1.
- Høyest kvalitet vinner når vKvalitet = 1.
- Rammeavtale gir 3 kontrakter med riktige andeler.
- Et bud med utlånt stjerne avvises.

**Commit:** `feat(engine): bidding, scoring and tender resolution`

### Oppgave 3.3: `contracts.ts` – drift
- `rollCallOffs(draft)`: `activeSeats = round(baseSeats × U(0.5, 1.5) × share)` per kvartal for ramme. Prosjekter har faste seter.
- Satisfaction:
  - øker med bemanningsgrad og nivå
  - synker med frilansere og outsourcing
  - Lav satisfaction (< 30) gir en sjanse for at kontrakten blir avsluttet før tiden og at relasjonen faller.
- Kontrakter utløper ved `endQuarter`. Stjerner blir frigjort.

**Tester:** Avrop er innenfor forventet spenn. Utløp frigjør stjerner. Lav satisfaction kan terminere kontrakten.

**Commit:** `feat(engine): contract operations and framework call-offs`

### Oppgave 3.4: UI – Anbudstavle, budskjema og kontrakter
- `TenderBoard`: anbudskort med kunde (med parodi-logo-glyph), type-badge (RAMME/PROSJEKT), seter per fagområde, vekting som stolpe, frist og buzzwords. Viser om du har bydd.
- `BidForm` (modal):
  - slider for pris (−30 % til +40 %) med estimert omsetning og margin
  - velg stjerner
  - innsats 0–3 («Copy-paste fra forrige gang» / «Standard» / «Fin PDF» / «Hele helgen med tilbudsteamet»)
  - knapp for «Presentasjonsmøte» eller «Buzzword-bingo» (M4), slik at minispill-score blir satt
  - Live kvalitetsestimat med `bidQuality`
- `ContractsScreen`: aktive kontrakter med bemanning (egne/frilans), satisfaction-meter og sluttkvartal. Toggle for stille outsourcing kommer i M6.

**Commit:** `feat(ui): tender board, bid form and contracts`

---

## Milepæl 4 – Minispill

Minispillene er UI med små rene scoringsfunksjoner som testes.

**Anti-exploit:** Hvert firma får ett forsøk per anbud.
- Ny action `recordMinigame { firmId, tenderId, kind, score }` lagrer resultatet i `tender.minigameResults[firmId]`. En ny innsending avvises når et resultat allerede finnes (`errors.minigameAlreadyPlayed`).
- `placeBid` leser scoren derfra og ignorerer eventuell score i action-en. Fjern `minigameScore` fra `Bid`-inputen.
- Dette er en state-endring, så legg den inn i typene fra start siden M1 ikke er lansert.

**RNG:** Minispillene bruker en egen hash-basert RNG, `createRng(hash(tenderId + firmId))` i UI-et, og rører aldri `state.rng`.

### Oppgave 4.1: Presentasjonsmøte
- **Filer:** `src/content/meetingQuestions.ts`, `src/ui/minigames/PresentationMeeting.tsx`, `src/engine/minigames.ts` (+ test)
- Kunden stiller 3 tilfeldige spørsmål (seeded fra tender-id). Eksempler: «Hvordan sikrer dere kontinuitet?», «Hva er deres erfaring med offentlig sektor?», «Kan dere starte på mandag?»
- Hvert spørsmål har 4 svar som er tagget med `MeetingStyle` (`concrete`, `visionary`, `humble`, `buzzword`).
- Score per svar: 33 hvis stilen matcher kundens preferanse, 15 hvis den er nøytral og 0 hvis den er motsatt. Pluss 1 hvis minst ett svar er under 5 sekunder («selvsikker»).
- Kundens reaksjoner er sassy tekster, f.eks. «Innkjøpssjefen noterer noe. Det ser ikke positivt ut.»
- **Test:** `scoreMeeting(answers, preference)`

### Oppgave 4.2: Buzzword-bingo
- **Filer:** `src/ui/minigames/BuzzwordBingo.tsx` og `scoreBingo()` i `minigames.ts`
- Kunngjøringsteksten fra anbudet vises med anbudets buzzwords skjult i prosa. Deretter kommer et 4×4-brett med 16 ord, der 4–6 er riktige. Spilleren har 20 sekunder på seg.
- Score: `(riktige − 0.5 × feil) / totaltRiktige × 100`, klemt til 0–100. Tidsbonus gir maks +10.
- `prefers-reduced-motion` slår av animasjonene. Timeren kan pauses av tilgjengelighetshensyn (via innstilling som gir dobbel tid).
- **Test:** `scoreBingo`

**Commit per minispill:** `feat(minigame): presentation meeting` / `feat(minigame): buzzword bingo`

---

## Milepæl 5 – AI-konkurrenter

### Oppgave 5.1: Personligheter
`src/ai/personalities.ts`: 4 egne profiler for hovedrivalene og 7 arketype-profiler for de øvrige, etter §1.6 og §0.1. Hvert firma kan justere arketypen litt (f.eks. `{ archetype: 'boutique_nerd', priceBias: +0.05 }`). Tagline og blurb for alle 24 ligger i locale-filene (`content.firms.<id>.tagline`).

### Oppgave 5.2: `planAiTurn(state, firmId): Action[]`
- **Budsjett:** settes etter `qualityFocus`
- **Ansettelser:** bestiller hvis utnyttelsen er over 85 % og kontantene over 2 kvartalers kostnader, eller skalerer ned hvis de har vært under 60 % i 2 kvartaler (via `fire`)
- **Bud:** byr på anbud der de har minst 50 % kapasitet i de etterspurte fagområdene. Multiplier = `priceBias + noise(0.08)`, med noen stjerner og innsats etter kontanter. AI-en registrerer minispill-score via `recordMinigame` med `qualityFocus × 80 + noise`.
- **Poaching:** med sannsynlighet `aggression` retter de et `afterwork_poach` mot spillerens stjerne med lavest lojalitet. Da får spilleren en `PendingEvent` («Accentura har tatt med Kjetil på afterwork. Mottilbud?») med valgene *match lønn*, *la gå* eller *gråt i CEO-podcast*.
- **Lyssky:** med sannsynlighet `shadiness` utfører de en lyssky handling (M6), rettet mot spilleren eller et annet firma.
- `runAiTurns` i `endTurn` kjører alle AI-firmaene i fast rekkefølge (sortert på id) gjennom `applyAction`.

**Tester:** Planen er deterministisk. AI-en byr aldri over sin kapasitet og går ikke konkurs de første 10 kvartalene i en `idle`-sim. Sopp Steria har snittmultiplier under Bekkersons.

### Oppgave 5.3: Sim-strategier
Oppdater `scripts/sim.ts` slik at spillerbotene bruker `planAiTurn` med syntetiske personligheter. Kjør `npm run sim -- --games 50` og lim resultatet inn i `docs/balance-log.md`.

### Oppgave 5.4: UI – Marked
`MarketScreen`: ligatabell over firmaene med estimert verdi, hoder, omdømme og markedsandel. Tall for konkurrentene vises som «~» eller «???» til du har intel (M6). Firmaportretter vises som pixel-glyphs.

**Commit:** `feat(ai): competitor personalities and turn planner` og `feat(ui): market screen`

---

## Milepæl 6 – Bakrommet (lyssky handlinger)

### Oppgave 6.1: `shady.ts` – katalog og handler
- `SHADY_CATALOG: Record<ShadyActionId, { cost, baseDetection, heat, ongoing: boolean, requires: ('target'|'tender'|'contract'|'star')[] }>`
- Handleren `shady` validerer kravene og kontantene, trekker kostnaden, øker `heat` og utfører effekten:
  - `spy_*`/`plant_mole` legger til `Intel`
  - `afterwork_poach` gir en sjanse basert på lojaliteten til målstjernen og flytter stjernen
  - `cv_pad`/`ghost_cv` setter flagg på budet (må komme etter `placeBid`)
  - `silent_outsource` setter `contract.outsourcedShare`
  - `bait_and_switch` frigjør stjerner fra kontrakten og setter flagget
  - `rumor`/`dn_leak`/`linkedin_post` justerer omdømme og brand
- Alle handlinger registreres i en `shadyLog` på firmaet (**state-endring → SAVE_VERSION 2 + migrasjon**). Loggen brukes til oppdagelse og i sluttoppsummeringen («Du jukset 14 ganger og ble tatt 3»).

### Oppgave 6.2: Oppdagelse og konsekvenser
- `rollShadyDetection(draft)`: For hver ikke-oppdaget oppføring i loggen fra dette kvartalet, og for hver pågående handling (outsourcing, bait-and-switch, muldvarp), trekkes det med `baseDetection + heat/200`. Hvis handlingen blir oppdaget, brukes konsekvensene fra tabellen i §1.7. I tillegg gir det −5 trivsel for alle pools og stjerner, en `news` med `tone: 'sassy'`, og muldvarpen blir fjernet.
- Kontraktflaggene for `cv_pad` og `ghost_cv` sjekkes både ved tildeling og hvert kvartal kontrakten løper (dobbel sjanse).
- `decayHeat`: −10 per kvartal.

**Tester (med kontrollert seed og monkeypatchet `baseDetection` 1 og 0):**
- Oppdaget outsourcing terminerer kontrakten og trekker bot.
- Heat øker sannsynligheten.
- Uoppdaget outsourcing gir høyere margin.
- Intel utløper.

### Oppgave 6.3: UI – Bakrommet
`BackroomScreen` har et mørkere «noir»-tema (egen token-variant) og en heat-meter med flammer. Handlingene er delt i kategorier (Spionasje / Outsourcing / CV-kreativitet / PR-krigføring). Hver handling vises som et kort med kostnad og en risikoindikator (lav/middels/høy, ikke eksakte tall). Handlingen utføres i en to-stegs dialog («Er du HELT sikker? Compliance-avdelingen din er én person som heter Tor og han leser alt.»). Intel vises i Market- og BidForm-skjermene når den finnes, for eksempel som konkurrentenes bud på anbudskortet.

**Commit:** `feat(engine): shady actions, heat and detection` og `feat(ui): the backroom`

---

## Milepæl 7 – Hendelser, trender og nyheter

### Oppgave 7.1: Hendelsesmotor
- **Filer:** `src/engine/events.ts` (+ test) og `src/content/events.ts`
- `EventDef { id, weight, condition?(s, firm) → boolean, choices: { id, effects: Effect[], condition? }[] }`
- `drawEvents(draft)`: trekker 0–2 hendelser for spilleren og ruller én skjult «hendelse» per AI (effekten brukes direkte). Den valgte er alltid første valg eller et personlighetsvektet valg.
- Handler for `resolveEvent`: bruker effektene og fjerner den ventende hendelsen.
- **Tester:** Betingelser filtrerer, effektene brukes riktig, og resultatet er deterministisk.

### Oppgave 7.2: Innhold – minst 30 hendelser (nb + en)
Eksempler (ID og kort idé):
- `ebike_scheme` – «Ansatte krever el-sykkelordning.» Ja: −150k, +5 sosialt. Nei: −3 trivsel.
- `friday_1655` – «Kunden ringer 16:55 fredag: prod er nede.» Send stjerne: +satisfaction, −lojalitet. Ignorer: −satisfaction.
- `genai_pivot` – «Styret vil at dere skal ‹gjøre noe med AI›.» Rebrand: +omdømme, −fagmiljø. Nekt: styret sukker.
- `kickoff_abroad` – «Kick-off i Lisboa?» −400k, +15 sosialt, eller «Kick-off på Scandic Lillestrøm» −80k, +3.
- `competitor_cake` – «Accentura sendte en kake med logoen deres til kunden deres.» Send en større kake.
- `leaked_salary_sheet` – lønnsarket ble lagt i feil Teams-kanal.
- `kofa_complaint` – en konkurrent klager på tildelingen din til KOFA (krever at du vant et offentlig anbud).
- `hackathon`, `conference_talk`, `burnout_wave` (betingelse: utnyttelse over 95 %), `star_wants_remote`, `acquisition_offer` (kjøp opp et lite byrå), `influencer_post_viral`, `office_ping_pong`, `javazone_booth`, `tax_audit` (betingelse: heat over 50), `ex_employee_glassdoor`, `client_wants_ai_chatbot`, `pizza_budget_cut`, `christmas_party`, `intern_program`, `open_source_fame`, `cloud_credit_windfall`, `competitor_scandal` (bare nyhet), `public_budget_cut`, `unionization`, `fagdag_vs_billable`, `ceo_podcast`, `rebranding_agency`, `wrong_reply_all`.
- Trender i `src/content/trends.ts`: `genai_hype`, `cloud_migration`, `public_budget_cuts`, `design_renaissance`, `data_mesh_mania`, `pm_winter`. Hver trend har disiplin-modifiers og en varighet.

### Oppgave 7.2b: Stemningslaget (§0.2)
- `src/engine/flavor.ts` (+ test) inneholder:
  - `pickAnnouncement(state)`: betinget, maks én per kvartal. Trekkes i `endTurn` og lagres i `state.announcement`. **State-endring → migrasjon.**
  - `employeeThoughts(state, firmId)`: deterministisk, 3–5 tanker ut fra trivsel, utnyttelse, kultur og konkurrentenes kultur.
- `src/engine/awards.ts` (+ test): `yearEndAwards(state)` kjøres i `endTurn` etter Q4. Den gir små effekter (omdømme ±) og legger vinnerne i nyhetene og `state.lastAwards`.
- Innhold (nb + en):
  - ≥ 30 høyttalermeldinger
  - ≥ 40 tanker, med positive, negative og nøytrale tanker for hver trigger
  - 6 priser
- **UI:**
  - `AnnouncementBar` øverst, med innstilling for å slå den av
  - `ThoughtsFeed` på Ansatte-skjermen
  - `AwardsModal` med pokal-SVG, vist etter Q4-rapporten

### Oppgave 7.3: Nyheter og kvartalsrapport
- Legg til gjennomgående nyhetsnøkler (`news.*`) med variantlister, slik at samme type hendelse har 3–5 formuleringer. Motoren velger variant med RNG og lagrer `key` + `variant` i `params`.
- `Ticker`-komponent: rullende nyhetsbånd nederst på dashboardet, med `prefers-reduced-motion`-fallback til en statisk liste.
- `QuarterReport`-modal etter hver `endTurn`: resultatregnskap (inntekter, kostnader, EBITDA), hvem som begynte og sluttet, vunne og tapte anbud, oppdagede skandaler og en sassy kommentar fra «styreleder Bjørn».
- `EventModal`: viser ventende hendelser én etter én. «Avslutt kvartal» er sperret til alle er løst.

**Commit per oppgave.**

---

## Milepæl 8 – Rammen rundt: meny, nytt spill, lagring, slutt

### Oppgave 8.1: `score.ts`
- `valuation(firm)` etter §0
- `rankings(state)`
- `endTitle(state)`: velger en tittel fra verdi, rang og `shadyLog`, f.eks. «Etisk fyrtårn», «Bransjens Bekkerson», «Jukset deg til toppen», «Tatt med buksa nede», «Oppkjøpt av Accentura».

**Tester:** Formelen stemmer. Rangeringen er sortert. Titlene velges riktig for syntetiske states.

### Oppgave 8.2: Skjermer
- `MainMenu`: stor pixel-logo «KONSULENT TYCOON» med blinkende «Trykk start», og valgene *Nytt spill / Fortsett (autosave) / Last inn / Innstillinger*.
- `NewGame`: firmanavn (med forslag som «Konsulent & Konsulent AS» og «Synergi Solutions»), to grunnlegger-fagområder, vanskelighetsgrad og seed (valgfritt, for deling).
- `SaveLoad`: 3 slots og autosave med metadata. Du kan lagre, laste og slette (med bekreftelse).
- `Settings`: språk (nb/en), tema (mørk/lys), dobbel minispilltid og redusert bevegelse.
- `EndGame`: sluttrangering, graf over verdien (SVG-linjer per firma over tid, fra `history`), tittel, jukse-statistikk og knappen «Spill igjen». Konkurs gir en egen skjerm («Bobestyrer har overtatt fussballbordet»).
- Enkel onboarding: 5 tooltip-steg første gang (flagg i localStorage).
- `EndGame`-grafen bruker `valuationHistory` og viser spilleren og topp 5. «Vis alle» viser resten.

**Commit:** `feat(ui): menus, saves, settings and end screen`

### Oppgave 8.3: Pixel-kontoret (§0.2)
- `src/ui/office/OfficeView.tsx` tegner et grid med SVG-tiles: pult, stol, plante, kaffemaskin, kantine, fagrom, sofakrok og pingpong.
  - Antall pulter følger antall hoder.
  - Rommene låses opp ved terskler: fagmiljø ≥ 40 og ≥ 70, sosialt ≥ 40 og ≥ 70, og hoder ≥ 20, 50 og 100 (ny etasje).
- Tile-oppsettet genereres av en ren funksjon, `officeLayout(firm)`, som testes.
- Animasjon: én figur som går og damp fra kaffemaskinen. Begge slås av med `prefers-reduced-motion`.

**Commit:** `feat(ui): pixel office view`

---

## Milepæl 9 – Balansering og polish

### Oppgave 9.1: Balansering
Kjør `npm run sim -- --games 200` for alle strategiene. Juster `constants.ts` til kvalitetskravene i oppgave 1.7 er oppfylt, og i tillegg:
- `shady` gir høyere median verdi enn `balanced`, men også høyere varians og en merkbar sjanse for krakk
- en god spiller (`balanced` med høy kultur) slår minst to AI-er i median

Logg endringene i `docs/balance-log.md`.

### Oppgave 9.2: Polish
- Responsivt design (360px og oppover) uten horisontal scroll
- Tastatursnarveier: `Enter` = avslutt kvartal, `1–7` = tabs
- Fokusringer og ARIA-labels på meters
- Tallformat via `Intl.NumberFormat` per locale (kr/NOK, «MNOK»)
- Små pixel-animasjoner: tall som teller opp og flash ved skandale

### Oppgave 9.3: Bygg og deploy
`npm run build` skal gi en statisk `dist/`. Deploy-mål avklares med brukeren (Vercel, Netlify eller GitHub Pages).

**Commit per oppgave.**

---

## Nivåer: idéer til senere

Nivåsystemet (`engine/levels.ts`) låser foreløpig bare opp ting som finnes fra før. Idéer til nye mekanikker som kan henge på nivåene:

- **Kontor som vokser:** Et større lokale på hvert nivå. Det gir plass til flere ansatte, sosialt-bonus og en ny illustrasjon i `OfficeView`.
- **Oppkjøp:** Fra nivå 4 kan du kjøpe et lite AI-firma med folk og kunder (i dag finnes det bare som hendelse).
- **Spesialisering:** På nivå 3 velger du en nisje, for eksempel offentlig sektor eller data, som gir bonus i én type anbud.
- **Egne avdelinger:** Offshore-senter, designbyrå eller akademi som egne byggeklosser med drift og gevinst.
- **Børsnotering:** Et valg på nivå 5 som gir en kapitalinjeksjon, men et kvartalspress fra markedet.
- **Lobbying og partnerskap:** Nye «hvite» handlinger ved siden av bakrommet, for eksempel partnerstatus hos skyleverandører.
- **Mål per nivå:** Frivillige oppdrag («vinn ditt første offentlige anbud») med en liten belønning, som ekstra krok tidlig i spillet.

---

## Definition of Done (hele prosjektet)
- `npm test`, `npm run typecheck` og `npm run build` er grønne
- i18n-paritetstesten er grønn (nb = en)
- `npm run sim` oppfyller kvalitetskravene
- Et helt parti på 40 kvartaler kan spilles i nettleseren, lagres midt i og lastes inn igjen med identisk videre forløp
