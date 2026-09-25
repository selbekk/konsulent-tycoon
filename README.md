# Konsulent Tycoon

Et turbasert, litt retro strategispill i nettleseren. Du starter et IT-konsulentselskap med seks personer og har 40 kvartaler (2027–2036) på å bygge det opp. Underveis konkurrerer du om anbud og rammeavtaler mot 24 AI-selskaper, bygger fagmiljø og sosialt miljø, rekrutterer og beholder folk. Hvis du tør, kan du også jukse litt i bakrommet.

Stemningen er inspirert av Theme Hospital og RollerCoaster Tycoon: tørr, varm humor og pikselgrafikk. Hele spillet finnes på bokmål og engelsk.

> Alle likheter med virkelige selskaper er helt tilfeldige (og kjærlig ment).

Spillet er under aktiv utvikling, og lagrede spill kan bli ugyldige mellom versjoner.

## Hva du gjør i spillet

- **Byr på anbud** mot konkurrentene: sett pris, velg hvem du tilbyr, og overbevis kunden i et presentasjonsmøte eller en runde buzzword-bingo.
- **Leverer kontrakter:** hold kundene fornøyde, reforhandle, selg inn mer, eller si opp når det ikke lønner seg.
- **Bygger et firma:** ansett folk, kjøp stjernekonsulenter, og hold fagmiljøet og trivselen oppe så folk blir.
- **Vokser gjennom fem nivåer** som låser opp større anbud, rammeavtaler, spesialisering, avdelinger, oppkjøp og børsnotering.
- **Håndterer kriser** som varer over flere kvartaler: varslingssaker, datalekkasjer, kunder som vil gå, og en flom i kjelleren.
- **Jukser, hvis du tør:** spionér på konkurrentene, pynt på CV-ene eller outsource i det stille. Blir du tatt, havner det i avisen.

Vinneren er firmaet med høyest verdi etter 40 kvartaler.

## Kjør spillet lokalt

Krever Node 24, samme versjon som CI og Cloud Functions bruker.

```bash
npm install
npm run dev        # http://localhost:5173
```

Det finnes ingen backend. Alt kjører i nettleseren, spillet lagres i `localStorage`, og det kan installeres som en app som virker offline. Anonym bruksstatistikk (PostHog) sendes bare hvis spilleren sier ja.

## Teknologi

React 19, TypeScript, Zustand og Vite, med Vitest for testene og i18next for språk. Spillmotoren er ren TypeScript uten avhengigheter til nettleseren, så hele partier kan simuleres i Node for å balansere spillet (`npm run sim`).

## Hvor ting ligger

```
src/engine/    Spillmotoren: regler, økonomi, anbud, AI-konkurrentene
src/content/   Spilldata: firma, kunder, hendelser, kriser, trender
src/ui/        React-grensesnittet, minispillene og pikselkontoret
src/i18n/      Tekstene på bokmål og engelsk
scripts/       Balansesimulatoren
docs/          Dokumentasjon
```

## Dokumentasjon

- [`docs/spilldesign.md`](docs/spilldesign.md): hva spillet er, og hvorfor det er laget slik
- [`docs/utvikling.md`](docs/utvikling.md): utviklerguiden, med arkitektur, konvensjoner og hvordan du legger til innhold
- [`docs/balance-log.md`](docs/balance-log.md): alle balanseendringer, med målte resultater
- [`docs/plans/`](docs/plans/): planer og beslutninger for større systemer
