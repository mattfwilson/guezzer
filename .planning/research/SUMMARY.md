# Project Research Summary

**Project:** Guezzer — v2.0 "Multi-User Foundation" ("Gizz With Friends")
**Domain:** Multi-user layer (auth + shared progress + presence) bolted onto a shipped, offline-first, pure-core React/Vite PWA
**Researched:** 2026-07-22
**Confidence:** HIGH

## Executive Summary

v2.0 adds distinct identities, shared dex progress, and lightweight presence/reactions for a ~5-friend group, backed by a hosted Supabase (auth + Postgres + Realtime) — **the first backend this otherwise-static PWA has ever had.** This is not a greenfield build: the approach is already spike-validated live across two remote devices (spikes 002–004), and the async friend-comparison machinery (`deriveDex`, `compareDexes`, `buildShareStats`) already ships in pure `core`. The job of v2.0 is to remove the manual JSON-file handoff by syncing a *derived summary* of each user's dex so the same shipped compare code renders live, plus add ephemeral online-presence and waves. All four researchers converged hard on the same shape, so confidence is HIGH across the board.

The recommended approach is deliberately minimal: **exactly one new runtime dependency** (`@supabase/supabase-js` v2, latest 2.110.8) added to `packages/app` only; **exactly one new pure `core` function** (`deriveDexSummary(DexStats) -> DexSummary`); and **zero new supporting libraries** — the offline write-queue is a hand-rolled Dexie `outbox` (~40 lines), payload validation reuses the existing zod, and reactive UI reuses `useLiveQuery`. Every Supabase import is fenced into a single app-layer folder (`packages/app/src/sync/`) so core purity is preserved *by construction* and lint-auditable in one place. The sync model is the load-bearing simplification: because each user writes only their own row under read-all/write-own RLS, it is a **low-conflict one-way projection, not bidirectional sync** — last-write-wins is correct by construction, there is no server merge, and Dexie stays the single local source of truth.

The risk profile is dominated by the collision between offline-first and a network backend. Four "collision zones" (flagged 🔴) recur across the pitfalls research: (1) never block boot on a network auth check — restore synchronously from `getSession()`; (2) never Workbox-cache the Supabase origin — auth/REST must be network-only and Realtime `wss://` is un-cacheable by construction; (3) offline JWT refresh — raise the JWT expiry toward ~1 week and refresh-then-flush the outbox on reconnect; (4) iOS Safari localStorage session eviction — reuse the app's existing `persist()` + install-prompt defenses (strictly worse than dex eviction because there is no offline recovery). The single highest-severity individual mistake is leaking the `service_role` key: Vite inlines any `VITE_`-prefixed env into the public bundle, so the admin key must stay env-only in the seed script and **never** carry a `VITE_` prefix. Mitigation for every one of these is known and documented; the phase order below front-loads the riskiest seam (offline-safe identity) so nothing depends on it before it is device-verified.

## Key Findings

### Recommended Stack

The v1 stack (Vite 8 + React 19 + TS 6 + npm workspaces, Dexie 4, vite-plugin-pwa/Workbox `registerType:'prompt'`, zod, Tailwind) is already shipped and validated — **not re-researched.** v2.0 changes the dependency tree by exactly one package. See `STACK.md`.

**Core technologies:**
- **`@supabase/supabase-js` 2.110.8 (v2)** — the *only* new runtime dependency; one meta-package pulls auth + Postgres/PostgREST + Realtime, framework-agnostic ESM, no React peer dep. Added to `packages/app` only, never `core`. Stay on the v2 line (v3 is pre-release on the `next` tag only).
- **Dexie 4.4.4 (already present)** — reused for the hand-rolled `outbox`/`syncQueue` offline write-queue via an additive `version(6)` migration. No new offline-sync library (RxDB/PowerSync/Replicache are heavyweight overkill for one counters row + ~5 users).
- **zod 4.4.3 (already present)** — reused at the app-layer boundary to validate untrusted Realtime/`postgres_changes` payloads, same discipline as the existing kglw.net ingestion schemas. Network-payload schemas are app concerns, not core.
- **Zero-dep repo scripts** — `seed-users.mjs` (GoTrue admin API via native Node `fetch`) and `schema.sql` (pasted into the Supabase SQL editor). Not package dependencies; live in a root `supabase/` folder outside the bundle.

### Expected Features

Three feature areas, all spike-chosen. The single most consequential design decision is the **sync payload projection** (see `FEATURES.md`): recommend **Option B — counters + caught `songId` int[]** (<=264 small ints, ~1–3 KB/user). Option B is what lets the *already-shipped* `compareDexes` run live for free; Option A (counters only) would mean throwing away working diff code; Option C (raw attendance rows) is an anti-feature that reopens SOCL-V2-01 reconciliation.

**Must have (table stakes):**
- Pre-made email/password sign-in + **offline-safe session restore** — the gate for everything; make-or-break offline boot.
- First-login data namespacing — the existing single-user dex cleanly becomes the logged-in user's (a `meta.userId` claim, not data movement).
- `deriveSharedProgress`/`deriveDexSummary` (pure core) + debounced progress upsert (Option-B payload).
- Friends screen with live headline progress via `postgres_changes` (requires `alter publication supabase_realtime add table progress`).
- Read-all / write-own RLS enforcement.
- "Gizz With Friends" rebrand (chrome only; labels, no route/storage-key changes).

**Should have (competitive):**
- **Live head-to-head compare reusing `compareDexes`** — the highest-leverage reuse in the milestone; the async file-compare view becomes a live tap-a-friend view with zero new diff logic (requires Option B).
- Online presence dots + broadcast/targeted waves (ephemeral, never persisted).
- "What they're doing" coarse status (which tab) — same channel, no new infra.
- Mini-leaderboard sorts, per-album/per-tier friend breakdown, emoji reaction palette, auto identity color, polished stale-token reconnect UX.

**Defer (v2.x / out):**
- **Shared live setlist co-tracking (SOCL-V2-01)** — the hard scope line; reopens offline reconciliation. Explicitly out.
- Historical progress timelines / night-by-night graphs (needs time-series storage).
- Push notifications (out of scope per PROJECT.md).
- Self-service sign-up, magic-link/OTP, password-reset UI, profile editing, multi-account-on-one-device switching.

### Architecture Approach

One load-bearing constraint governs everything: **`packages/core` stays pure; all Supabase lives in `packages/app/src/sync/`, the only folder that imports `@supabase/supabase-js`.** Core gains exactly one *pure* addition — `deriveDexSummary(DexStats) -> DexSummary` — mirroring the existing `deriveDex`/`compareDexes` pure-derivation, app-layer-transport split. The `progress` row is a **regenerable projection** of Dexie-derived `DexStats`, never a source of truth (extends the "Pokédex counts derived, never stored" rule one hop to the server). See `ARCHITECTURE.md`.

**Major components:**
1. **`packages/app/src/sync/` (NEW)** — `supabase.ts` (client singleton), `useSession.ts` (offline-safe boot), `useProgressSync.ts` (push my summary, debounced + outbox), `useFriends.ts` (read-all + `postgres_changes` re-pull), `usePresence.ts` (presence + waves, no DB), `syncQueue.ts` (single-slot offline write-queue), `namespaceLocalData.ts` (first-login userId claim). The hard Supabase boundary.
2. **`packages/core/src/dex/dex-summary.ts` (NEW, pure)** — `deriveDexSummary`; unit-testable from Node with fixtures; zero I/O.
3. **Supabase (hosted)** — one durable `progress` table (one row/user, RLS read-all/write-own, in the realtime publication) + one ephemeral Realtime channel (`gizz-room`) for presence + broadcast waves. Never persist presence/waves.
4. **Modified existing seams** — `db.ts` additive `version(6)` (`syncQueue` + `meta.userId`), `App.tsx` (session gate + presence mounts + wave-toast emitter), `AppShell.tsx` (header identity affordance), `config.ts` (a `sync` block — no scattered magic strings), root `supabase/` (schema.sql + seed-users.mjs, outside the bundle).

### Critical Pitfalls

Full detail and the "looks done but isn't" checklist in `PITFALLS.md`. The four 🔴 zones are where offline-first and Supabase actively fight:

1. **🔴 Blocking startup on a network auth check** — boot from synchronous `getSession()` (reads localStorage, no network); reconcile via `onAuthStateChange` after paint. Never `await getUser()`/`refreshSession()` on the boot path. Verify with a device airplane-mode cold-boot test.
2. **🔴 Workbox caching the Supabase origin** — exclude `*.supabase.co` from all runtime caching (network-only); the bundled SDK is precached (correct), but auth/REST responses must never be. Realtime `wss://` is un-interceptable by SWs by construction. Keep `registerType:'prompt'`. Verify: zero Supabase entries in Cache Storage.
3. **🔴 Offline JWT refresh (blueprint's known open item)** — don't treat expired-token-offline as logout; raise JWT expiry toward ~1 week so a pre-show wifi login survives the show; refresh-then-flush the outbox on reconnect (gate writes on "session valid," not "user exists").
4. **🔴 iOS localStorage session eviction** — reuse existing `persist()` + install-prompt defenses; make install-to-home-screen and "log in on wifi before the show" onboarding gates. Strictly worse than dex eviction (no offline recovery), so mitigation-not-cure.
5. **Highest single-severity: leaking `service_role`** — it bypasses RLS entirely. Env-only in the seed script, never `VITE_`-prefixed, never committed, secret-scan CI. (Corollary: don't waste effort hiding the *anon* key — it's public by design; disable public sign-ups instead.)

Also load-bearing but lower-risk: RLS/publication misconfig (silent — needs a two-user RLS test and the `alter publication` line), sync races/double-writes (single-slot outbox, idempotent upsert keyed `user_id`, pull->subscribe->re-pull, ignore own echo), CSP/`connect-src` must list `https://*.supabase.co` **and** `wss://*.supabase.co` and be tested over the cloudflared tunnel, and never coupling the client into `core`.

## Implications for Roadmap

Research converged unanimously on a three-phase structure that **de-risks identity first**. Phase A is the load-bearing, highest-risk work (it owns 3 of the 4 🔴 offline collisions); B and C both sit on A's `session`/`userId` and are mutually independent (C can parallelize with B once A lands and is device-verified). A backend-foundation setup task precedes A.

### Phase 0 (setup task inside Phase A): Backend Foundation
**Rationale:** Schema, RLS, secrets, and seeding must exist before any client code, and the secret-hygiene gate must be established from the first commit.
**Delivers:** `supabase/schema.sql` (progress table + read-all/write-own RLS + `alter publication supabase_realtime add table progress`), `supabase/seed-users.mjs` (service_role env-only), disabled public sign-ups, raised JWT expiry, `.env*.local` gitignored, secret-scan CI.
**Avoids:** service_role leak (P6), RLS/publication misconfig (P5), anon-key-panic (P7).

### Phase A: Auth & Offline-Safe Session (+ rebrand/onboarding)
**Rationale:** The single riskiest seam (offline-safe identity at a dead-signal venue) and the gate for everything downstream — no identity means no per-user rows and no presence key. Prove offline boot on-device *before* anything depends on it.
**Delivers:** `sync/supabase.ts` (env-driven singleton + lint boundary rule), `sync/useSession.ts` (`getSession()` restore + `onAuthStateChange`), `LoginGate`/`AccountSheet`, `AppShell` identity affordance, `db.ts` `version(6)` (`meta.userId` claim + `namespaceLocalData.ts`), "Gizz With Friends" rebrand, install-first + "log in on wifi" onboarding copy.
**Addresses:** pre-made email/password sign-in, offline-safe session restore, first-login namespacing, rebrand (FEATURES table stakes).
**Avoids:** 🔴 blocking startup (P1), 🔴 offline token refresh config (P3), 🔴 iOS session eviction (P4), client-in-core (P10).
**Exit gate:** sign in on two devices with distinct accounts; kill signal; app still boots to the full dex offline; distinct identities confirmed.

### Phase B: Shared Progress
**Rationale:** Depends on A's identity. Delivers the visible payoff — friends' real dex progress synced live — and the highest-leverage reuse (live `compareDexes`).
**Delivers:** `core/dex/dex-summary.ts` (`deriveDexSummary`, pure + fixture unit tests), `sync/useProgressSync.ts` (debounced diff push + single-slot outbox), `sync/syncQueue.ts` (flush-on-reconnect via existing `useOnlineStatus`), `sync/useFriends.ts` (read-all + `postgres_changes` re-pull), `friends/FriendsView.tsx`, live head-to-head compare reusing shipped `compareDexes`.
**Uses:** Supabase Postgres upsert/select under RLS; Option-B payload (caught songIds).
**Implements:** the projection/one-way-sync architecture; Dexie-as-local-truth.
**Avoids:** sync races/double-writes (P8), refresh-then-flush ordering (P3), Realtime-SELECT coupling (P5).
**Exit gate:** mark a show offline on device 1 -> reconnect -> device 2's FriendsView reflects the new completion %.

### Phase C: Presence & Reactions
**Rationale:** Depends on A's identity but is Postgres-independent — the most self-contained area; can parallelize with B.
**Delivers:** `sync/usePresence.ts` (presence + wave broadcast, no DB), `friends/PresenceRow.tsx`, wave-toast emitter in `App.tsx` (reuse the `BackupToast`/`useBingoCelebrations` module-emitter pattern), coarse "what they're doing" status payload (stubbed forward-compatible), emoji reaction palette.
**Implements:** ephemeral Realtime presence/broadcast; reduced-motion-aware celebration discipline.
**Avoids:** persisting presence to Postgres (anti-pattern), CSP/tunnel Realtime failures (P9), the SOCL-V2-01 scope creep tripwire.
**Exit gate:** device 1 sees device 2 come online; a wave from 1 toasts on 2, verified on-device over the cloudflared tunnel.

Cross-cutting **(P) PWA/SW/deploy hardening** threads through all phases: verify no `runtimeCaching` rule matches `*.supabase.co`, CSP `connect-src` includes both `https:` and `wss:` Supabase, deploy env vars set in the static host.

### Phase Ordering Rationale

- **A before B/C by dependency:** identity keys every progress row and every presence entry; nothing works without it.
- **A first by risk:** it owns 3 of 4 🔴 offline collisions (startup blocking, token refresh, iOS eviction) — the seams that regress the app's core offline-first value. Prove them on-device before building on them.
- **B and C parallelizable:** C rides Realtime only (no Postgres dependency on B), so once A is device-verified the two can proceed independently.
- **Scope tripwire baked into C:** presence *status strings* ("in LiveGizz") are in scope; any *shared mutable setlist* is the deferred SOCL-V2-01 line and must be cut on sight during requirements review.

### Research Flags

**Standard patterns — skip `--research-phase` (spike-validated, blueprint-proven):**
- **Phase A:** the offline-boot/`getSession()` flow, RLS shape, and seed script are all validated live in spikes 002–004; the work is careful integration, not investigation.
- **Phase B:** projection sync + `postgres_changes` re-pull are blueprint-proven; the reuse surface (`deriveDex`/`compareDexes`) is shipped and inspected.
- **Phase C:** presence + broadcast on one channel is the validated `gizz-room` design from spike 004.

**Watch items during planning (not full research, but requirements-time decisions):**
- Phase A: exact JWT expiry value; shared-device second-login policy (refuse-and-export recommended); friends-surface placement (new tab vs folded into GizzDex/Settings).
- Phase B: progress column set — `per_album` jsonb in v2.0 or defer (keep full `perSong` OFF the live row); progress-write debounce cadence during a show.

These are design choices with recommended defaults, not feasibility unknowns — resolve at requirements time, don't spawn research phases.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One dependency, verified registry-authoritative (`npm view`, 2026-07-22); everything else already in the shipped tree. |
| Features | HIGH | Grounded in the spike-validated blueprint + direct inspection of the shipped `deriveDex`/`compareDexes`/share-card code; ecosystem norms (ephemeral presence) MEDIUM. |
| Architecture | HIGH | Integration seams read directly from real shipped files; the approach is validated live across two devices. Column-set choices flagged MEDIUM (confirm with owner). |
| Pitfalls | HIGH | Spike-validated + Supabase docs/issue-verified; the offline-refresh and iOS-eviction mitigations are MEDIUM-HIGH (device-test to confirm the exact behavior). |

**Overall confidence:** HIGH

### Gaps to Address

- **Sync payload = Option B (recommended):** if requirements instead pick counters-only (Option A), live `compareDexes` can't render and shipped diff code is discarded. Flag this decision explicitly at requirements time. *(Recommend B.)*
- **`per_album` column:** ship flat scalar columns first; add `per_album` jsonb only if a per-album friend diff lands. Keep the full `perSong` map (~264 entries) OFF the live row — that stays on the file-export/`compareDexes` path. *(Owner decision at requirements.)*
- **Shared-device second-login:** recommend refuse-and-export over silent merge; per-user Dexie namespacing only if shared-device use actually emerges. *(Owner decision.)*
- **Exact JWT expiry + progress-write debounce cadence:** propose values at requirements time (JWT toward ~1 week; debounce to coalesce a burst of live logs into one write).
- **iOS session-eviction real-world behavior + Realtime-over-tunnel:** both need a device test (7+ day installed-vs-tab PWA; Realtime `CHANNEL_ERROR` over cloudflared) — bake into Phase A and Phase C UAT respectively.

## Sources

### Primary (HIGH confidence)
- `.claude/skills/spike-findings-guezzer/references/multi-user-supabase.md` — spike-validated blueprint (002 auth/identity, 003 synced-progress, 004 presence/ping), live across two remote devices incl. offline boot — auth/RLS/presence design and the token-refresh open item.
- `npm view @supabase/supabase-js` (2026-07-22) — `latest` = 2.110.8; sub-packages pinned; v3 pre-release only on `next`.
- Shipped codebase (read directly): `packages/core/src/dex/derive-dex.ts`, `compare.ts`, `share-stats.ts`; `packages/app/src/dex/useDexStats.ts`, `db/db.ts`, `App.tsx`, `components/AppShell.tsx`, `config.ts`, `vite.config.ts`, `settings/ownerMatch.ts` — integration seams and reuse surface.
- `.planning/PROJECT.md` — v2.0 milestone scope, revised constraints, SOCL-V2-01 deferral, core-purity + offline-first requirements.
- supabase/auth-js #677 — token refreshes on expiry, needs network (verifies offline-stale-token pitfall).
- Supabase Postgres Changes docs + supabase #35195 — publication + RLS-SELECT coupling (verifies Realtime-silent pitfall).

### Secondary (MEDIUM-HIGH confidence)
- supabase discussion #35147 — subscribe-before-replication-ready race.
- Supabase session-in-localStorage + iOS Safari 7-day script-storage eviction — cross-checked against the app's existing IndexedDB-eviction mitigations (device-test to confirm).
- Vite `VITE_`-env inlining + Workbox navigation/precache/runtime-caching model + SWs not intercepting `wss://` — established platform behavior, cross-checked against the repo's existing PWA config.

### Tertiary (LOW confidence)
- Exact `@supabase/supabase-js` patch beyond "v2 latest" — pin re-verified at install time via `npm view` (HIGH on "v2 line," LOW on the specific patch surviving to implementation).

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
