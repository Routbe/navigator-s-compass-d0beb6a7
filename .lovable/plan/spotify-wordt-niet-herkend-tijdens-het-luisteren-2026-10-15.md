# Spotify wordt niet herkend tijdens het luisteren

## Wat de echte gegevens tonen
- Je koppeling voor @jdelplanche bestaat, staat op "Toon op profiel" en de Spotify-toegang werd vanochtend (08:00) nog succesvol vernieuwd. De koppeling zelf werkt dus.
- Om 08:02 vroeg je profiel Spotify wat er speelde en kreeg als antwoord "speelt niets" — terwijl jij muziek aan had.
- De fout zit dus in het antwoord van Spotify, niet in je profiel of de weergave. Onze code gooit elk foutantwoord van Spotify stil weg en maakt er "speelt niets" van, waardoor we niet zien waarom.

## Meest waarschijnlijke oorzaken (nog te bevestigen)
1. Je Spotify-app staat in "Development mode": dan antwoordt Spotify met een weigering voor elk account dat niet handmatig is toegevoegd onder "User Management" in het Spotify Developer Dashboard.
2. Je luistert in een "Privésessie" of naar een podcast/advertentie: dan geeft Spotify geen nummer terug.
3. Het tijdens het koppelen gekregen toestemmingsbereik mist (oude koppeling).

## Wat ik ga doen
1. Het echte antwoord van Spotify loggen (statuscode + reden, nooit tokens) in plaats van het stil te negeren.
2. In de Studio, bij Spotify, een knop "Test verbinding" die meteen toont wat Spotify antwoordt in gewone taal, bv. "Spotify weigert: voeg je account toe in User Management", "Er speelt niets", "Privésessie", of "Werkt: nu speelt X".
3. Ook podcasts tonen (titel van de aflevering) in plaats van ze te negeren.
4. Een kleine fout rechtzetten: als je een alias-profiel hebt, kan de zichtbaarheidsinstelling van je alias die van je hoofdprofiel overschrijven.
5. Test toevoegen voor de vertaling van Spotify-antwoorden naar die meldingen.
6. Daarna samen met jou testen: muziek aanzetten, op "Test verbinding" drukken, en de oorzaak oplossen.

## Technische details
- `nowPlaying()` in `spotify-presence.server.ts`: retourneer een `reason` (`forbidden_403`, `unauthorized_401`, `no_content_204`, `rate_limited_429`, `not_playing`, `unsupported_type`), log `[spotify] currently-playing <status> <body.error.message>`; bij 401 één keer token forceren te verversen.
- `additional_types=episode` toevoegen aan de request; episode-velden mappen.
- Nieuwe `testSpotifyPresence` serverfunctie (requireAuth) die `nowPlaying` direct aanroept (cache omzeilen) en `reason` teruggeeft; knop in de Spotify-instellingen in Studio.
- `publicSpotifyOwner`: `display_prefs` van de alias alleen gebruiken als de handle de alias is.
- Pure helper `explainSpotifyStatus(status, body)` + test.
