---
phase: 19-shared-dex-progress
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - packages/app/src/App.tsx
  - packages/app/src/config.ts
  - packages/app/src/db/db.ts
  - packages/app/src/dex/DexView.tsx
  - packages/app/src/dex/FriendDetail.tsx
  - packages/app/src/dex/FriendRow.tsx
  - packages/app/src/dex/FriendsList.tsx
  - packages/app/src/dex/RarestShowcase.tsx
  - packages/app/src/dex/SelfRow.tsx
  - packages/app/src/sync/friendCache.ts
  - packages/app/src/sync/progressSync.ts
  - packages/app/src/sync/useFriendsProgress.ts
  - packages/app/src/sync/useProgressSync.ts
  - packages/core/src/dex/shared-progress.ts
  - packages/core/src/index.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
resolved:
  critical: 1
  warning: 3
  info: 0
status: resolved
resolution_note: >
  CR-01 (downgraded to defense-in-depth: display_name is `text not null` in the
  progress_foundation migration) plus WR-01/WR-02/WR-03 fixed in commits
  888a4e0, 590929f, a8ba000, 45398d9. +4 tests; suite 875 passing. The 3 INFO
  findings are accepted as tracked debt (resetSyncState-on-signout wiring,
  dup-key guard, self-echo re-pull perf — out of v1 scope).
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The phase is well-structured: core purity is preserved (`shared-progress.ts` imports only `zod` + core-internal types), the engine/reader split (`useProgressSync` writer, `useFriendsProgress` reader over an external store) correctly makes the subscription + debounce singletons, and the strict-schema round-trip for `summary` is safe (I verified `DexStats.rarestCatch` is constructed as exactly `{ songId, tier }`, so the pass-through in `deriveSharedProgress` cannot leak extra keys that would fail the reader's `strictObject`). Debounce reschedule-on-dex-change is intentional and `useDexStats` returns stable references between data changes, so the timer is not perpetually reset.

However, the review found one real availability defect and several robustness gaps concentrated exactly where the phase makes its safety claims: the untrusted-read boundary and the offline/online lifecycle.

- **The read-boundary validation is incomplete.** Only `summary` is zod-validated. The first-class row columns `display_name` and `user_id` are cast (`as`), not validated, and `display_name` flows unguarded into `.trim()` / `initialsOf(...)`. A null/non-string `display_name` crashes the entire Friends surface — which has no error boundary — directly contradicting the D-19 "malformed row is silently skipped" contract.
- **The lifecycle effect has async stale-write races.** `readFriendCache().then(...)` and `refreshAllFriends().then(...)` fire `setSyncState` with no cancellation guard, so a fast online↔offline flip can let an in-flight resolution clobber the current connectivity state.
- **Write failures are fully silent.** `upsertOwnProgress` ignores the `{ error }` supabase-js returns, and the caller's `.catch()` cannot catch it (supabase-js resolves, not rejects, on RLS/DB errors).

## Critical Issues

### CR-01: Untrusted `display_name`/`user_id` bypass the read-boundary validation and crash the Friends tab

**File:** `packages/app/src/sync/progressSync.ts:95-112` (also `packages/app/src/dex/FriendRow.tsx:28-32`, `packages/app/src/dex/FriendDetail.tsx:58`)
**Issue:** `refreshAllFriends` validates only `summary` via `parseSharedProgress`. The row columns are cast, not validated:

```ts
const row = r as { user_id: string; display_name: string; summary: unknown; updated_at: string | null };
const summary = parseSharedProgress(row.summary); // only this is validated
if (summary == null || row.user_id === myUserId) return null;
return { userId: row.user_id, displayName: row.display_name, summary, updatedAt: row.updated_at };
```

`row.display_name` then flows unguarded into rendering. `FriendRow` → `initialsOf(displayName)` calls `displayName.trim()`, and `FriendDetail` (line 58) calls `friend.displayName.trim()`. If `display_name` is `null` (or any non-string), both throw `TypeError: displayName.trim is not a function`. Because `App.tsx` renders `DexView` with no error boundary, that throw unmounts the tree — a whole-surface crash. RLS is write-own, so **a friend fully controls their own row's `display_name`** and could set it to null via a direct REST/JS write, denying every other friend the Friends tab. This is precisely the "hostile row silently skipped" behavior the D-19 header claims but does not implement for the row columns. An empty string is safe (`initialsOf` returns `"?"`, `FriendDetail` falls back to `namePrompt`) — only null/non-string crashes.

**Fix:** Validate/coerce the row columns at the same boundary as `summary`. Either extend the schema to the whole row, or defensively coerce and skip:
```ts
const userId = typeof row.user_id === "string" ? row.user_id : null;
const displayName = typeof row.display_name === "string" ? row.display_name : "";
if (summary == null || userId == null || userId === myUserId) return null;
return { userId, displayName, summary, updatedAt: typeof row.updated_at === "string" ? row.updated_at : null };
```
(If the `progress.display_name` column carries a server-side `NOT NULL` + text constraint, real-world exploitability is reduced to a defense-in-depth gap — but the client must not assume a constraint it does not enforce, and the D-19 contract explicitly promises this validation.)

## Warnings

### WR-01: Stale-write race in the subscription/pull lifecycle effect

**File:** `packages/app/src/sync/useProgressSync.ts:53-84`
**Issue:** Both async branches call `setSyncState` inside a `.then()` with no cancellation guard tied to the effect cleanup:

- Offline branch: `void readFriendCache().then(({rows, fetchedAt}) => setSyncState({friends: rows, offline: true, asOf: fetchedAt}))`
- Online `pull`: `void refreshAllFriends(userId).then((rows) => setSyncState({friends: rows, ..., offline: false}))`

On a fast connectivity flip the effect re-runs before the prior promise resolves. Concretely, going **online→offline**: a network pull started while online can resolve *after* the offline hydrate and call `setSyncState({offline: false, ...})`, flipping `offline` back to false — the friend rows render un-dimmed with no `Offline · as of {time}` marker despite being offline, showing stale online data as if live. The mirror race exists online→offline→online. This is the exact offline-cache-correctness failure mode the phase design guards against elsewhere.
**Fix:** Add a per-run cancellation flag:
```ts
useEffect(() => {
  if (!userId) return;
  let cancelled = false;
  if (!online) {
    void readFriendCache().then(({ rows, fetchedAt }) => {
      if (!cancelled) setSyncState({ friends: rows, offline: true, asOf: fetchedAt });
    });
    return () => { cancelled = true; };
  }
  setSyncState({ offline: false });
  const pull = () => { void refreshAllFriends(userId).then((rows) => {
    if (cancelled) return;
    /* ...existing... */
  }); };
  const channel = subscribeProgress(pull);
  pull();
  return () => { cancelled = true; void removeChannel(channel); };
}, [userId, online]);
```

### WR-02: Supabase write errors are swallowed silently (unreachable `.catch`)

**File:** `packages/app/src/sync/progressSync.ts:47-61` (and `69-76`); caller `packages/app/src/sync/useProgressSync.ts:96,114`
**Issue:** `upsertOwnProgress` awaits `supabase.from(...).upsert(...)` but never reads the returned `{ error }`. supabase-js **resolves** (does not reject) on RLS violations, constraint failures, and 4xx responses, so the caller's `void upsertOwnProgress(...).catch(() => {})` catches nothing for those cases. A persistent write failure (RLS misconfig, a summary that violates a server check, an identity mismatch) is therefore completely silent — no log, no user signal, and indistinguishable from success. The comment ("the next dex change or the reconnect flush re-attempts") only holds for transient failures; a structural failure never surfaces during show-night debugging.
**Fix:** Destructure and at least log the error so a persistent failure is diagnosable:
```ts
const { error } = await supabase.from(PROGRESS_TABLE).upsert(/* ... */);
if (error) {
  console.warn("[progress] own-row upsert failed:", error.message);
  throw error; // let the caller's .catch() see it, or handle explicitly
}
```

### WR-03: Offline friend cache is never pruned — removed/reset friends persist as ghosts

**File:** `packages/app/src/sync/friendCache.ts:43-51`
**Issue:** `writeFriendCache` does a `bulkPut` of the current pull's rows only; it never deletes rows for friends absent from the latest pull. `friendProgressCache` is keyed by `&userId`, so a friend who deletes/resets their `progress` row (or is otherwise removed) is never evicted — `readFriendCache` (offline path) returns them forever as a dimmed "last-known" ghost with stale numbers. The online path reconciles correctly (the store is fully replaced), so this only manifests at a dead-signal venue, but that is exactly when the offline backstop is load-bearing. The "when `rows` is empty, leave as-is" guard is correct for an empty pull, but a *non-empty* pull that omits a since-removed friend still leaves that friend cached.
**Fix:** Reconcile the cache to the pull result inside a transaction — delete cache rows whose `userId` is not in the incoming set before `bulkPut` — while preserving the empty-pull no-op:
```ts
await db.transaction("rw", db.friendProgressCache, async () => {
  const keep = new Set(rows.map((r) => r.userId));
  const stale = (await db.friendProgressCache.toArray()).filter((r) => !keep.has(r.userId));
  if (stale.length) await db.friendProgressCache.bulkDelete(stale.map((r) => r.userId));
  await db.friendProgressCache.bulkPut(rows.map((row) => ({ ...row, fetchedAt })));
});
```

## Info

### IN-01: `upsertIdentity` and `resetSyncState` are exported but never called

**File:** `packages/app/src/sync/progressSync.ts:69-76` and `207-215`
**Issue:** Confirmed via repo-wide grep: neither is invoked anywhere in `packages/app/src`. `upsertIdentity` (the "identity-only, never clobber summary" write, D-15/Pitfall 4) is documented as a core safety primitive but is not wired into the engine this phase — dead code, or a missing call site. More notably, `resetSyncState` is **not** wired to sign-out: when `userId` becomes null the lifecycle effect early-returns (`if (!userId) return;`) and the shared store retains the prior session's `friends`. On a borrowed-phone identity switch (a scenario the DB layer explicitly designs for), the previous user's friend list lingers in the store until the new identity's first online pull overwrites it.
**Fix:** Either call `resetSyncState()` in the lifecycle effect when `userId` is falsy, or delete the two unused exports if genuinely out of scope for Phase 19. Add the `upsertIdentity` call site (e.g., a display-name change flush) or remove it.

### IN-02: `sharedProgressSchema` validates fields independently — the `deriveSharedProgress` invariants are not enforced

**File:** `packages/core/src/dex/shared-progress.ts:216-245`
**Issue:** The schema bounds each field in isolation but does not enforce the two invariants the header claims "hold by construction": `caughtSongIds.length === completion.caught`, and that `caughtSongIds` is deduped/sorted with non-negative ids. Those hold for a self-derived payload but not for an untrusted remote row (a friend controls their own `summary`). A hostile row can present `completion.caught: 9999` with `caughtSongIds: []` (inconsistent columns in `FriendRow`/`StatColumn`), and duplicate `caughtSongIds` propagate to `RarestShowcase`, which uses `key={songId}` — duplicates produce duplicate React keys and a doubled trophy row. Blast radius is limited (RLS write-own → self-inflicted display oddities only), so this is low severity, but the invariant gap undercuts the "validated at the read boundary" guarantee.
**Fix:** Add a `.refine` cross-check and dedupe on parse:
```ts
}).refine((s) => s.caughtSongIds.length === s.completion.caught, "caught count mismatch");
// and dedupe in reconstructDexStats / selectRarestCaught, or z.array(...).transform(a => [...new Set(a)])
```

### IN-03: `subscribeProgress` uses `event: "*"` on a full-table re-pull — every friend event triggers a full re-select

**File:** `packages/app/src/sync/progressSync.ts:128-139`, callback `packages/app/src/sync/useProgressSync.ts:68-79`
**Issue:** Each `postgres_changes` event (any INSERT/UPDATE/DELETE on `progress`, including the caller's own upsert echo) invokes `pull()`, a full `select` of every row. Documented as "correct at ~5 rows (D-16)", and out of the v1 performance scope — flagged only as a note: your own `upsertOwnProgress` will echo back a change event and trigger a self-induced full re-pull ~5s after every logged song during a live set. Harmless at this scale; revisit if the group ever grows.

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
