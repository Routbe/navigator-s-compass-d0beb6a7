# Live status, anonieme vragen en verificatie per component

## 1. Spotify verschijnt niet tijdens het luisteren (eerst onderzoeken)
De oorzaak is nog niet bevestigd. Kandidaten die ik in de code zag:
- "Toon op profiel" staat mogelijk standaard uit na het koppelen, waardoor de openbare opvraging niets teruggeeft.
- De opslag van de laatste track (muziekstatus) kan ontbreken; fouten daar worden stil genegeerd.
- Spotify-sleutels of de versleutelingssleutel ontbreken in die omgeving, dan antwoordt de server altijd "speelt niets".
- Een verlopen Spotify-toegang wordt niet vernieuwd, of Spotify geeft "geen actief apparaat" terug.

Aanpak: echte gegevens van een gekoppeld account bekijken, de openbare "nu aan het luisteren"-opvraging live testen, dan de werkelijke oorzaak oplossen. Spotify toont alleen wanneer er effectief iets speelt; anders verborgen.

## 2. Live status voor alle integraties: alleen zichtbaar bij (recent) gebruik
- Eén gemeenschappelijke regel: elke live-integratie heeft een "actief"-venster.
  - Spotify: alleen tijdens afspelen.
  - GitHub, GitLab: alleen bij activiteit in de laatste 24 uur (bv. "pushte 2 u geleden naar repo X").
  - Mastodon / Bluesky / W Social: laatste bericht van de laatste 24 uur.
  - Chess.com / Lichess blijven zoals nu.
- Buiten dat venster verdwijnt het blok vanzelf van het profiel.
- Elke live-integratie wordt ook een toevoegbaar component in de Component-bibliotheek (nieuwe groep "Live status").

## 3. Anonieme vragen: herstellen + aan/uit
- Eerst de echte fout reproduceren (versturen op een openbaar profiel) en die oplossen.
- Nieuwe schakelaar in de studio: "Anonieme vragen op mijn profiel". Uit = blok verborgen en de server weigert nieuwe vragen.

## 4. Eerst gebruikersnaam, dan "Verifiëren" in het component
- Bij toevoegen van een component of integratie vraag je eerst je gebruikersnaam/handle; daarmee is het meteen gekoppeld (nog niet geverifieerd).
- In het vakje van dat component in de studio staat een knop "Verifiëren":
  - Bluesky en W Social: opent de officiële inlog van die dienst (zelfde open protocol).
  - Mastodon, GitHub, GitLab: opent de officiële inlog van die dienst.
  - Meta (Instagram/Facebook): officiële Meta-koppeling, alleen als er Meta-app-sleutels zijn; anders bio-code-controle.
  - Diensten zonder officiële inlog: bestaande bio-code-controle.
- Na succesvolle inlog krijgt het component een verificatievinkje; handle wijzigen haalt het vinkje weg.

## Technische details
- Spotify: query op `user_presence_connections` (show_on_profile, scopes) en `user_music_status`; test `/api/presence/now-playing`; logging toevoegen in `cachedNowPlaying`/`accessToken` i.p.v. stil falen.
- Nieuwe `live-presence-rules.ts` met per provider een `activeWindowMs` + pure `isActive()`, met tests (Spotify alleen bij `is_playing`, GitHub 24 u).
- GitHub/GitLab/fediverse-activiteit via openbare API's, gecached per gebruiker, hosts via `isPublicHost`; afbeeldingen via de image-proxy.
- Vragen: `questionsEnabled` in `display_prefs`, server-side afgedwongen in `askQuestion` en `publishedQuestions`; test voor uit = geweigerd.
- Verificatie hergebruikt de bestaande inlogstromen (bluesky/mastodon start+callback, Better Auth GitHub/GitLab) in "link"-modus die `verified_via='sso'` op `user_integrations` zet; nooit vertrouwen op client-input.
- Meta vereist eigen app-sleutels (META_APP_ID/SECRET), gedocumenteerd in ENVIRONMENT.md.
