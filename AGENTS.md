<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Neon is the only database, reached only through src/lib/neon.ts, which picks the transport (direct via DATABASE_URL on Vercel, Lovable connector in preview); server code checks availability only via `hasDatabase()`, never one transport's env vars. Idempotent migrations live in db/NN_*.sql; runtime DDL uses runSchemaEnsure. Why: a connector-only check crashed every sign-in on Vercel.
- Login ON rout.be (Better Auth, `better-auth.server.ts`) and login VIA rout.be (OIDC provider, `src/lib/oauth/*`) never share config; provider env vars use the `ROUT_PROVIDER_*` prefix. Why: one role must not break the other.
- Sign-in tiles always render; missing credentials are refused before auth with provider_not_configured (400) and a warning. Why: missing keys must not hide options or crash auth.
- Public profile visibility (`publicProfile`, `timelineVisible` in `display_prefs`) is enforced server-side in the public profile/timeline functions. Why: client checks leak data.
- Every env var name is documented in `ENVIRONMENT.md` (+ `.env.example`); provider env lookups go through `envAny()` aliases in `better-auth.server.ts` (incl. `<PROVIDER>_OAUTH_CLIENT_*`); the auth secret resolves via `resolveAuthSecret()` with a derived fallback. Why: one findable list; a missing variable never breaks all sign-ins.
- A failed provider-status check on the sign-in screen means unknown (buttons still try), never "all inactive". Why: a flaky status call must not disable logins.
- Every sign-in method returns through `/auth/continue`; destinations and tour drafts use HttpOnly cookies, never URLs. Tour drafts apply only to new accounts; taken handles fall back to onboarding. Why: zero-hop redirects, no token leakage, existing members never overwritten. Auth emails use `sendLocalizedEmail` with static template IDs and non-blocking dispatch so provider outages never break sign-in.
- ALTCHA uses self-hosted single-use proofs; db/54 owns replay DDL, unavailable storage fails closed, invalid proofs are refused before auth. Why: least privilege without weaker bot protection.
- Community stats are live counts; reviews show only when `approved` (db/65); empty sections hide. Approving a verification cancels that user's other open same-tier requests (`verification-dedupe.ts`). Why: no fake social proof or duplicate work.
- Vercel builds use nitro's `vercel` preset (via `VERCEL`); sandbox forces cloudflare.
- Third-party images on public pages load only via `/api/public/proxy-image` (host allowlist in `src/lib/image-proxy-rules.ts`). Why: visitors' IPs must never reach third-party image hosts.
- Emailed action links (review, booking) only confirm on GET, change on POST; status mails send fire-and-forget. Why: scanners open links; mail failures never block actions.
- 2FA/passkeys: Better Auth `twoFactor` + `@better-auth/passkey`, tables in `neon_auth` (db/77). Why: no custom crypto.
- Apply migrations with bun scripts/migrate-gateway.ts: statements split, one batch per transaction, tracked in schema_migrations. Why: gateway rejects multi-statement queries.
- Deployment mode comes only from `src/lib/app-mode.ts` (`VITE_APP_MODE`/`APP_MODE`): `appModeMiddleware` in `src/start.ts` 404s admin paths in public mode and confines admin mode to the portal (noindex), `assertAdminRole` refuses in public mode, and `api_.auth.$.ts` refuses social providers in admin mode. Why: the split must hold server-side, never only in the UI.
- Build mode filters route files via app-mode-routes.ts; admin files use admin.* names. Why: public bundles must exclude admin code.
- Shells load lazily by path; public builds exclude admin code. Preview mode overrides are UI-only. Why: previews must never loosen server access.
- Stamps: lock links before redeeming in one gateway transaction; enforce public profile visibility. Why: no cap overruns or private collections leaked.
- Open-web ownership is proven only by the server-side bio-check (`open-web-rules.ts` + `checkBioVerify`): `verified_via` is 'sso' or 'bio', and changing the handle drops bio verification. User-supplied fetch hosts (RSS, Mastodon) must pass `isPublicHost`. Why: no OAuth, no trust in client input, no SSRF.
- Guestbook (`guestbook.server.ts`, db/90): only signed-in members post, owners pin/delete via `owner_id` checks, public reads return pinned notes of public profiles only. Why: verified network effect, no spam, privacy enforced server-side.

- Admin control uses authenticated RPCs with assertAdminRole, keyset pages and explicit errors; transport logs store actual HTTP status/direction, never URLs or request bodies. Why: protect private data and avoid invented telemetry.
- Live-status windows: `live-presence-rules.ts`, applied server-side. Why: no client trust.
- Admin email entry checks configured owners or stored admin roles before auth; endpoint checks remain. Why: refuse members without granting privileges.
- Profile sections use profile-section-blocks.ts and blocks; explicit hidden/scheduled sections suppress fallbacks. Why: no duplicate or resurrected content.
