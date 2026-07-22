# Pitfalls Research

**Domain:** Adding a Supabase backend (auth + Postgres + Realtime) to a shipped **offline-first PWA** (Guezzer → "Gizz With Friends", v2.0), for ~5 friends at dead-signal live venues
**Researched:** 2026-07-22
**Confidence:** HIGH (spike-validated blueprint 002–004 + Supabase docs/issue verification; offline-refresh and SW-caching collisions are the highest-risk, lower-confidence areas and are flagged inline)

> Scope note: these are pitfalls **specific to bolting Supabase onto THIS system** — an offline-first, iOS-PWA, pure-core app that already fights IndexedDB eviction and uses a `registerType:'prompt'` Workbox service worker. Generic "how to use Supabase" advice is omitted. The four collision zones flagged 🔴 (startup blocking, SW caching, iOS eviction, offline token refresh) are where offline-first and Supabase actively fight each other and deserve the most roadmap attention.

---

## Critical Pitfalls

### Pitfall 1: 🔴 Blocking app startup on a live auth / network check

**What goes wrong:**
The app awaits a network round-trip during boot — `getUser()` (which hits the GoTrue server), a `refreshSession()`, or a "am I online / is my token valid" probe — before rendering Show Mode. At a venue with no signal the promise hangs until timeout, so the app shows a spinner or a login wall precisely when the user needs one-thumb predictions in the dark. This regresses the app's entire core value ("fully offline once loaded").

**Why it happens:**
Supabase's own quickstarts model a server/SSR world where `getUser()` (network-verified) is the "safe" call. Developers copy that pattern into a client-only PWA. `getUser()` and `refreshSession()` touch the network; `getSession()` restores synchronously from localStorage with no network — the distinction is easy to miss.

**How to avoid:**
Boot from `getSession()` **only** — it hydrates the session synchronously from localStorage and works fully offline. Render the app immediately from whatever session exists (or the unauthenticated shell). Let `onAuthStateChange` handle login/logout/refresh **reactively** after paint. Never `await` a Supabase network call on the critical boot path. Treat "signed in" as a local fact, "token freshly verified" as an eventual, online-only reconciliation. (Blueprint: "Restore from `getSession()` synchronously; reconcile when online.")

**Warning signs:**
A blank screen or spinner in airplane mode; any `await sb.auth.getUser()` / `refreshSession()` reachable before first paint; login gate appearing when offline for an already-logged-in user; an offline-reload E2E test that only passes with network.

**Phase to address:**
**Auth & offline-safe session phase** (the phase that introduces the Supabase client). Add an explicit airplane-mode cold-boot device test to that phase's UAT, mirroring the existing v1 offline-reload gate.

---

### Pitfall 2: 🔴 Service worker / Workbox caching auth-token or data responses (and mishandling the Realtime WebSocket)

**What goes wrong:**
Two distinct failures:
1. **Runtime-cache poisons auth/data.** A Workbox `runtimeCaching` rule with a broad `urlPattern` (or a `StaleWhileRevalidate`/`NetworkFirst` catch-all) matches the Supabase REST (`/rest/v1/...`) or auth (`/auth/v1/...`) origin. The SW then serves a **stale** token-refresh response, a stale RLS-gated read, or a cached POST result. Symptoms range from "logged-out user still sees data" to "writes appear to succeed but 401 on the server" to a token that can never refresh because the refresh endpoint is being served from cache.
2. **WebSocket assumptions.** Developers try to "make Realtime work offline" by caching it — but `wss://` Realtime connections are **never** interceptable by the SW `fetch` handler (service workers don't see WebSocket frames). Attempts to cache/replay Realtime are wasted effort; conversely, Realtime simply fails silently offline, which is the correct, acceptable behavior for this app.

**Why it happens:**
The existing app already has a Workbox SW with runtime caching for the kglw.net `latest` endpoint. It's tempting to add Supabase URLs to the same caching config, or to leave a permissive `urlPattern`. The mental model "cache everything for offline" is exactly right for the static app shell and exactly wrong for auth/token/data.

**How to avoid:**
- **Explicitly exclude the Supabase origin from all runtime caching.** Auth and REST calls must always be `NetworkOnly` (or simply never matched by any `runtimeCaching` `urlPattern`). Scope the existing kglw.net rule tightly so it can't accidentally match Supabase.
- The `@supabase/supabase-js` bundle rides **inside the app JS bundle** and is precached by `globPatterns` automatically — that's correct and desired (offline-complete first load). Do **not** add a runtime rule for the Supabase JS; it's already in precache.
- Treat Realtime as online-only by design. Do not attempt to cache `wss://`. Ensure the app degrades gracefully (presence/reactions just go quiet offline).
- Keep `registerType:'prompt'` — an auto-updating SW swapping the app (and its Supabase client version / session-handling code) mid-show is the exact failure this project already forbids.

**Warning signs:**
A `runtimeCaching` `urlPattern` regex that could match `*.supabase.co`; 401s that only happen after going offline and back; a user who "can't log out" (cached session response); DevTools → Application → Cache Storage containing `/auth/v1/` or `/rest/v1/` entries; Realtime appearing to "work" in a cache test (it can't — you're seeing stale DB reads, not live events).

**Phase to address:**
**PWA / service-worker integration phase** (or a hardening task inside the Auth phase). Verification: inspect Cache Storage after an auth+sync session — zero Supabase entries expected.

---

### Pitfall 3: 🔴 Token refresh while offline for long stretches (blueprint's known open item)

**What goes wrong:**
A friend boots the app at a venue after the access token (default 1-hour JWT expiry) has already lapsed. `getSession()` still returns the stored session (offline boot works — Pitfall 1 handled), but the token is **stale**: the first authenticated write (progress upsert) or Realtime subscribe will 401 / fail to authorize because refreshing the JWT **requires network**, which isn't there. Worse: with `autoRefreshToken` on, an expired-token `getSession()` will *attempt* a refresh internally and can transiently clear/replace the session, producing confusing "logged out" flickers. (Verified: supabase auth-js refreshes on `getSession()` when the token is expired and that refresh needs the network — auth-js #677.)

**Why it happens:**
JWTs are short-lived by design (default 3600s). Refresh tokens are long-lived and single-use, but **exchanging** one for a new access token is a network call. Offline for hours (a whole show) guarantees the access token expires mid-session. The blueprint explicitly flags this as an open item: "an unexpired token boots offline fine; a very stale one needs reconnection before writes succeed."

**How to avoid:**
- **Do not treat token-expired-offline as a logout.** Distinguish "no valid token *right now*" from "not authenticated." Keep the user in the app, keep local writes flowing to the **Dexie outbox** (see Pitfall 8), and flush to Supabase on reconnect after a successful refresh.
- **Raise the JWT expiry limit** in Supabase Auth settings (e.g., toward the max, ~1 week / 604800s) so a token minted before a show is very likely still valid *through* the show — cheap, high-leverage mitigation for the exact usage pattern (log in on wifi before the venue). Trade-off: a longer window before a revoked token stops working, acceptable at 5 trusted friends.
- On regaining connectivity, explicitly `refreshSession()` (or let `onAuthStateChange`'s `TOKEN_REFRESHED` fire) **before** flushing the outbox. Gate server writes on "session currently valid," not on "user object exists."
- Surface a calm, non-blocking "syncing…/offline — will sync" affordance rather than an error. This is a UX/reconnect detail, not an architecture change (blueprint guidance).

**Warning signs:**
401s or silent write failures after a long offline stretch; a "logged out" flicker on cold boot with an old session; progress that never syncs after reconnect because the flush ran before the refresh; Realtime `CHANNEL_ERROR` on resubscribe post-reconnect.

**Phase to address:**
**Auth & offline-safe session phase** owns the refresh/reconnect logic and the JWT-expiry config decision. The **Shared-progress phase** owns the "refresh-then-flush-outbox" ordering. Add a long-offline device test (log in on wifi, go airplane >1h, attempt a catch, reconnect) to UAT.

---

### Pitfall 4: 🔴 iOS Safari evicting the Supabase localStorage session

**What goes wrong:**
Supabase-js stores its session (access + refresh token) in **localStorage** by default. iOS Safari's 7-day cap on script-writable storage for non-installed PWAs — and its general eviction pressure under storage stress — is the *same eviction class* the app already fights for IndexedDB. Eviction here means the refresh token is gone → the friend is silently logged out and, if offline, **cannot log back in at the venue** (login needs network). This is strictly worse than the existing dex-eviction problem because there's no offline recovery path.

**Why it happens:**
Developers assume "logged in" is durable. On iOS it isn't, especially for a browser-tab (non-installed) PWA. localStorage and IndexedDB share the same eviction fate; the app's existing mitigations were built for IndexedDB and don't automatically cover the auth session unless deliberately extended.

**How to avoid:**
- **Reuse the existing eviction defenses for the session:** the app already calls `navigator.storage.persist()` and hard-pushes home-screen install. Persistent storage covers the whole origin (localStorage *and* IndexedDB), so the existing `persist()` call already helps — verify it's requested **before/independent of** login, not gated behind an authed flow.
- **Double down on "install to home screen"** as a v2.0 onboarding gate: an installed PWA is not subject to the 7-day script-storage cap and is far less likely to evict. Make install the explicit prerequisite messaging for multi-user features.
- **Log in on wifi, before the venue** — bake this into onboarding copy. Combined with a raised JWT expiry (Pitfall 3), a pre-show login survives the show.
- **Optional hardening:** provide a custom Supabase `auth.storage` adapter that mirrors the session into the app's already-persisted IndexedDB (Dexie), so an evicted localStorage can be rehydrated on next boot. Only worth it if real-world eviction bites; the JSON-export backstop does **not** apply to tokens (never export refresh tokens).
- Never rely on the session as the source of truth for *dex data* — dex stays local + JSON-exportable exactly as today. Eviction of the session must degrade to "log in again," never "lost progress."

**Warning signs:**
Friends report being logged out between sessions on iPhone; login prompts appearing at the venue; `getSession()` returning null on a device that was logged in yesterday; higher logout rate on non-installed (Safari-tab) users vs installed.

**Phase to address:**
**Auth phase** (session storage strategy + `persist()` verification) and the **onboarding/rebrand phase** (install-first messaging, "log in on wifi" copy). Verification: 7+ day device test on an installed vs non-installed iPhone PWA.

---

### Pitfall 5: RLS misconfiguration — write-own not enforced, or Realtime silently dead

**What goes wrong:**
Three sub-failures, all quiet:
1. **RLS not enabled / no policy** → with RLS off, the authenticated key can read and write *everyone's* rows. With RLS on but no policy, everything is denied and writes silently fail.
2. **"Write-own" not actually enforced** → an `insert`/`update` policy missing the `with check (auth.uid() = user_id)` clause lets any authenticated friend overwrite another friend's progress row (spoof `user_id`). At 5 trusted friends the blast radius is small, but it's a correctness bug (someone's dex count gets clobbered).
3. **Forgetting `alter publication supabase_realtime add table ...`** → `postgres_changes` **silently never fires**. The friends view just never updates live; no error, no log. (Blueprint calls this out explicitly; verified against Supabase docs + issue #35195.)
4. **Realtime respects RLS SELECT** → `postgres_changes` only delivers rows the subscriber can `SELECT`. The read-all `select ... using (true)` policy makes this work; if SELECT is ever tightened, Realtime for those rows goes dark even though the publication is correct. (Verified: Supabase Realtime docs + issue #35195.)

**Why it happens:**
RLS is off by default on new tables created in raw SQL (the dashboard nags, the CLI/SQL doesn't). The publication step is a separate, easy-to-forget line. The RLS↔Realtime SELECT coupling is non-obvious. All failures are silent (no thrown error), so they pass a happy-path demo and only surface as "live updates don't work" or "someone's data got overwritten."

**How to avoid:**
- Apply the blueprint schema verbatim: `enable row level security` + `read all` (select to authenticated using true) + `write own` (insert with check `auth.uid()=user_id`) + `update own` (update using + with check) + `alter publication supabase_realtime add table public.progress`. Keep this in a committed `schema.sql`, not clicked in the dashboard, so it's reproducible.
- Write a tiny RLS test: with two seeded users, assert user A **cannot** update user B's row (expect failure) and **can** read it (expect success). This is the equivalent of the app's existing "unit tests with known expected outputs" discipline, applied to RLS.
- Treat "Realtime not firing" debugging as a checklist: (a) table in `supabase_realtime` publication? (b) SELECT policy permits the subscriber? (c) subscribed after a full re-pull? (see Pitfall 8 race).

**Warning signs:**
Friends view updates only on manual refresh (publication missing); a progress count that resets or shows someone else's name (write-own hole); `subscribe()` returns `SUBSCRIBED` but callbacks never fire; it works for your own writes but not others' (SELECT policy too tight).

**Phase to address:**
**Backend foundation phase** (schema + RLS + publication, with the two-user RLS test). Realtime-SELECT coupling re-verified in the **Shared-progress phase**.

---

### Pitfall 6: Leaking the `service_role` key / committing secrets to git

**What goes wrong:**
The `service_role` key **bypasses RLS entirely** — it's a full-database god key. If it's committed to git, embedded in the client bundle, or pasted into a Vite `VITE_`-prefixed env var (which Vite **inlines into the public client bundle**), anyone can read/write/delete the whole database. This is the single highest-severity mistake in the milestone.

**Why it happens:**
The seed script needs `service_role` to create accounts via the GoTrue admin API. Developers stash it in `.env` next to the anon key, then either commit `.env` or, fatally, prefix it `VITE_SERVICE_ROLE_KEY` so Vite exposes it. The anon key is *supposed* to be public, blurring the line.

**How to avoid:**
- `service_role` lives **only** in the seed script's environment (`SUPABASE_SERVICE_ROLE_KEY`, no `VITE_` prefix), run locally/CI, **never** imported by app code. The seed script is dependency-free Node using `fetch` (blueprint).
- Ensure `.env*` is gitignored; commit a `.env.example` with placeholder names only. Add a pre-commit / CI secret scan (e.g., gitleaks) given this repo's "secrets out of git" constraint.
- The client only ever uses `SUPABASE_URL` + `SUPABASE_ANON_KEY` (safe to inline). Distinct per-person passwords also stay out of git — env-only at seed time (blueprint: spike used one throwaway `SEED_PASSWORD`; real build uses distinct passwords).
- If a `service_role` key is ever exposed, **rotate it immediately** in the Supabase dashboard (recovery table below).

**Warning signs:**
Any `VITE_`-prefixed service key; `service_role` string appearing in `dist/`; `.env` tracked by git; the seed script imported from app code; secret-scan CI failure.

**Phase to address:**
**Backend foundation phase** (seed script + env hygiene + secret-scan CI). This is a gate — no client code touches `service_role`, ever.

---

### Pitfall 7: Treating the public anon key / emails as "leaked" (misplaced security effort)

**What goes wrong:**
The inverse mistake: panic that the **anon key** and user **emails** are visible in the client bundle / network tab, and either try to hide them (wasted, impossible for a static PWA) or assume the system is therefore insecure and add pointless obfuscation. Meanwhile the *actual* gates — passwords and RLS — get less attention.

**Why it happens:**
"API key in the client" pattern-matches to "leaked secret." But the anon key is **designed** to be public; it grants nothing beyond what RLS allows. The real authentication gate is the per-person password; the real authorization gate is RLS.

**How to avoid:**
- Accept that anon key + project URL are public by design (blueprint). Spend the security budget on: (a) strong distinct per-person passwords, (b) correct RLS (Pitfall 5), (c) `service_role` never leaking (Pitfall 6).
- Since accounts are hand-created with `email_confirm:true` and there's no public sign-up, **disable public sign-ups** in Supabase Auth settings so a leaked anon key can't be used to self-register into the group.
- Emails being visible to the 5 friends is fine (they know each other). Don't expose them to the truly public web unnecessarily, but don't treat their presence in an authed API response as a breach.

**Warning signs:**
Time spent obfuscating the anon key; public sign-up left enabled (a stranger with the anon key could register); assuming RLS is optional because "the key is secret anyway."

**Phase to address:**
**Backend foundation phase** (disable public sign-up; document the anon-key-is-public rationale so it isn't relitigated).

---

### Pitfall 8: Sync races / double-writes in the Dexie → Supabase queue

**What goes wrong:**
The app writes progress locally (Dexie, offline-first) and must mirror it to Supabase. Naive designs produce:
- **Lost updates / count resets** — a full-row `upsert` that includes the count column overwrites a newer server value with a stale local one, or the blueprint's own footgun: upserting non-identity columns resets `songs_caught`. (Blueprint: "upsert only identity columns so counts aren't reset.")
- **Double-writes** — reconnect flush + a Realtime echo + a `liveQuery` re-trigger all fire the same upsert; or two tabs/devices flush concurrently.
- **Subscribe-before-pull race** — `subscribe()` reports `SUBSCRIBED` before Postgres logical replication is fully attached, so a change fired in that window is missed and the UI shows stale data. (Verified: Supabase discussion #35147.)
- **Realtime echo loop** — the client applies its own broadcast/`postgres_changes` echo as if it were remote, re-triggering a write.

**Why it happens:**
Offline-first inherently means "queue local mutations, reconcile later," but Supabase gives no built-in outbox/CRDT. Dexie `liveQuery` reactivity (already used heavily in this app) makes it easy to accidentally wire "any local change → push to server" in a loop with "any server change → write local."

**How to avoid:**
- **Dexie outbox pattern:** local writes go to Dexie (source of truth for the user's own data) + an outbox/dirty flag. A single flush worker drains the outbox to Supabase on reconnect, **after** a successful token refresh (Pitfall 3). Make flush **idempotent** (upsert keyed on `user_id`, `onConflict:'user_id'`) so a retried flush is a no-op.
- **Upsert identity columns only** for shared rows whose counts are authoritative locally; on any `postgres_changes`, **re-pull** (full-table re-pull is fine at ~5 rows — blueprint).
- **Pull → subscribe → re-pull once** — initial full read, subscribe, then re-pull on the first `SUBSCRIBED`/after a short delay to close the replication-attach race.
- **Ignore your own echo** — tag writes with local `user_id`, skip applying `postgres_changes` where `new.user_id === myUserId` (you already hold the local truth), or debounce re-pulls.
- Single-writer discipline: one flush path, not per-component upserts scattered through the UI.

**Warning signs:**
Progress counts that flap or reset; duplicate rows / duplicated toasts on reconnect; friends view briefly stale after load then correct (missed first event); a write firing twice per user action in the network tab; a `liveQuery` → upsert → `postgres_changes` → local write feedback loop.

**Phase to address:**
**Shared-progress phase** (outbox, idempotent flush, upsert-identity-only, pull→subscribe→re-pull ordering). Add a fixture-style unit test for the merge/flush logic, consistent with the app's existing "known expected outputs" testing rule.

---

### Pitfall 9: CORS / origin & Realtime WebSocket connection issues from tunnel or deployed origin

**What goes wrong:**
Auth or Realtime works on `localhost` but breaks from the **cloudflared HTTPS tunnel** (the app's established iOS device-test path) or the deployed static host:
- Auth Site URL / allowed-origin settings reject the tunnel/prod origin.
- The Realtime `wss://` connection fails behind a proxy/tunnel that doesn't forward WebSocket upgrades, or is blocked by a restrictive CSP `connect-src` in the PWA.
- A mixed-content or `base`-path misconfig (the app already sets Vite `base` for some hosts) breaks client init.

**Why it happens:**
Supabase's REST/auth CORS is permissive by default, but **Auth redirect/Site URLs** are allowlisted, and WebSockets have stricter proxy/CSP requirements than plain fetch. The app's tunnel-based device testing adds an origin that must be accounted for. A hardened PWA CSP that lists `connect-src` for kglw.net but not `*.supabase.co` (both `https:` and `wss:`) silently kills auth+Realtime.

**How to avoid:**
- Add every real origin (tunnel domain, deployed static host, `localhost`) to Supabase Auth **Site URL / redirect allowlist** — with password auth (no OAuth redirect) this matters less, but set Site URL correctly.
- CSP/`connect-src` must include `https://*.supabase.co` **and** `wss://*.supabase.co` (Realtime). Verify against the app's existing CSP that already scopes kglw.net.
- Confirm the cloudflared tunnel forwards WebSocket upgrades (it does by default over HTTPS) — test Realtime specifically over the tunnel on-device, not just fetch.
- Keep the Supabase client init origin-agnostic (URL + anon key from env), so tunnel vs prod is purely a config/allowlist difference.

**Warning signs:**
Realtime `CHANNEL_ERROR`/immediate disconnect only over the tunnel or prod; auth calls blocked by CORS/CSP in the console on non-localhost; presence never syncs on-device but works in desktop dev; CSP violation reports for `wss:`.

**Phase to address:**
**Presence & reactions phase** (Realtime over the real origin) with a shared task in the **PWA/deploy phase** for CSP `connect-src`. Verify on-device over the cloudflared tunnel, matching the app's established UAT method.

---

### Pitfall 10: Coupling the Supabase client into `packages/core` and breaking purity

**What goes wrong:**
The Supabase client (which touches `window`, `localStorage`, `fetch`, WebSockets) gets imported into `packages/core` — directly, or transitively via a "sync service" or a shared type that drags in the client. This violates the hard core-purity constraint (`"lib":["ES2023"]`, no DOM, no React, Node-CLI-runnable including the backtest). The compile-time guard (core `package.json` has no such dependency; `erasableSyntaxOnly`) turns it into a build error — but a poorly placed import still costs a refactor, and worse, it can make the backtest/CLI un-runnable.

**Why it happens:**
It feels natural to put "domain logic" like "compute my dex progress payload" in core, then reach for the client to send it. Or a shared `types` module re-exports a Supabase type, transitively pulling the SDK.

**How to avoid:**
- **All Supabase (client, auth, Realtime, outbox, subscriptions) lives in the app layer**, never in core (blueprint: "the transition matrix / dex derivations never import the Supabase client"). Core computes *values* (e.g., a serializable progress summary from local dex data); the app layer *sends* them.
- If a shared shape is needed, define a **plain serializable interface in core** (no Supabase import) and have the app layer map it to/from Supabase rows/zod schemas — mirroring how the transition matrix is a plain-JSON contract consumed by multiple app-layer renderers.
- Keep the compile-time guard intact: core `tsconfig` stays `lib:["ES2023"]`, no DOM; core `package.json` never gains `@supabase/supabase-js`. Rely on that being a build error, not a review catch.
- Validate Supabase payloads with **zod in the app-layer ingestion boundary** (the app already uses zod for the kglw.net schema), not in core.

**Warning signs:**
`@supabase/supabase-js` appearing in `packages/core`'s dependency graph; the backtest/corpus CLI failing to run under Node (DOM/`window` reference); a core test needing jsdom/browser globals; a core file importing `../app/...`.

**Phase to address:**
**Backend foundation / Auth phase** (establish the app-layer client boundary from the first commit). Verification: core CLI (`node packages/core/.../backtest.ts`) still runs; core test project stays `environment:'node'`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Full-row `upsert` (incl. counts) instead of identity-only + re-pull | One-liner sync | Stale-overwrite resets someone's dex count; lost updates | **Never** for authoritative counts — upsert identity cols, re-pull on change (blueprint) |
| Shared throwaway password for all accounts | Fast seeding (spike did this) | Anyone with it is anyone; no per-person identity integrity | Only in spikes/dev — real build uses distinct per-person passwords |
| Default 1-hour JWT expiry | Zero config | Guarantees token expires mid-show → offline write failures | Never for this app — raise JWT expiry to survive a show |
| Skip the Dexie outbox; write straight to Supabase on user action | Less code | Every offline action is silently lost; no reconcile | Never — offline-first is the core value; outbox is mandatory |
| Presence/waves persisted to Postgres "to be safe" | Feels durable | Row churn, RLS complexity, defeats ephemeral design | Never — ephemeral rides Realtime, DB rows only for durable progress (blueprint) |
| Mirror session into IndexedDB custom storage adapter | Survives localStorage eviction | Extra code + a second token store to keep in sync | Only if real iOS eviction of the session is observed; try `persist()`+install first |
| Reuse the kglw.net Workbox runtime-cache rule for Supabase | One config | Poisoned auth/data cache (Pitfall 2) | **Never** — Supabase origin is NetworkOnly/unmatched |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (boot) | `await getUser()`/`refreshSession()` on boot (network) | `getSession()` sync restore; reconcile via `onAuthStateChange` when online |
| Supabase Auth (offline) | Treat expired-token-offline as logout | Keep user in app; queue to outbox; refresh-then-flush on reconnect; raise JWT expiry |
| Workbox SW | Runtime-cache the Supabase origin / try to cache Realtime | Exclude `*.supabase.co` from runtime caching (NetworkOnly); precache only the bundled SDK; `wss://` isn't cacheable and shouldn't be |
| Postgres Realtime | Forget `alter publication supabase_realtime add table` | Add table to publication; keep in committed `schema.sql`; verify events fire |
| Realtime + RLS | Assume publication alone enables events | Realtime needs a permissive SELECT policy for the subscriber (read-all satisfies it) |
| Realtime subscribe | Read once, subscribe, trust it | pull → subscribe → re-pull on first `SUBSCRIBED` (replication-attach race) |
| Vite env | `VITE_SERVICE_ROLE_KEY` (inlined into bundle) | `service_role` env-only in seed script, no `VITE_`; client gets anon key only |
| `packages/core` | Import Supabase client for "sync logic" | Client stays app-layer; core exposes plain serializable payloads |
| CSP / tunnel | `connect-src` lists kglw.net only | Add `https://*.supabase.co` and `wss://*.supabase.co`; test Realtime over the cloudflared tunnel |

## Performance Traps

At ~5 users these barely bind, but worth noting so they aren't baked in wrong:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-table re-pull on every `postgres_changes` | Extra reads per event | Fine at ~5 rows (blueprint) — switch to patch payloads only if the table grows | Hundreds+ rows |
| Re-subscribing / leaking Realtime channels on every render | Growing socket count, duplicate events | Create channel once per view lifecycle; `removeChannel` on unmount | Any repeated mount without cleanup |
| Polling Supabase instead of using Realtime | Battery/data drain in the dark venue | Use Realtime push, not a poll loop; keep the ≤1/60s discipline for kglw.net only | Immediately, on mobile |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Commit / inline `service_role` key | Full DB read/write/delete by anyone | Env-only in seed script; secret-scan CI; rotate if exposed |
| RLS off or missing `with check` on write-own | Any friend overwrites another's data | Blueprint RLS verbatim; two-user RLS test |
| Public sign-up left enabled | Stranger with anon key self-registers into the group | Disable sign-ups; accounts hand-created with `email_confirm:true` |
| Export JSON includes the auth session/refresh token | Token exfiltration via a shared dex file | Never put tokens in the export; export stays dex-only as today |
| Weak/shared passwords | Account takeover among the group | Distinct strong per-person passwords, env-injected at seed |
| Panic-hiding the anon key | Wasted effort, distracts from real gates | Accept anon key is public; invest in passwords + RLS + service_role hygiene |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Login wall blocks the app when offline | Can't predict/log at the venue | App usable logged-out/offline; auth gates only the *shared* features, not Show Mode |
| "Logged out" flicker on cold boot (expired-token refresh attempt) | Looks broken / lost data | Render from `getSession()`; don't surface transient refresh churn as logout |
| Hard error on offline write | Feels like data loss | Optimistic local write + "will sync" affordance; outbox flush on reconnect |
| Realtime silence read as "app frozen" | Confusion when offline / among quiet friends | Presence/reactions degrade quietly; never block logging on Realtime |
| Not warning about eviction/install | Silent logout on iOS Safari tab | Install-to-home-screen onboarding gate; "log in on wifi before the show" copy |

## "Looks Done But Isn't" Checklist

- [ ] **Offline boot:** Works in airplane mode from a cold start for an already-logged-in user (no spinner, no login wall) — verify with device airplane-mode reload, not just DevTools offline
- [ ] **Long-offline token:** Logged in on wifi, offline >1h, can still log a catch and it syncs on reconnect — verify JWT expiry raised + refresh-then-flush ordering
- [ ] **SW cache clean:** After an auth+sync session, Cache Storage contains **zero** `/auth/v1/` or `/rest/v1/` entries — verify in DevTools → Application
- [ ] **Realtime actually live:** Friends view updates without manual refresh — verify the table is in `supabase_realtime` AND a SELECT policy covers the subscriber (both, not either)
- [ ] **Write-own enforced:** User A cannot update user B's row — verify with a two-user RLS test, not just the happy path
- [ ] **service_role absent from bundle:** grep `dist/` for the key; confirm no `VITE_`-prefixed service key exists
- [ ] **iOS session durability:** Installed-PWA login survives 7+ days; `persist()` requested independent of login
- [ ] **Core purity intact:** `node` runs the backtest CLI; `@supabase/supabase-js` not in `packages/core`'s graph
- [ ] **Tunnel/prod origin:** Auth + Realtime tested over the cloudflared HTTPS tunnel on a real iPhone, not only localhost
- [ ] **No double-write:** One user action → one server upsert in the network tab (no echo loop)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `service_role` leaked/committed | HIGH | Rotate the key in Supabase immediately; purge from git history (filter-repo); audit DB for unexpected writes; add secret-scan CI |
| Realtime never fires (publication forgotten) | LOW | `alter publication supabase_realtime add table ...`; re-check SELECT policy; reconnect |
| Write-own RLS hole (data overwritten) | MEDIUM | Fix policy (`with check auth.uid()=user_id`); restore clobbered counts from a friend's local Dexie/JSON export (local is source of truth) |
| iOS session evicted (offline logout) | MEDIUM (no offline fix) | Log in again when online; mitigate future via install + `persist()` + raised JWT expiry; consider IndexedDB session mirror |
| SW cached auth/data | MEDIUM | Remove the offending runtime rule; bump SW/precache to evict poisoned cache; ship via the existing prompt-update flow |
| Supabase client leaked into core | MEDIUM | Move to app layer; define plain serializable core interface; restore `lib:["ES2023"]` build-green |
| Sync double-write/reset | MEDIUM | Switch to identity-only upsert + re-pull; add outbox idempotency key; add merge unit test |

## Pitfall-to-Phase Mapping

Phase names are indicative (the roadmap isn't built yet); the roadmapper should map these to the actual v2.0 phase structure. Suggested phase themes: **(A) Backend Foundation** (Supabase project, secrets, schema/RLS, seed) → **(B) Auth & Offline-Safe Session + rebrand/onboarding** → **(C) Shared Progress Sync** → **(D) Presence & Reactions** → cross-cutting **(P) PWA/SW/deploy hardening**.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Blocking startup on network 🔴 | B (Auth) | Airplane-mode cold-boot device test passes |
| 2. SW caching auth/data + WebSocket 🔴 | P (PWA/SW), B | Cache Storage has zero Supabase entries; Realtime degrades offline |
| 3. Offline token refresh 🔴 | B (refresh/expiry), C (flush order) | >1h-offline catch syncs on reconnect; no logout flicker |
| 4. iOS localStorage session eviction 🔴 | B (storage/persist), B/onboarding (install copy) | Installed-PWA login survives 7+ days |
| 5. RLS / publication misconfig | A (Backend Foundation) | Two-user RLS test; live update without refresh |
| 6. service_role leak / secrets in git | A (Backend Foundation) | Secret-scan CI green; no key in `dist/` |
| 7. Anon key / sign-up misunderstanding | A (Backend Foundation) | Public sign-up disabled; rationale documented |
| 8. Sync races / double-writes | C (Shared Progress) | Merge/flush unit test; one upsert per action |
| 9. CORS/origin/Realtime over tunnel | D (Presence), P (CSP) | Realtime works on-device over cloudflared tunnel |
| 10. Supabase client in core | A/B (boundary from first commit) | Core CLI runs under Node; SDK absent from core graph |

## Sources

- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — spike-validated blueprint (002–004), incl. the offline-boot + token-refresh open item — HIGH confidence
- `.planning/PROJECT.md` — offline-first core value, iOS eviction context, core-purity + Workbox `registerType:'prompt'` constraints — HIGH confidence
- [supabase/auth-js #677 — access token refreshes on expiry regardless of `autoRefreshToken` (needs network)](https://github.com/supabase/auth-js/issues/677) — verifies offline-stale-token failure (Pitfall 3) — HIGH confidence
- [supabase/auth-js #925 — don't refresh when `autoRefreshToken:false`](https://github.com/supabase/auth-js/pull/925) and [discussion #17788](https://github.com/orgs/supabase/discussions/17788) — refresh semantics — MEDIUM-HIGH
- [Supabase Docs — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) and [supabase/supabase #35195 — Realtime silent when publication/SELECT wrong](https://github.com/supabase/supabase/issues/35195) — verifies Pitfall 5 (publication + RLS-SELECT coupling) — HIGH confidence
- [supabase discussion #35147 — subscribe-before-replication-ready race](https://github.com/orgs/supabase/discussions/35147) — verifies Pitfall 8 subscribe race — MEDIUM-HIGH
- Supabase session-in-localStorage + iOS Safari 7-day script-storage eviction — training knowledge cross-checked against the app's existing IndexedDB-eviction mitigations — MEDIUM-HIGH (device-test to confirm)
- Service workers do not intercept `wss://` WebSocket frames; Vite inlines `VITE_`-prefixed env into the client bundle — established platform behavior — HIGH confidence

---
*Pitfalls research for: adding Supabase (auth + Postgres + Realtime) to an offline-first iOS PWA*
*Researched: 2026-07-22*
