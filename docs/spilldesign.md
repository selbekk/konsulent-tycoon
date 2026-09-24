# Konsulent Tycoon – spilldesign

Dette dokumentet beskriver hva spillet er og hvorfor det er laget slik. Hvordan koden er bygget, står i [`utvikling.md`](utvikling.md). Tallene står ikke her: `src/engine/constants.ts` er fasit, og dokumentet viser til konstantene ved navn. Større beslutninger har egne planer i [`plans/`](plans/), og balansehistorikken står i [`balance-log.md`](balance-log.md).

## Idéen

Et turbasert strategispill i nettleseren. Du starter et IT-konsulentselskap og har 40 kvartaler (Q1 2027 til Q4 2036) på å bygge det opp mot 24 AI-selskaper. Du konkurrerer om anbud og rammeavtaler, bygger fagmiljø og sosialt miljø, rekrutterer og beholder folk, og kan jukse i bakrommet hvis du tør.

| Tema | Valg |
|---|---|
| Tur | 1 tur = 1 kvartal, 40 turer (`MAX_QUARTERS`). |
| Seier | Høyest **selskapsverdi** ved slutt: EBITDA for de siste fire kvartalene × en multippel styrt av omdømme, pluss kontanter (`score.ts`). Spilleren rangeres mot AI-ene og får en sluttittel. |
| Tap | Konkurs når kontantene har vært under kassekreditten to kvartaler på rad. |
| Likhet | Spilleren og AI-ene er samme `Firm` og følger de samme reglene. AI-en har ingen snarveier. |
| Språk | Bokmål (standard) og engelsk. |
| Lagring | Bare autolagring etter hver handling, lokalt i nettleseren. Manuelle plasser er fjernet, fordi de gjorde minispill og utfall mulige å ta om. |

## Tone og stemning

Inspirert av Theme Hospital og RollerCoaster Tycoon, men dempet. Tørr, varm og litt absurd humor, aldri slem og aldri memes.

- Spillet tar seg selv helt seriøst, og det er det som er morsomt. Maks én vits per skjerm eller dialog. Tall og knapper er nøkterne.
- Naturlig bokmål som bransjefolk kjenner igjen. Den engelske teksten er idiomatisk, ikke oversatt ord for ord.
- Konkurrentene er snille parodier på ekte nordiske konsulenthus. Ingen fremstilles som kriminelle eller dumme, bare litt karikerte. «Alle likheter med virkelige selskaper er helt tilfeldige (og kjærlig ment).»
- **Høyttaleranlegget:** Innimellom kommer en melding over anlegget («Minner om at fredagspilsen i dag er alkoholfri. Ingen vet hvorfor.»). Maks én per kvartal, noen avhenger av tilstanden i firmaet, og de kan slås av.
- **Tankebobler:** Ansatte-skjermen viser hva folka tenker, ut fra trivsel, utnyttelse og kultur. Tankene er også en diskret hjelpetekst om hva som påvirker trivselen.
- **Årets priser:** Etter Q4 deles det ut priser («Årets fagmiljø», «Mest kreative timeføring», «Bransjens beste kaffemaskin» …) til AI-er og spilleren på lik linje.
- **Kontoret:** Et lite pikselkontor på oversikten som vokser med antall ansatte, kultur og nivå. Bare pynt.
- **Styreleder Bjørn** er rådgiveren. Han sier aldri mer enn én eller to setninger.
- **Visuelt:** Retro, men rolig. Piksler i illustrasjonene (ikoner, kontor, portretter), ikke i tekst og knapper. Ingen emoji. Små 8-bit-lydeffekter.

## Konkurrentene

24 AI-firma (`content/firms.ts`), alle ordspill på ekte konsulenthus. Fire er **hovedrivaler** med egne personligheter:

- **Bekkerson:** fagnerder, høy kvalitet, høy pris. «Vi har en faggruppe for det.»
- **Accentura:** stor, dyr og aggressiv på poaching. «Vi har en deck for det.»
- **Knowit-All:** bred og middels på alt. «Vi kan alt. Spør oss.»
- **Sopp Steria:** billig, med sans for stille outsourcing. «Vokser best i mørket.»

De 20 andre bygger på arketyper (`engine/ai/personalities.ts`): `boutique_nerd`, `boutique_design`, `mid_generalist`, `nordic_giant`, `budget_bulk`, `specialist_cloud` og `specialist_data`. En personlighet har prisnivå, kvalitetsfokus, aggresjon, lyssky tilbøyelighet og vekstlyst.

Kundene (`content/customers.ts`) er parodier på offentlige og private kunder: *NAVet*, *Skatteetat'n*, *DNBank*, *Fintech-startupen Kryptonitt* og flere. Hver kunde har sektor, budsjett, prisfølsomhet, foretrukne fagområder, en skjult møtestil og et løfte den helst vil ha.

## Spillmodellen

### Folk og kultur

- Sju fagområder: `frontend`, `backend`, `cloud`, `data`, `design`, `architecture` og `pm`.
- **Ansatte** er en hybrid. Simuleringen regner på **pools** per fagområde med antall, snittnivå (1–5) og trivsel. Hos spilleren er poolen en **liste med personer**: hver har navn, portrett, nivå, et par særtrekk og et skjult potensial, og poolens antall og nivå regnes ut fra lista. AI-firmaene har bare pools. **Stjernekonsulenter** har navn, traits, ambisjon og lojalitet. De kjøpes i stjernemarkedet, og lav lojalitet gjør dem sårbare for poaching.
- **Utvikling** (nivå 2): Du kan sende en ansatt på kurs, gi hen en stjerne som mentor, sette hen på et strekkoppdrag eller ta en karrieresamtale. En med høyt potensial kan forfremmes til stjerne, høyst én i året. En egen stjerne er billigere og mer lojal enn en fra markedet. AI-firmaene sender folk på kurs, som løfter snittnivået. Bakgrunn: [`plans/2026-09-24-ansatte.md`](plans/2026-09-24-ansatte.md).
- **Fagmiljø** og **sosialt miljø** (0–100) drives av budsjett per hode og forfaller hvert kvartal. Sammen med omdømmet gir de **arbeidsgiverbrand**.
- **Trivsel** trekkes mot et mål som avhenger av kultur, utnyttelse (for lite å gjøre kjeder, for mye brenner ut), lønnstillegg og skandaler. Lav trivsel gir turnover.
- **Rekruttering:** Du bestiller folk per fagområde. Hvor mange som takker ja, avhenger av brand, lønn og omdømme. De begynner ved kvartalsskiftet og fakturerer fra neste kvartal.

### Økonomi

- Hver konsulent fakturerer et fast antall timer per kvartal til en listepris som øker med nivået, ganget med budets prisfaktor. Lønn, overhead og kulturbudsjetter trekkes hvert kvartal.
- **Bemanning:** Egne folk i riktig fag fyller setene først. Deretter **fleks** (ledige folk fra andre fag, til lavere pris), og til slutt **frilansere**, som gir et lite tap og litt lavere kundetilfredshet.
- **Kassekreditt:** Du kan gå i minus ned til en grense som vokser med omsetningen, mot rente.
- **Etterspørsel utenfra:** Markedet etterspør omtrent en fast andel av startkapasiteten, med vekst per år og trender. Etterspørselen følger bevisst *ikke* kapasiteten nedover. Da havner markedet i en dødsspiral (se balanseloggen).

### Anbud og kontrakter

- Et anbud har kunde, type (prosjekt eller rammeavtale), seter per fagområde, vekting mellom pris og kvalitet og buzzwords. Det publiseres i ett kvartal, kan bys på i to og starter kvartalet etter tildeling.
- **Et bud** har prisfaktor, tilbudte stjerner, innsats, eventuelt CV-juks og (på viktige anbud) et løfte om oppstart. Kvaliteten avhenger av CV-nivå, fagmiljø, møtet, innsats, omdømme, stjernenes traits, strategi og om du har nok ledige folk.
- **Score** = prisvekt × prisscore + kvalitetsvekt × kvalitet + relasjon + prioritetsbonus (kunden foretrekker oppdrag som betyr mye for firmaet) + støy. Bud under en minstekvalitet avvises.
- **Rammeavtaler** fordeles på de tre beste, og kunden ruller avrop hvert kvartal.
- **Viktige anbud** (rammeavtaler og store prosjekter) har kundemøte, og budet kan gi et bindende løfte om oppstart. **Rutineanbud** har ikke møte og kan besvares med et standardtilbud. Se [`plans/2026-09-24-mindre-anbudsmas.md`](plans/2026-09-24-mindre-anbudsmas.md).
- Ved tildeling forklarer spillet hvorfor du vant eller tapte.
- **Småoppdrag** på 1–2 personer publiseres hvert kvartal, slik at små firma har noe å leve av.
- **Kontrakter:** Fornøyde kunder forlenger prosjekter. Du kan pleie kunden, reforhandle prisen, selge inn flere seter og si opp kontrakten.

### Minispill

Minispillene gir poeng til budet eller krisen og bruker sin egen tilfeldighet, så de kan ikke spilles om igjen ved å laste inn på nytt. Hvert firma får ett forsøk.

- **Presentasjonsmøtet:** Kunden stiller tre spørsmål. Hvert svar har en stil (`concrete`, `visionary`, `humble`, `buzzword`), og kunden liker én av dem og misliker den motsatte.
- **Buzzword-bingo:** Finn anbudets buzzwords på et 4×4-brett før tiden går ut.
- **Krisesamtaler:** Pressekonferanse, allmøte og krisemøte med kunden. Publikum har en skjult favorittstil (ærlig, omsorgsfull, fakta eller spinn).

### Nivåer

Firmaet har nivå 1–5 (`LEVELS`) og rykker opp ved å nå ett av tre mål: antall ansatte, omsetning eller vunne anbud. Nivået låser opp større anbud og nye funksjoner (`FEATURE_LEVEL`): nøkkeltall, kultur, stjerner og rammeavtaler på nivå 2, bingo, bakrommet og Strategi-fanen på nivå 3, partnerskap og avdelinger på nivå 4, og oppkjøp og børsnotering på nivå 5. Hvert nytt nivå er et større kontor. Hvert nivå har frivillige mål med små belønninger (`content/missions.ts`).

Låsene gjelder AI-ene også. De starter på nivået størrelsen gir.

### Strategi

- **Spesialisering** i en sektor eller et fagområde gir bonus på anbud som passer.
- **Partnerskap** gir bonus i partnerens fagområde, mot en kvartalsvis avgift.
- **Lobbying** løfter relasjonen til offentlige kunder.
- **Avdelinger:** akademi (folk blir bedre), salg (bonus på alle bud) og nearshore (billigere frilansere).
- **Oppkjøp** av mindre konkurrenter: folk, stjerner, kontrakter og relasjoner flyttes over.
- **Børsnotering:** kontanter for en andel av selskapet. Etterpå teller bare eiernes andel, og markedet forventer vekst hvert kvartal.

### Bakrommet

Lyssky handlinger (`SHADY_CATALOG` i `engine/shady.ts`): spionasje på bud og lønninger, muldvarp, afterwork-poaching, stille outsourcing, CV-juks, bait-and-switch, rykter, lekkasjer til DN og LinkedIn-innlegg. Hver handling har kostnad, heat og en grunnsannsynlighet for å bli oppdaget, og høy heat øker den. Heat synker hvert kvartal.

Konsekvensene er **omdømme og bøter**, pluss en skandale som senker trivselen og en saftig nyhetssak. Pågående handlinger kan oppdages hvert kvartal så lenge de pågår. AI-ene jukser også, sjeldnere og mer tøysete.

### Hendelser, trender og kriser

- **Hendelser** (`content/events.ts`) er små dilemmaer med ett steg: el-sykkelordning, kick-off i Lisboa, kakekrig med Accentura. Spilleren får 0–2 per kvartal. De er krydder.
- **Trender** (`content/trends.ts`) som «GenAI-hype» og «Budsjettkutt i staten» endrer etterspørselen etter fagområder, volumet eller prisvekten i noen kvartaler.
- **Kriser** (`content/crises.ts`) er hovedretten. De varer over flere kvartaler, har skjult alvorlighetsgrad og koster ofte folk, ikke bare penger. Å dysse ned kan sprekke senere. AI-firmaene får egne kriser, som blir sladder i nyhetene. Se [`plans/2026-09-24-kriser.md`](plans/2026-09-24-kriser.md).

## Åpne spørsmål og mulige neste steg

- **Sluttrangeringen** bruker absolutt verdi, og topp-AI-ene er mye større enn spilleren. Forslaget er å rangere på verdivekst i forhold til startstørrelsen.
- **AI-ene bruker ikke Strategi-fanen** (spesialisering, partnerskap, avdelinger, oppkjøp og børsnotering). Det er i dag bare spillerens fordel.
- **Oppkjøp og børsnotering sammen** kan løfte en flink spiller svært mye (se balanseloggen). De naturlige knottene er `ACQUIRE_PREMIUM` og grensen på ett oppkjøp om gangen.
- **Leve av leveransen:** direkteoppdrag uten anbud og hendelser knyttet til en kontrakt (fase 2 i anbudsplanen).
- **Flere kriser:** se listen nederst i kriseplanen.
