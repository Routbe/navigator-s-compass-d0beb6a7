# Inlogfout op rout.be en rout.dlp.li verhelpen

## Gevonden oorzaak (bevestigd in de code)

De melding "Inloggen faalt aan serverzijde" is de algemene noodmelding van de inlog-server. Die verschijnt wanneer de inlogmodule crasht nog vóór ze een login kan verwerken.

De crash zit in de opstart van de inlogmodule (`createRoutAuth` in `src/lib/better-auth.server.ts`, regel 135):

```text
als NEON_API_KEY of LOVABLE_API_KEY ontbreekt -> fout "Neon-connector ontbreekt"
```

Die twee sleutels bestaan alleen in de Lovable-preview (dat is de Lovable-databasekoppeling). Op Vercel staat de database via `DATABASE_URL` ingesteld (zoals `ENVIRONMENT.md` voorschrijft) en zijn deze twee sleutels er niet. Gevolg: op Vercel weigert elke login, bij elke methode (e-mail, passkey, social), op beide domeinen. De databaselaag zelf (`src/lib/neon.ts`) ondersteunt `DATABASE_URL` wél prima; alleen deze controle blokkeert alles.

Dit verklaart ook waarom de eerdere fixes (domeinen, ALTCHA, foutlogging) niets oplosten: de code komt nooit voorbij deze regel. De foutmelding past bovendien in geen enkele specifieke categorie, daarom krijg je de algemene tekst.

Dezelfde verkeerde aanname zit op nog enkele plekken:
- `liveAuthChecks` en `authDiagnostics` (better-auth.server.ts): melden "database ontbreekt" op Vercel, omdat ze naar `NEON_API_KEY` kijken in plaats van naar `DATABASE_URL`.
- `resolveAuthSecret`: valt als reserve terug op `NEON_API_KEY`; op Vercel dus geen reserve. (Bij jou staat `BETTER_AUTH_SECRET` ingesteld, dus geen directe oorzaak, wel ongelijk gedrag.)
- `src/routes/api/claim-root.ts`: gebruikt `NEON_API_KEY` als databaseverbinding — werkt nergens (niet op Vercel, niet in de preview).
- `src/lib/weather-db.server.ts`: werkt alleen via de Lovable-koppeling; op Vercel valt het weer-onderdeel stil uit.

## Wat ik aanpas (alleen stabiliseren, geen nieuwe functies)

1. **Inlogmodule**: de harde controle vervangen door "database beschikbaar = `DATABASE_URL` óf (`NEON_API_KEY` + `LOVABLE_API_KEY`)". Ontbreekt beide, dan een duidelijke foutcode `missing_database` in plaats van de algemene melding.
2. **Diagnose en gezondheidscheck**: dezelfde regel gebruiken, zodat `/api/public/health` op Vercel de echte toestand toont.
3. **Reserve-geheim**: `DATABASE_URL` toevoegen als reservebron, naast de bestaande.
4. **claim-root**: de gedeelde databaselaag (`sql` uit `src/lib/neon.ts`) gebruiken in plaats van een eigen verbinding met de verkeerde sleutel.
5. **weer-database**: via de gedeelde databaselaag laten lopen (werkt dan op Vercel én in de preview).
6. **Veiligheidsnet voor de databaseverbinding op Vercel**: als de serveromgeving geen ingebouwde WebSocket heeft, de al geïnstalleerde `ws`-bibliotheek gebruiken voor transacties (voorkomt een volgende crash op oudere Node-versies).
7. **Één gedeelde helper** (`hasDatabase()` in `src/lib/neon.ts`) zodat deze aanname niet opnieuw op losse plekken uit elkaar loopt.

## Controle

- Een kleine test: de inlogmodule start met alleen `DATABASE_URL` (zonder Lovable-sleutels) en weigert met `missing_database` als er geen enkele databasebron is.
- Bestaande tests (auth, altcha, app-mode) opnieuw draaien, plus typecheck en build.
- In de preview controleren dat inloggen en `/api/public/health` nog werken via de Lovable-koppeling.
- Na jouw Vercel-deploy: `https://rout.be/api/public/health` en `https://rout.dlp.li/api/public/health` openen en een e-maillogin proberen. Mocht er toch iets falen, dan staat de exacte oorzaak nu als `[BetterAuth Error]` in de Vercel-logs.

## Technische details

- `AGENTS.md`: de regel "Neon is the only database ... never connection strings" bijwerken naar: `src/lib/neon.ts` kiest zelf de verbinding (direct via `DATABASE_URL` op Vercel, Lovable-koppeling in de preview); servercode controleert de beschikbaarheid alleen via `hasDatabase()`.
- Pushen naar GitHub gebeurt automatisch via de GitHub-koppeling van het project zodra de wijzigingen klaar zijn; daarna bouwt Vercel opnieuw.
