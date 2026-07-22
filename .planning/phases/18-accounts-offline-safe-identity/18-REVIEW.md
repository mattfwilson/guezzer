---
phase: 18-accounts-offline-safe-identity
reviewed: 2026-07-22T22:17:11Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/core/src/identity/color.ts
  - packages/core/src/index.ts
  - packages/app/src/config.ts
  - packages/app/src/auth/AuthGate.tsx
  - packages/app/src/auth/IdentityAvatar.tsx
  - packages/app/src/auth/SignInScreen.tsx
  - packages/app/src/auth/claimDex.ts
  - packages/app/src/auth/identityRecord.ts
  - packages/app/src/auth/reconnectContext.ts
  - packages/app/src/auth/roster.ts
  - packages/app/src/auth/useAuthIdentity.ts
  - packages/app/src/components/AppShell.tsx
  - packages/app/src/db/db.ts
  - packages/app/src/dex/ArchiveBrowser.tsx
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/dex/ShowsList.tsx
  - packages/app/src/dex/shareCard.ts
  - packages/app/src/dex/useDexStats.ts
  - packages/app/src/games/GamesView.tsx
  - packages/app/src/live/SyncDot.tsx
  - packages/app/src/main.tsx
  - packages/app/src/settings/exportDownload.ts
  - packages/app/src/settings/importPicker.ts
  - packages/app/src/show/ShowView.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
resolved:
  fixed_at: 2026-07-22T23:05:00Z
  warnings_resolved: 4
  commits:
    WR-01: 801ae2a
    WR-02: 2645dca
    WR-03: 92a1ea8
    WR-04: 73b7f4a
  note: >-
    All 4 Warnings resolved (see per-finding RESOLVED notes below). The 3 Info
    findings remain as documented informational/accepted-limitation items
    requiring no change for v2.0; status is clean because no critical/warning
    findings remain. Full suite green (847 passed) + app/core typechecks clean.
---

# Phase 18: Code Review Report

**Reviewed:** 2026-07-22T22:17:11Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** clean (all 4 Warnings resolved 2026-07-22; 3 Info items remain as accepted/informational)

## Summary

Phase 18 layers a Supabase-auth identity over a previously single-user offline PWA.
The three highest-weighted concerns were verified against the actual code and are
**correctly implemented**:

- **Offline-safe boot (THE CRUX):** `main.tsx` renders `<AuthGate/>`; `AuthGate` gates
  purely on the synchronous `useAuthIdentity()` snapshot of the `gwf-identity`
  localStorage record. `getSession()`/`onAuthStateChange` run only inside a post-paint
  `useEffect`; their result never gates boot. No `await` sits on the boot path. An
  expired-but-present record opens the full dex. This part is solid.
- **Local read isolation:** `ShowsList`, `ArchiveBrowser`, `RecapView`, `GamesView`,
  and `useDexStats` all scope every namespaced-table `useLiveQuery` to
  `where("userId").equals(currentUserId)` (status reads add `.and(r => r.userId === …)`).
  Export (`snapshot(userId)`) scopes + strips `userId`; import re-stamps it. Write-side
  `creating`/`updating` Dexie hooks stamp the signed-in `userId`, including the
  `.put`-replace self-erasure guard. The isolation substrate is coherent.
- **No PII / no enumeration:** `ROSTER` is synthetic `@fov.gizz` handles; the wrong-password
  path surfaces GoTrue's generic message verbatim; no credential material is stored in
  Dexie (the Supabase token lives in the separate library key), so exports never carry it.

The defects below are concentrated in two areas the happy-path tests don't exercise:
(1) the background auth reconciler's `SIGNED_OUT` handling assumes user intent that
supabase-js does not guarantee, and (2) several **shared/borrowed-device** write and read
paths remain global or unscoped, which are documented as accepted limitations but are real
cross-identity data-loss / exposure edges that contradict the phase's own D-09 goal
("a borrowed phone must never see identity A's data"). None rises to a boot-breaking or
credential-leaking Critical, so no BLOCKER is filed — but the four Warnings should be
closed or explicitly re-accepted with the risk stated.

## Warnings

### WR-01: AuthGate treats every `SIGNED_OUT` as an explicit sign-out — supabase-js also emits it on a definitive token-refresh failure

**RESOLVED** (commit `801ae2a`): Added a user-initiated sign-out intent flag
(`markUserSignOut`/`consumeUserSignOut` in `identityRecord.ts`). `IdentityAvatar.handleSignOut`
sets it immediately before `supabase.auth.signOut()`; the AuthGate reconciler now
clears the identity on `SIGNED_OUT` ONLY when the flag is set. A library-emitted
`SIGNED_OUT` from an online token-refresh failure leaves the stale-token friend
signed in (calm amber SyncDot), never a mid-venue logout. authGate.test.tsx updated
to assert both the user-initiated clear and the background no-clear.

**File:** `packages/app/src/auth/AuthGate.tsx:67-78` (with `packages/app/src/db/supabase.ts:33`)
**Issue:** The reconciler clears the identity on *any* `onAuthStateChange` `"SIGNED_OUT"`
event, and the header comment / threat model (T-18-06-A) assert this is "the ONLY event
that clears the identity … a pending/failed offline refresh never reaches here." That
assumption is only half true. `supabase.ts` constructs the client with **default** auth
options (`autoRefreshToken: true`, `persistSession: true`) — the "Offline-session tuning
is Phase 18" comment was never acted on. With auto-refresh on, supabase-js emits
`SIGNED_OUT` automatically whenever a token refresh returns a *definitive* invalid-grant
(e.g. a refresh token that genuinely expired or was invalidated) — **not** only on a
user tap. This path is reached when the user is **online** with a truly-stale refresh
token (e.g. a friend who signed in weeks earlier and hasn't opened the app online since),
and it will `clearIdentityRecord()` and eject them to the sign-in screen mid-use —
exactly the "jarring logout" T-18-06-A says never happens.
Offline is safe (network errors do not emit `SIGNED_OUT`), so the CRUX holds; the gap is
the online-invalid-refresh case.
**Fix:** Distinguish user-initiated sign-out from a library-emitted one. Simplest: set a
module/ref flag in `IdentityAvatar.handleSignOut` (and clear the record there, as it
already does) and, in the reconciler, only `clearIdentityRecord()` on `SIGNED_OUT` when
that flag is set:
```ts
// identityRecord.ts (or a small shared module)
export let userInitiatedSignOut = false;
export const markUserSignOut = () => { userInitiatedSignOut = true; };

// AuthGate reconciler
if (event === "SIGNED_OUT") {
  if (userInitiatedSignOut) clearIdentityRecord();
  userInitiatedSignOut = false;
  setTokenFresh(false);
  return;
}
```
If auto-eject on a server-invalidated session is actually desired, keep the code but drop
the T-18-06-A "only explicit sign-out clears identity" claim from the comments so the
invariant matches the behavior.

### WR-02: `importSnapshot` clears `trackedShows`/`trackedEntries` globally — destroys a co-resident identity's tracked data on a shared device

**RESOLVED** (commit `2645dca`): Replaced the unscoped `trackedShows.clear()` /
`trackedEntries.clear()` with `where("userId").equals(userId).delete()` scoped to
the importing identity, preserving the Phase-5 clear-and-rewrite semantics for that
identity while leaving a co-resident identity's rows intact. Added a regression test
proving another identity's tracked shows/entries survive a scoped full-restore import.

**File:** `packages/app/src/db/db.ts:887-890`
**Issue:** The import commit runs `db.trackedShows.clear()` and `db.trackedEntries.clear()`
(full-table wipes) before re-adding the merged rows. These clears are **not** scoped by
`userId`. On a shared/borrowed phone where identity A has tracked shows/entries and
identity B performs a full-restore import, **all of identity A's tracked shows and
entries are deleted**, not just B's. The union tables (`attendedShows`/`archiveShows`/
`bingoCards`) are preserved via `bulkPut`, but the two cleared tables are a genuine
cross-identity data-loss path that contradicts D-09. It is documented as a "Known
Limitation," but every row now carries a `userId`, so the safe form is cheap.
**Fix:** Scope the destructive clears to the importing identity instead of wiping the table:
```ts
await db.trackedShows.where("userId").equals(userId).delete();
await db.trackedShows.bulkPut(stamp(snapshot.trackedShows));
await db.trackedEntries.where("userId").equals(userId).delete();
await db.trackedEntries.bulkAdd(stamp(snapshot.trackedEntries));
```
(The clear-and-rewrite was originally for the volatile `++id` / dedupe-drop concern from
Phase 5; a userId-scoped delete preserves that semantic for the importer while leaving a
co-resident identity's rows intact.)

### WR-03: Show-Mode reads stay unscoped — identity A's active show + live trail is visible to identity B on a borrowed phone

**RESOLVED** (commit `92a1ea8`): Scoped the active-show reads to the current identity.
`useShowSession`'s active query filters by `useAuthIdentity()?.userId`; `getActiveShow`
filters by `readIdentityRecord()?.userId` — both with a null-identity fallback matching
the Plan-07 dex consumers. The entries and `bingoCardRow` reads key off the now-scoped
active session's `sessionId`, so they are transitively scoped too. Identity B on a
borrowed phone no longer sees identity A's in-progress setlist/trail/tally/bingo.

**File:** `packages/app/src/show/ShowView.tsx:92,316-322` (via `useShowSession` and
`db.trackedShows.where("status").equals("active")` / `getActiveShow` in `db.ts:508-509`)
**Issue:** Every namespaced *dex* read was scoped, but the Show-Mode session reads
(`useShowSession`, `getActiveShow`, and ShowView's `bingoCardRow` live query) are still
global — they select the single `"active"` tracked show and its entries with no `userId`
filter. If identity A leaves a show active and hands the phone to identity B (the exact
borrowed-phone scenario D-09 targets), B navigating to `#/show` sees A's in-progress
setlist, trail, tally, and bingo card. This is a real cross-identity **read exposure** of
A's data. It is documented as the accepted "single-active exception" (T-18-07-EX), but it
directly contradicts "a borrowed phone must never see identity A's data," so it should be
surfaced, not silently accepted.
**Fix:** Scope the active-show reads to the current identity (write-stamping already puts a
`userId` on these rows, so it is cheap):
```ts
db.trackedShows.where("status").equals("active")
  .and((r) => r.userId === currentUserId).first()
```
If deferring to a later phase, note the exposure explicitly in the human-UAT so the owner
tests hand-off with an active show and accepts the risk knowingly.

### WR-04: A failed first-login legacy claim is swallowed — the owner's entire v1 dex can silently render empty with no retry

**RESOLVED** (commit `73b7f4a`): Wrapped the SignInScreen `claimLegacyDexOnce` call in
try/catch so a first-login failure never becomes an unhandled rejection and never blocks
a successful sign-in. Added an idempotent post-boot self-heal effect in AuthGate that
re-runs the meta-gated exactly-once claim on every app open — so a transient first-login
failure self-heals on the next launch without requiring an explicit sign-out to reach
SignInScreen again.

**File:** `packages/app/src/auth/SignInScreen.tsx:106-109` (with `auth/claimDex.ts:30-66`)
**Issue:** `handleSubmit` does `writeIdentityRecord(...)` then `await claimLegacyDexOnce(userId)`.
The write re-renders the AuthGate into `<App/>` immediately. If `claimLegacyDexOnce` then
rejects (its whole stamp runs in one rw transaction that rolls back on any failure, leaving
`dexClaimedBy` unset), the rejection is an **unhandled promise rejection** — there is no
`try/catch`, no user feedback, and no re-trigger. The owner's legacy (untagged) rows stay
`userId === undefined`, which every scoped read and the scoped export then **exclude**, so
the owner lands in `<App/>` with an apparently-empty GizzDex and no indication why. Because
the user is now signed in, they never hit `SignInScreen` again (short of an explicit
sign-out), so the "retry on next login" safety net documented in `claimDex.ts` does not
actually fire.
**Fix:** Await/guard the claim and retry-or-surface on failure, e.g.:
```ts
writeIdentityRecord({ userId, displayName });
try {
  await claimLegacyDexOnce(userId);
} catch {
  // optional: re-attempt once, or record a meta flag so a post-boot effect retries.
  // At minimum, do not leave it as an unhandled rejection.
}
```
Alternatively, drive `claimLegacyDexOnce` from an idempotent post-boot effect in `AuthGate`
(it is already meta-gated and safe to call repeatedly), so a transient first-login failure
self-heals on the next app open rather than requiring a sign-out.

## Info

### IN-01: `meta` table is global (unnamespaced) and is bulk-overwritten on import

**File:** `packages/app/src/db/db.ts:801-816,875`
**Issue:** `snapshot()` reads `db.meta.toArray()` unscoped and `importSnapshot` does
`db.meta.bulkPut(snapshot.meta)`. `meta` intentionally holds device-global settings
(`ownerName`, `dexClaimedBy`, rotation-reset date, persist flags), so on a shared device
identity B sees identity A's settings, and a merged import can overwrite the local
`dexClaimedBy`/`ownerName` with values from the imported file. No dex catches or
credentials leak (those are namespaced / in a separate key), so impact is low, but
overwriting `dexClaimedBy` could suppress a future legitimate legacy claim for a new
identity on the same device.
**Fix:** No change required for v2.0; if hardened later, exclude `dexClaimedBy` (and any
identity-scoped meta) from the import's `meta.bulkPut`, or namespace the small set of
per-identity meta keys.

### IN-02: `attendedShows`/`archiveShows` `&show_id` unique key lets two identities overwrite each other's marks

**File:** `packages/app/src/db/db.ts:374-380,751-765` (documented at db.ts:366-373)
**Issue:** Both tables keep a unique `&show_id` primary key with `userId` as a plain
secondary index, so on one device identity B marking a show that identity A already marked
upserts over A's row (A's mark then vanishes from A's scoped dex). Thoroughly documented as
the accepted Pitfall-4 limitation and out of scope for v2.0; flagged only so it is on the
record as a real shared-device integrity edge, not an oversight.
**Fix:** (future) move to a compound `[show_id+userId]` primary key if per-identity
co-resident marks are ever required.

### IN-03: `identityColorIndex` divides by `paletteLength` with no guard

**File:** `packages/core/src/identity/color.ts:24`
**Issue:** `Math.abs(hash) % paletteLength` returns `NaN` if ever called with
`paletteLength === 0`. Every current caller passes `config.auth.IDENTITY_COLORS.length`
(6), and the JSDoc requires `>= 1`, so this is latent only. A `NaN` index would yield an
`undefined` fill (avatar renders with no background), not a crash.
**Fix:** Optional defensive guard: `if (paletteLength < 1) return 0;` at the top, matching
the palette-agnostic contract.

---

_Reviewed: 2026-07-22T22:17:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
