---
phase: 19-shared-dex-progress
plan: 02
subsystem: app/sync
tags: [supabase, progress-sync, app-wide-mount, realtime, offline-cache, external-store]
requires:
  - deriveSharedProgress / parseSharedProgress / SharedProgress (@guezzer/core, 19-01)
  - supabase singleton (packages/app/src/db/supabase.ts, Phase 17)
  - useAuthIdentity (packages/app/src/auth/useAuthIdentity.ts, Phase 18)
  - useDexStats (packages/app/src/dex/useDexStats.ts, Phase 6)
  - useOnlineStatus / ReconnectContext (Phase 5 / Phase 18)
  - RLS read-all/write-own + supabase_realtime publication on public.progress (Phase 17)
provides:
  - upsertOwnProgress / upsertIdentity — identity-safe own-row writes (PROG-02, D-15)
  - refreshAllFriends — validated own-excluded re-pull (PROG-05, D-19)
  - subscribeProgress / removeChannel — app-wide postgres_changes channel (D-16)
  - shared sync store (subscribeSyncState / getSyncState / setSyncState) — engine↔read-hook seam
  - useProgressSync — the app-wide ENGINE hook, mounted once in App.tsx (D-16/D-17)
  - useFriendsProgress — PURE read hook over the shared store
  - buildFriendRows — pure friend-row sort/self-exclusion (PROG-03/04, D-03/D-05)
  - writeFriendCache / readFriendCache + FriendRowData — Dexie offline backstop (D-18)
affects:
  - Phase 19 Friends UI (19-03) consumes useFriendsProgress + buildFriendRows + config.copy.friends
  - Phase 20 presence fuses into the same app-wide-mount + shared-store pattern
tech-stack:
  added: []
  patterns:
    - "App-wide engine mounted once at the shell (useBingoCelebrations precedent) — subscription + debounce are singletons"
    - "External sync store (useOnlineStatus idiom) as the single engine→read-hook seam; read hooks own no channel/debounce"
    - "Validated read boundary: every synced row through core parseSharedProgress; malformed skipped, own-row excluded"
    - "Additive Dexie version(n) new-table-only bump (v4/v5/v6 precedent), excluded from export + userId-stamping like friendBeacons"
key-files:
  created:
    - packages/app/src/sync/friendCache.ts
    - packages/app/src/sync/progressSync.ts
    - packages/app/src/sync/useProgressSync.ts
    - packages/app/src/sync/useFriendsProgress.ts
    - packages/app/test/sync/progressSync.test.ts
    - packages/app/test/sync/useProgressSync.test.tsx
    - packages/app/test/sync/useFriendsProgress.test.ts
  modified:
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts
    - packages/app/src/App.tsx
    - packages/app/test/migrationV3.test.ts
    - packages/app/test/migrationV5.test.ts
    - packages/app/test/migrationV7.test.ts
    - packages/app/test/retroMark.test.ts
    - packages/app/test/map/dbV5.test.ts
decisions:
  - "Engine split from read hook: useProgressSync owns the subscription + debounce; useFriendsProgress is a pure useSyncExternalStore reader — makes both singletons (D-16 fix for the prior engine-inside-the-read-hook wiring)"
  - "Debounced own-row upsert is gated on online too (no futile offline write); reconnect flush is a separate immediate upsert on the offline→online edge (D-17)"
  - "asOf when online = Date.now() at pull; when offline = max fetchedAt from the Dexie cache — the honesty clock is always OUR local stamp, never the friend's updated_at"
  - "Tests live in packages/app/test/sync/ (not the plan's src/sync/) — the vitest app project only collects test/**; a src/sync test would never run"
metrics:
  duration: ~35min
  completed: 2026-07-23
  tasks: 3
  files: 16
---

# Phase 19 Plan 02: App-wide Shared-Progress Sync Module Summary

The Supabase sync fence under `packages/app/src/sync/` now upserts the signed-in user's dex summary (debounced, identity-safe) and drives a validated app-wide `postgres_changes` re-pull — owned by a single `useProgressSync()` engine mounted once in `App.tsx` (the `useBingoCelebrations()` precedent), so the residency payoff runs while the user is anywhere in the app, not only on the Friends tab (locked D-16).

## What Was Built

**Task 1 — Dexie `version(8)` + config + cache helpers (commit `abc0f90`):**
- `db.ts`: additive `version(8)` adding only `friendProgressCache: "&userId"` (new-table-only, no `.upgrade()`, per the v4/v5/v6 precedent). New `FriendProgressCacheRow` interface. Excluded from `DbSnapshot`/export and from the userId-stamping hook loop, mirroring the `friendBeacons`/`mapPins` "friend data, not namespaced" exclusion.
- `config.ts`: top-level `config.friends` (`DEBOUNCE_MS: 5000`, `showcaseCount: 5`) + a full `config.copy.friends` block with the 19-UI-SPEC strings (interpolation fns for `{pct}`/`{n}`/`{name}`/`{time}`). Deliberately does NOT redefine the compare column strings — the head-to-head reuses `config.copy.compare`.
- `friendCache.ts`: `writeFriendCache` (bulkPut, stamps `fetchedAt`, no-op on empty) / `readFriendCache` (returns rows + max `fetchedAt` as the `asOf` clock) + the `FriendRowData` type.

**Task 2 — primitives, shared store, engine, mount, read hook (commit `b4e278d`):**
- `progressSync.ts`: `upsertOwnProgress` (full-summary CONTENT write) vs `upsertIdentity` (`{user_id, display_name}` ONLY — never `summary`, Pitfall 4); `refreshAllFriends` (select → `parseSharedProgress` each row → skip malformed + own `user_id` → cache → return; `null` on whole-select error); `subscribeProgress`/`removeChannel`; and the module-level shared store (`SyncState`, `subscribeSyncState`/`getSyncState`/`setSyncState`, `resetSyncState`).
- `useProgressSync.ts`: the app-wide ENGINE — signed-in gated; a subscription+pull lifecycle effect (first-sync pull, reconnect re-pull, resubscribe, offline hydrate from cache); a debounced own-row upsert effect gated on `ready && dex != null && online` (Pitfall 5, coalesced); a reconnect-flush effect on the offline→online edge (D-17). Renders nothing.
- `App.tsx`: `useProgressSync()` mounted once next to `useBingoCelebrations()`, unconditional (signed-in gate is internal), NOT gated on `route === "dex"`.
- `useFriendsProgress.ts`: PURE `useSyncExternalStore` reader (no channel, no debounce, no upsert) + the pure exported `buildFriendRows` (own-excluded; 0-catch last, then completion% desc → caught desc → name asc).

**Task 3 — mocked-supabase tests (commit `064fdb9`):**
- `useProgressSync.test.tsx` (the app-wide-mount acceptance test): mounting a component whose ONLY sync surface is `useProgressSync()` — no Friends view — (a) establishes the subscription, (b) fires exactly ONE debounced content upsert on a coalesced dex change, (c) no-ops signed-out; plus a live-event re-pull and the offline cache-hydrate/no-writes path.
- `progressSync.test.ts`: content-vs-identity-only upsert (no-`summary` assertion), validated own-excluded re-pull + malformed skip + cache write + null-on-error, the subscription filter (`{event:"*",schema:"public",table:"progress"}`), and the shared-store seam.
- `useFriendsProgress.test.ts`: `buildFriendRows` sort/self-exclusion/0-catch-last + purity, and the pure store read (offline rows/asOf, degraded-read error keeps last friends).

## Verification

- `npx vitest run test/sync --project @guezzer/app` → 21/21 passed (3 files).
- `npx vitest run --project @guezzer/app` full app suite → 429/429 passed (70 files).
- `npx vitest run packages/core/test/purity.test.ts` → 2/2 passed (core still Supabase-free after the app fence populated).
- `npx tsc -p packages/app --noEmit` → clean.
- `grep -n "useProgressSync" packages/app/src/App.tsx` → import + call present (engine mounted at the shell, D-16).
- `grep -rE "@supabase|createClient" packages/core/src` → only doc-comment mentions; no imports/calls.
- `grep -nE "subscribeProgress|channel|setTimeout|DEBOUNCE" useFriendsProgress.ts` → only the doc comment; the read hook owns no subscription/debounce.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test files relocated to `packages/app/test/sync/`**
- **Found during:** Task 3
- **Issue:** The plan specifies test paths under `packages/app/src/sync/*.test.ts(x)` and a verify command `npx vitest run packages/app/src/sync`. The root `vitest.config.ts` app project sets `root: "packages/app"` with `include: ["test/**/*.test.{ts,tsx}"]` — a co-located `src/sync/*.test.ts` file is never collected, so the tests would silently never run.
- **Fix:** Created the three test files under `packages/app/test/sync/` (the established convention — all 67 existing app tests live under `test/`). Source files stay exactly where the plan specifies (`src/sync/`). Verified with `npx vitest run test/sync --project @guezzer/app`.
- **Files:** `packages/app/test/sync/{progressSync,useProgressSync,useFriendsProgress}.test.*`
- **Commit:** `064fdb9`

**2. [Rule 1 - Bug] Updated `db.verno` assertions in 5 existing schema tests (7 → 8)**
- **Found during:** Task 3 (full-suite run)
- **Issue:** Five existing tests (`migrationV3`, `migrationV5`, `migrationV7`, `retroMark`, `map/dbV5`) assert `expect(db.verno).toBe(7)` as a max-version sanity check. The additive `version(8)` bump raises the open version to 8, breaking these — exactly as each prior version bump updated them.
- **Fix:** Updated each assertion to `toBe(8)` and refreshed the adjacent comment to note the Phase-19 `friendProgressCache` table. No behavioral change to the tables under test.
- **Files:** the five test files above.
- **Commit:** `064fdb9`

**3. [Rule 3 - Blocking] Test `beforeEach` ordering (fake timers vs fake-indexeddb)**
- **Found during:** Task 3 (first engine-test run hung at 10s hook timeout)
- **Issue:** `vi.useFakeTimers()` freezes the timers/microtasks `fake-indexeddb`'s `db.clear()` schedules, so the `await db.friendProgressCache.clear()` reset never resolved.
- **Fix:** Do the async Dexie reset with REAL timers first, then enable fake timers.
- **Files:** `packages/app/test/sync/useProgressSync.test.tsx`
- **Commit:** `064fdb9`

## Authentication Gates

None — no auth interaction; the engine reads the already-signed-in `useAuthIdentity()` and relies on the Phase-17 RLS policies (not re-created this phase).

## Known Stubs

None. `refreshAllFriends` returning `null` on a select error and `writeFriendCache` no-op-on-empty are deliberate offline-safety contracts (keep last-known cache), not placeholders. The Friends UI that renders these rows is the next plan (19-03), as scoped.

## Threat Flags

None beyond the plan's `<threat_model>`, which is fully addressed:
- **T-19-identity** — `upsertIdentity` writes `{user_id, display_name}` only; content writes always include a full `summary` (pinned by the no-`summary` test).
- **T-19-tamper** — every synced row runs through core `parseSharedProgress`; malformed rows are skipped, never crash the pull (pinned by the skip-malformed test).
- **T-19-realtime** — single shell-mounted engine owns one channel; re-established on the reconnect edge; publication relied upon (Phase 17), not removed.
- **T-19-authz** — client keys the upsert by `useAuthIdentity().userId` only; RLS write-own is the structural control (Phase 17, verified in 19-04, not re-created here).
No new network endpoints, auth paths, or trust boundaries were introduced — the module is the first consumer of the existing Phase-17 client + table.

## Commits

- `abc0f90` feat(19-02): friendProgressCache table + config.friends + friendCache helpers
- `b4e278d` feat(19-02): app-wide progress sync engine + primitives + pure read hook
- `064fdb9` test(19-02): mocked-supabase sync tests (app-wide mount, debounce, re-pull, offline, sort)

## Self-Check: PASSED

- FOUND: packages/app/src/sync/friendCache.ts
- FOUND: packages/app/src/sync/progressSync.ts
- FOUND: packages/app/src/sync/useProgressSync.ts
- FOUND: packages/app/src/sync/useFriendsProgress.ts
- FOUND: packages/app/test/sync/progressSync.test.ts
- FOUND: packages/app/test/sync/useProgressSync.test.tsx
- FOUND: packages/app/test/sync/useFriendsProgress.test.ts
- FOUND (modified): packages/app/src/db/db.ts, packages/app/src/config.ts, packages/app/src/App.tsx
- FOUND: commit abc0f90
- FOUND: commit b4e278d
- FOUND: commit 064fdb9
