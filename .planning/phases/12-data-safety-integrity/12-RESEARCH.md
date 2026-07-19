# Phase 12: Data Safety & Integrity - Research

**Researched:** 2026-07-19
**Domain:** Local-first data integrity — Dexie/IndexedDB snapshot honesty, iOS Safari object-URL download lifecycle, pure-core attendance grouping
**Confidence:** HIGH (all findings verified by reading the actual code paths in this repo; no external-package claims)

## Summary

This is a four-fix hardening cluster, not a feature build. CONTEXT.md already fixed the
root causes, files, and line numbers; this research **validates the risky mechanisms against
the real code** and surfaces the planning landmines — chiefly the D-03 doubleheader/archive
tension, which turns out to be **narrower and safer than feared** once the code is read in full.

Headline finding on D-03: the "archive-setlist date-join" that CONTEXT.md warns could break
**does not exist in the current code.** In `derive-dex.ts`, archive/cache setlists attach to an
attendance group **strictly by `show_id`** (`group.showIds`), and an *unbound* tracked show
never contributes a `show_id`. An unbound-only group therefore pulls **zero** archive setlists —
its sightings come purely from its own `trackedEntries`. Consequently the doubleheader fix can
change **only the unbound branch** of `attendanceGroupKey`, leaving every `id:`-keyed join
(tracked↔retro, online multi-device dedup) byte-for-byte intact.

**Primary recommendation:** For SAFE-04, key unbound tracked shows by `date:${date}#${sessionId}`
(Mechanism A) — each unbound session becomes its own attendance. This can never collapse a
genuine doubleheader (the locked D-01 priority), preserves all `show_id` joins, and needs no new
field threaded into `DexSnapshotInput` (`sessionId` is already present). The only cost is the
narrow, D-02-sanctioned over-count: a phone+iPad night where **both** devices stay offline all
night (never bind) counts as two attendances. For SAFE-01/02/03, apply the mechanical fixes in
CONTEXT.md, with one added structural requirement: the "Backup saved" toast must be hosted
**above ShowView** because confirming End Show swaps ShowView's whole tree for `<RecapView>`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | Ending a show then exporting a backup always records that show as finalized; a restored backup never resurrects an "active" show. | Verified `endShow()` resolves after the Dexie commit and `snapshot()` is a fresh read → `await endShow(sessionId)` before `exportBackup()` guarantees a finalized snapshot. §SAFE-01. |
| SAFE-02 | Backup and share-card downloads complete reliably on iOS Safari — no same-tick `revokeObjectURL` aborting the download. | Located both same-tick `finally` revokes (`exportDownload.ts:58-61`, `shareCard.ts:285-287`); centralized deferred-revoke helper design in §SAFE-02. |
| SAFE-03 | "Backup saved" confirmation appears only after a backup actually succeeds, never while the End-Show dialog is open. | Located the static `CircleCheck` markup (`EndShowDialog.tsx:108-112`); toast-host placement analysed against the recap early-return. §SAFE-03. |
| SAFE-04 | Two same-date shows are counted as distinct attendances across merge and dex derivation (doubleheaders not collapsed). | Full read of both `attendanceGroupKey` sites; Mechanism A keying change proven safe against the archive join. §SAFE-04. |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Doubleheaders MUST survive — two genuinely-distinct same-date shows remain two
  distinct attendances through both `merge.ts` and `derive-dex.ts`. Non-negotiable.
- **D-02:** SAFE-04 mechanism is Claude's discretion **with a hard constraint** — multi-device
  "same night, two devices" dedup must **degrade gracefully**, never re-introducing doubleheader
  loss to preserve dedup. Safe direction: over-count your own attendance (rare both-offline
  two-device night) over losing a caught show. The date-collapse only fires when BOTH shows are
  unbound; a bound (`id:X`) + unbound (`date:D`) pair already does not collapse.
- **D-03:** The derive-dex date-join is the KEY research subtlety — flag it, solve split + join
  together, do not silently drop an unbound night's archive-setlist join.
- **D-04:** Sequence the finalize before the snapshot — `await endShow(sessionId)` BEFORE
  `exportBackup()` reads the DB. The fire-and-forget `void endShow(); void exportBackup();` is the bug.
- **D-05:** Honest confirmation is a post-close toast on real success — dialog closes immediately;
  a brief non-blocking toast appears ONLY once `exportBackup()` resolves `{ ok: true }`. Remove the
  static `CircleCheck` line. A failed backup shows no success toast (Settings export is the retry
  path). The recap (`onEnded`) may open in parallel — it does NOT carry the confirmation.
- **D-06:** Defer the revoke via a config-driven timeout — replace same-tick `finally` revoke with
  `setTimeout(() => URL.revokeObjectURL(url), <config delay>)`. Constant lives in the single app config file.
- **D-07:** Centralize the anchor-download idiom into one `triggerDownload()` helper shared by
  `exportDownload.ts` and `shareCard.ts`; address the `shareCard.ts` `previewUrl` leak consistently.
- **D-08:** Regression proof = unit (core doubleheader paths) + component (End-Show ordering, jsdom)
  + documented iOS UAT (SAFE-02 download-abort).

### Claude's Discretion
- SAFE-04 exact keying/grouping mechanism (D-02) and the derive-dex join solution (D-03).
- The revoke defer-delay value (D-06) and exact shape/placement/copy of the post-close toast (D-05).
- Whether `triggerDownload` lives in `packages/app` (it does — browser-only) and its exact signature (D-07).
- Test fixture strategy for the doubleheader assertions.

### Deferred Ideas (OUT OF SCOPE)
- Phase-13 UX bugs (UX-01/02/03/04: safe-area inset, wake-lock race, fill-hint off-by-N,
  constellation camera) even though they keyword-match.
- Any new features; any UI polish beyond what SAFE-03's confirmation surface requires.
- Bottom-sheet animation, app-wide date format, share-card GizzDex totals (UI polish backlog).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Strict core/UI separation:** all domain logic in pure `packages/core` (zero React/DOM/browser);
  UI imports from core, never the reverse; core runnable/testable from Node. → SAFE-04 is pure core;
  SAFE-01/02/03 and the `triggerDownload` helper are `packages/app` (DOM), never core.
- **Single config file:** all constants (here, the revoke defer-delay) in `packages/app/src/config.ts` —
  no scattered magic numbers.
- **Testing:** unit tests for the scoring/derivation pipeline using small fixture setlists with known
  expected outputs (the `packages/core/test/fixtures/dex/synthetic.ts` factory idiom).
- **Node ≥ 24.12 / erasable-syntax-only TS:** no `enum`/`namespace` in core.
- **Additive-only, committed-artifact ethos:** unchanged this phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attendance grouping / doubleheader identity (SAFE-04) | Core (pure) | — | `merge.ts` + `derive-dex.ts` are DOM-free, Node-tested; keying is pure data logic. |
| End-Show finalize→snapshot sequencing (SAFE-01) | App (DB seam) | Core (serialize) | Ordering lives at the `endShow`/`snapshot` Dexie seam in `db.ts`; serialization is pure core. |
| "Backup saved" confirmation toast (SAFE-03) | App (DOM) | — | Toast is React/DOM UI; must outlive the dialog + recap swap. |
| Object-URL download lifecycle (SAFE-02) | App (DOM) | — | `URL.createObjectURL`/anchor/`setTimeout` are browser APIs → `triggerDownload` helper is app-only. |

## Standard Stack

No new packages. This phase edits existing modules only.

| Existing tool | Version | Role this phase |
|---------------|---------|-----------------|
| Dexie | 4.4.4 | `endShow` (update→commit) and `snapshot` (fresh read) — the SAFE-01 ordering seam. [CITED: CLAUDE.md] |
| Vitest (`projects`) | 4.1.10 | core=`node` (SAFE-04 unit), app=`jsdom` (SAFE-01/03 component). [VERIFIED: vitest.config.ts] |
| @testing-library/react | (installed) | jsdom component tests — pattern established in `packages/app/test/endShowDialog.test.tsx`. [VERIFIED: file reads] |
| zod | 4.4.3 | `exportEnvelope` schema — unchanged; note `trackedShowRow` already carries `sessionId` AND `startedAt`. [VERIFIED: export-schema.ts:77,81] |

**Package Legitimacy Audit:** N/A — no external packages are installed or added in this phase.

## SAFE-04 — Doubleheader identity (primary target)

### The three concrete answers (D-03 dig)

**Q1 — What distinguishes two same-date doubleheaders from ONE night on phone+iPad (both unbound)?**

Fields on an unbound `TrackedShow` [VERIFIED: `db.ts:69-88`]:

| Field | Doubleheader (2 distinct shows) | Phone+iPad (1 night, 2 devices) | Discriminating? |
|-------|--------------------------------|--------------------------------|-----------------|
| `sessionId` (crypto.randomUUID) | 2 distinct (2× Start Show) | 2 distinct (one per device) | **No** — both cases have 2 |
| `date` (YYYY-MM-DD) | same | same | No |
| `venueId/venueName/city` | null (unbound) | null (unbound) | No |
| `startedAt` (Date.now at Start) | hours apart (matinee vs evening) | ~minutes apart (both at show start) | Partially — coarse time-gap signal |
| `trackedEntries` (setlist content) | different setlists | ~same setlist | Partially — fragile, partial logs diverge |

**Honest conclusion:** there is **no clean field** that positively identifies a phone+iPad pair.
`startedAt` and setlist-content are only heuristics and both fail on the edges (a device that
started tracking late; a doubleheader whose two shows share an opener). This is exactly why D-02
says to pick the **safe failure direction** rather than chase perfect discrimination.

**Q2 — Can a keying change split doubleheaders WITHOUT breaking the archive-setlist join?**

First, the corrected fact (see Assumptions A1): **the archive-setlist "date-join" does not exist.**
In `derive-dex.ts` an archive/cache setlist is only ever pulled via `group.showIds`
(lines 156-161), and `group.showIds` is populated **only** by (a) retro `attendedShows`
(always `id:show_id`) and (b) *bound* tracked shows (`if (tracked.showId != null)`, line 142).
An **unbound** tracked show adds nothing to `showIds`, so an unbound-only group (`date:` key)
resolves sightings **purely from `trackedEntries`** — zero archive rows. The tracked↔retro join
is therefore a **`show_id` join, never a date join.** [VERIFIED: derive-dex.ts:136-166]

Therefore: **change only the unbound branch of `attendanceGroupKey`.** The `id:${showId}` branch
is untouched, so every `show_id`-based join and the online multi-device dedup are preserved exactly.

| Mechanism | Key for unbound | Splits doubleheaders? | Preserves | Breaks / cost |
|-----------|-----------------|----------------------|-----------|---------------|
| **A (recommended)** | `date:${date}#${sessionId}` | Yes — always (each session is its own attendance) | All `id:` joins; online multi-device dedup (both bind → `id:showId`); needs no new field (`sessionId` already in `DexSnapshotInput`) | Both-offline-all-night phone+iPad over-counts as 2 attendances (D-02-sanctioned). Inflates `showCount`/sightings **only** in that rare case. |
| B (time-bucket) | `date:${date}#${floor(startedAt/WINDOW)}` | Only if started > WINDOW apart | Same `id:` joins | Fragile (clock skew, late-start device, bucket-boundary straddle); **requires threading `startedAt` into `DexSnapshotInput.trackedShows`** (currently absent — only `{sessionId,date,status,showId}`). More surface, still imperfect. |

Recommend **Mechanism A** — smallest change, honors D-02's safe direction, never collapses a
doubleheader, no schema surface growth. Mechanism B is not worth its fragility for a personal tool.

**Why A degrades gracefully (D-02):** when *online*, both devices auto-bind to the same
`show_id` (Phase-5 D-07) → key `id:showId` → they still dedup via the untouched bound branch.
Only when **both** devices stay offline the entire night (never bind) does A over-count — the
exact narrow case D-02 authorizes sacrificing. It **never** loses a doubleheader.

**Q3 — Verify the CONTEXT claim: bound (`id:X`) + unbound (`date:D`) does NOT collapse today.**

CONFIRMED. `attendanceGroupKey(999, D)` → `"id:999"`; `attendanceGroupKey(null, D)` → `"date:D"`;
`"id:999" !== "date:D"` → separate groups. Identical logic in both sites:
`merge.ts:58-60` and `derive-dex.ts:71-73`. [VERIFIED]

### Shared-key refactor (kill the duplication)

`attendanceGroupKey` is duplicated verbatim in `merge.ts:58` and `derive-dex.ts:71` with slightly
different signatures (merge takes a `show` object; derive-dex takes `(showId, date)`). The SAFE-04
change must land in BOTH or they drift — the same class of bug D-07 fixes for `triggerDownload`.
Recommend extracting ONE pure function into core (e.g. `packages/core/src/data-safety/attendance-key.ts`)
with signature `attendanceKey(showId: number | null, date: string, sessionId: string): string` and
importing it in both sites. Retro `attendedShows` always pass a non-null `showId`, so the `sessionId`
argument is only consulted on the unbound branch — a dummy/actual value is harmless there.

### Merge-side (`merge.ts`) implications

- With Mechanism A, two unbound same-date shows get distinct keys → separate groups → **both
  survive** as attendances; Step-5 adoption's `if (bucket.length === 1) continue;` fast-path fires,
  so no song-union collapse. Correct. [VERIFIED: merge.ts:243]
- The Step-5 adoption logic (lines 222-269) still runs for **bound** multi-device groups (`id:showId`)
  — the case where it matters — unchanged.
- `addedShows`/`addedSongs` metrics (lines 291-300) key off the same `attendanceGroupKey`; unifying
  the function keeps them consistent automatically.

### LANDMINE: two existing passing tests encode the now-reversed behavior

The SAFE-04 fix **intentionally inverts** two currently-green tests. These are **not regressions** —
they must be **rewritten** to assert the new doubleheader-preserving behavior:

1. `packages/core/test/merge.test.ts:246` — *"collapses two unbound shows sharing a date to ONE
   attendance"* → must become *"keeps two unbound same-date shows as TWO attendances"*.
2. `packages/core/test/dex/derive-dex.test.ts:91` — *"dedupes two unbound tracked nights on the
   same date — ONE attendance"* → must assert `showCount === 2`.

Both must be paired with a **retained** assertion that genuine multi-device **online (bound, same
`show_id`)** still dedups to ONE (`merge.test.ts:216` and `derive-dex.test.ts:75` already cover the
bound path and should stay green untouched).

## SAFE-01 — Finalize-before-snapshot

**Verified mechanism:** `endShow(sessionId)` is `db.trackedShows.update(sessionId, {status:"finalized"})`
[db.ts:399-401] — the returned promise resolves after the Dexie transaction commits. `snapshot()`
[db.ts:501-512] is a fresh `Promise.all` of `.toArray()` reads. Because Dexie serializes operations
and the update promise resolves post-commit, **`await endShow(sessionId)` before `exportBackup()`
guarantees the snapshot reads `status:"finalized"`.** [VERIFIED: db.ts]

**Current bug** [EndShowDialog.tsx:82-87]:
```
const handleConfirm = () => {
  void endShow(sessionId);   // fire-and-forget
  void exportBackup();        // may snapshot BEFORE finalize commits
  onEnded?.(sessionId);
  onClose();
};
```

**Target sequence (D-04/D-05):**
```
const handleConfirm = async () => {
  await endShow(sessionId);   // commit finalize FIRST
  onEnded?.(sessionId);       // recap may open in parallel (does NOT carry confirmation)
  onClose();                  // dialog closes immediately
  const { ok } = await exportBackup();  // snapshot now reads a finalized show
  if (ok) /* fire post-close success toast — see SAFE-03 */;
};
```

**Seam note:** `exportBackup` never throws (`{ ok: boolean }` contract, exportDownload.ts:35-68),
so making `handleConfirm` async does not endanger the finalize/close contract.

## SAFE-03 — Honest post-close confirmation (toast placement is the real work)

**Remove:** the static markup at `EndShowDialog.tsx:108-112` (`CircleCheck` + `endShowBackupConfirmation`)
that renders unconditionally while the dialog is open.

**LANDMINE — where the toast lives:** the success toast **cannot** be owned by `EndShowDialog`
(it unmounts on `onClose`) **nor** by `ShowView`'s main tree, because confirming End Show sets
`recapSessionId`, and `ShowView` **early-returns `<RecapView>`** (`ShowView.tsx:272-276`), replacing
its entire subtree — where `EndShowDialog` lives — before the backup resolves. A toast in either
place would never render.

**Options (recommend the smallest that survives the recap swap):**

| Option | Survives recap swap? | Cost | Notes |
|--------|---------------------|------|-------|
| **App-level ephemeral toast (recommended)** | Yes — App renders above the tab router | Small: one module-level emitter/context + a toast component mirroring `UpdateToast` | Reuses `config.ui.z.toast` tier + `useBottomOverlayHeightRegistration` idiom [VERIFIED: UpdateToast.tsx]. `App.tsx:81-82` already hosts `<InstallBanner/><UpdateToast/>` — add a `<BackupToast/>` sibling. |
| Render confirmation inside `RecapView` | Yes | Medium | **Contradicts D-05** ("recap does not carry the confirmation") — avoid. |
| Keep in dialog with a delayed close | No | — | Violates D-05 ("dialog closes immediately") — reject. |

**Ownership of the await:** because the dialog unmounts, the `await exportBackup()` + toast trigger
should be driven so it does not `setState` on an unmounted `EndShowDialog`. Cleanest: `handleConfirm`
awaits `exportBackup()` and fires the **app-level** toast emitter (not local state), OR the
finalize→backup→toast orchestration is lifted to a small hook/handler that the persistent App-level
host owns. Either way the toast host must outlive both the dialog and the recap early-return.

**Copy:** an existing string `config.copy.settings.endShowBackupConfirmation` = "Backup saved to
your downloads." is available; the Settings path also uses `exportSuccess` = "Backup saved." /
`exportSuccessDetail` = "Check your downloads." Reuse rather than add new copy. [VERIFIED: config.ts:760-777]

**Failure path:** on `{ ok: false }`, show **no** success toast (D-05). The prominent Settings
export remains the retry path (never-throw contract already surfaces failure there).

## SAFE-02 — iOS download-abort (deferred revoke + one helper)

**Two same-tick revokes** (the duplicated bug D-07 targets):
- `exportDownload.ts:58-61` — `finally { URL.revokeObjectURL(url) }` on the same tick as `anchor.click()`.
- `shareCard.ts:285-287` — identical `finally` revoke in the Web-Share fallback path.

**`previewUrl` status** [shareCard.ts:234 + ShareCardSheet.tsx:62-83]: the preview `createObjectURL`
is **already released** by `ShareCardSheet`'s effect cleanup (on close/unmount and on cancelled
build). It is **not** a leak in the normal path. D-07's "address consistently" means the *download-
anchor* revoke is what centralizes; the previewUrl needs no behavioral change, but the plan should
note it explicitly so a reviewer doesn't "fix" a non-bug. (Optional: leave a one-line comment.)

**`triggerDownload` helper (D-07):**
- **Home:** `packages/app` (touches `document`/`URL`/`setTimeout` → browser-only, NOT core).
  Suggested `packages/app/src/settings/triggerDownload.ts` or a small `packages/app/src/pwa/` module.
- **Signature:** `triggerDownload(data: Blob | File, filename: string): void` — creates the object URL,
  appends a `rel="noopener"` anchor, clicks, removes, then **defers** the revoke:
  `setTimeout(() => URL.revokeObjectURL(url), config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS)`.
- Both `exportBackup()` and `shareOrDownload()`'s fallback branch call it — the fix lives in ONE place.

**Config constant (D-06):** add to `config.dataSafety` (alongside `SCHEMA_VERSION`) e.g.
`OBJECT_URL_REVOKE_DELAY_MS`. **Safe iOS range:** the object URL must stay alive until the download
navigation begins. A conservative floor of ~1000 ms is generally sufficient for a click-driven
download; FileSaver.js historically uses 40000 ms (40 s) to be maximally safe. `[ASSUMED]` — not
re-verified against a live iOS device this session; the value is config-tunable and confirmed on
device during SAFE-02 UAT (D-08). Object URLs do not persist across reloads, so erring longer is cheap;
a value in the **1000–10000 ms** band is a reasonable, safe default. **Do not** revoke on the click tick.

## Runtime State Inventory

> Rename/refactor scope check — this phase changes an in-memory keying function and DOM download
> plumbing, not stored keys. Included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the SAFE-04 keying change is computed at merge/derive time from existing `sessionId`/`date`/`showId` fields already persisted. No stored key is renamed; no data migration needed. | None (verified: `attendanceGroupKey` output is never persisted — it's a transient `Map` key). |
| Live service config | None — no external service configuration involved. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None — new config constant is a source literal, not a secret. |
| Build artifacts | None — no package rename, no egg-info/binary. Existing bundled `archive.json`/matrix artifacts are untouched. | None. |

**Canonical question answer:** after the code lands, no runtime system holds a stale cached key —
attendance grouping is recomputed from raw rows on every derivation (deriveDex is "nothing stored,"
db.ts:1-12), so the new keying takes effect immediately with no backfill.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finalized-snapshot ordering | A manual "is committed?" poll/flag | `await` the Dexie `update` promise | Dexie already resolves post-commit; awaiting is the guarantee. |
| Object-URL cleanup timing | A "download-complete" listener (doesn't exist for anchor downloads on iOS) | Deferred `setTimeout` revoke via one helper | There is no reliable download-finished event; a time defer is the standard idiom. |
| Doubleheader vs multi-device discrimination | A clever content/time classifier | Key by `sessionId` + accept the safe over-count (D-02) | No field cleanly separates the cases; perfect discrimination is unachievable and unnecessary. |
| Toast surviving a view swap | A second toast copy inside RecapView | One app-level toast host (mirror `UpdateToast`) | Single source; matches existing `App.tsx` overlay pattern. |

## Common Pitfalls

### Pitfall 1: Editing only one `attendanceGroupKey`
**What goes wrong:** the doubleheader splits in dex but still collapses in merge (or vice-versa),
producing inconsistent attendance counts between a fresh derivation and a post-import derivation.
**Avoid:** unify into one shared core function (or edit both identically in the same task) and add a
test asserting parity.
**Warning sign:** merge tests green but derive-dex tests red (or the reverse) after the change.

### Pitfall 2: Treating the two reversed tests as regressions
**What goes wrong:** a plan-checker or executor "restores" the old collapse assertions, silently
re-introducing the SAFE-04 bug.
**Avoid:** explicitly rewrite `merge.test.ts:246` and `derive-dex.test.ts:91`; document in the task
that the inversion is intended (D-01).

### Pitfall 3: Success toast owned by a component that unmounts
**What goes wrong:** toast never appears because `EndShowDialog` closed and/or `ShowView` swapped to
`<RecapView>` before `exportBackup()` resolved.
**Avoid:** host the toast above the router (App level); fire via an emitter/context, not dialog-local state.
**Warning sign:** the jsdom component test passes with the toast in the dialog but nothing shows on device.

### Pitfall 4: The existing EndShowDialog test breaks on the async change
**What goes wrong:** `endShowDialog.test.tsx` mocks `db.ts` with **only** `endShow` (line 12-14) and
asserts synchronous calls. Making `handleConfirm` async (await endShow) and adding an awaited
`exportBackup()` will change call timing and pull in `snapshot`/`exportBackup`.
**Avoid:** update the test to mock `exportBackup` explicitly, `await` the click, and assert
**order** (endShow resolves before exportBackup's snapshot read) + toast-only-on-`{ok:true}`.
**Warning sign:** flaky "not called" assertions or an unmocked `snapshot` throwing into the never-throw catch.

### Pitfall 5: Revoke delay too short for iOS
**What goes wrong:** a sub-second (or same-tick) revoke aborts the download on iOS Safari.
**Avoid:** config-driven defer in the 1000–10000 ms band; verify on device (SAFE-02 UAT).

## Validation Architecture

> `workflow.nyquist_validation` treated as enabled (not `false`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, `test.projects` (core=`node`, app=`jsdom`) [VERIFIED: vitest.config.ts] |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm vitest run packages/core/test/merge.test.ts packages/core/test/dex/derive-dex.test.ts` (SAFE-04) |
| Component run | `pnpm vitest run --project @guezzer/app packages/app/test/endShowDialog.test.tsx` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | File Exists? |
|-----|----------|------|---------|-------------|
| SAFE-04 | Two unbound same-date shows → **2** attendances (dex) | unit (node) | `vitest run packages/core/test/dex/derive-dex.test.ts` | ✅ rewrite `:91` + add case |
| SAFE-04 | Two unbound same-date shows → **2** attendances (merge) | unit (node) | `vitest run packages/core/test/merge.test.ts` | ✅ rewrite `:246` + add case |
| SAFE-04 | Bound same-`show_id` multi-device → **1** attendance (still dedups) | unit (node) | same files | ✅ `:216` / `:75` stay green |
| SAFE-04 | Bound + unbound same date → 2 (unchanged) | unit (node) | same files | ✅ add/assert |
| SAFE-01 | `endShow` awaited (finalize commits) BEFORE `exportBackup` snapshot read | component (jsdom) | `vitest run --project @guezzer/app .../endShowDialog.test.tsx` | ⚠️ extend existing (mock `exportBackup`, assert order) |
| SAFE-03 | Success toast fires ONLY on `{ ok: true }`, only after close; no static "Backup saved" while open | component (jsdom) | same | ❌ Wave 0 (new assertions; toast host may need a testable seam) |
| SAFE-02 | Deferred revoke (no same-tick `revokeObjectURL`) | component (jsdom) — fake timers | `vitest run --project @guezzer/app` (new `triggerDownload` test) | ❌ Wave 0 (new `triggerDownload.test.tsx`; assert revoke fires only after timer advance) |
| SAFE-02 | Real iOS Safari download completes | **manual iOS UAT** | device (D-08) | UAT item — persist |

### Sampling Rate
- **Per task commit:** the relevant quick command above.
- **Per wave merge:** `pnpm vitest run` (full suite).
- **Phase gate:** full suite green + SAFE-02 iOS UAT logged before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Rewrite `packages/core/test/dex/derive-dex.test.ts:91` (doubleheader → 2) + add a bound-dedup-still-works assertion.
- [ ] Rewrite `packages/core/test/merge.test.ts:246` (doubleheader → 2) + retain bound-dedup case.
- [ ] Extend `packages/app/test/endShowDialog.test.tsx`: mock `exportBackup`, `await` the click, assert
      finalize-before-snapshot ordering and toast-only-on-success (SAFE-01/03).
- [ ] New `packages/app/test/triggerDownload.test.tsx` (fake timers): assert the object URL is revoked
      **only after** `config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS` elapses, never on the click tick (SAFE-02).
- [ ] `packages/app/test/configMirror.test.ts` (existing) — extend if the new constant needs a mirror check
      (only if a core mirror is introduced; recommend keeping the revoke-delay app-only, no core mirror).
- [ ] SAFE-02 iOS Safari UAT step documented (download of backup JSON **and** share-card PNG both complete).

## Environment Availability

Skipped — no new external tools, services, or runtimes. This phase edits existing TypeScript modules
and tests run under the already-present Vitest/pnpm toolchain.

## Security Domain

`security_enforcement` not configured for this repo; no auth/session/crypto surface is touched.
Relevant note (input-validation, V5): the import trust boundary (`merge.ts` parses hostile JSON via
the strict `exportEnvelope` zod gate, rejecting whole-file before any merge) is **unchanged** by the
SAFE-04 keying edit — the change is downstream of validation, operating only on already-parsed rows.
No new untrusted-string surface: the toast/confirmation copy is static config, and the SAFE-04 key is
composed from `sessionId` (UUID) + `date` (schema-validated), never rendered to the DOM.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | **Correction of D-03:** no "archive-setlist date-join" exists — archive setlists attach strictly by `show_id`; an unbound tracked night's sightings come only from its own `trackedEntries`. (Verified by reading `derive-dex.ts:136-166`, HIGH confidence — listed here because it *revises* a CONTEXT.md premise.) | SAFE-04 | If a hidden date-join existed, Mechanism A could drop an unbound night's setlist. Mitigated: verified in code; the plan's tests assert unbound-night sightings survive the split. |
| A2 | Safe iOS object-URL revoke delay is in the ~1000–10000 ms band (FileSaver.js precedent 40000 ms). Not re-verified on a live iOS device this session. | SAFE-02 | Too short → download still aborts on some iOS versions. Mitigated: config-tunable + mandatory device UAT (D-08). |

## Open Questions (RESOLVED)

Both items are Claude's-discretion calls (D-02 unification, D-05 toast host); planning adopted the recommendations below, so neither gates execution.

1. **Toast host wiring — emitter vs context vs lifted handler.** — RESOLVED: module-level emitter + an `<BackupToast/>` sibling to `UpdateToast` in `App.tsx` (adopted by plan 12-02).
   - Known: it must live above the tab router (App level) to survive the recap swap.
   - Unclear: the exact minimal seam (module-level event emitter, a tiny React context, or lifting the
     finalize orchestration to App). All are small.
   - Recommendation: a module-level emitter + an `<BackupToast/>` sibling to `UpdateToast` in `App.tsx`
     is the least-invasive and matches the existing overlay pattern. Planner/UI's call (D-05 discretion).

2. **Unify `attendanceGroupKey` into shared core module vs edit both in lockstep.** — RESOLVED: unify into one shared core module (adopted by plan 12-01).
   - Recommendation: unify (one function in core) — it directly removes the drift risk that is the
     root cause pattern. Costs one small new file. If the planner prefers minimal churn, editing both
     identically in a single task with a parity test is acceptable.

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `packages/core/src/dex/derive-dex.ts` — `attendanceGroupKey` (71), Step-1 grouping (126-144), archive join via `showIds` (156-161).
- `packages/core/src/data-safety/merge.ts` — `attendanceGroupKey` (58), Step-5 dedupe/adoption (174-275), metrics (291-300).
- `packages/core/src/data-safety/export-schema.ts` — `trackedShowRow` carries `sessionId` (77) + `startedAt` (81).
- `packages/app/src/db/db.ts` — `endShow` (399-401), `snapshot` (501-512), `TrackedShow` shape (69-88).
- `packages/app/src/show/EndShowDialog.tsx` — `handleConfirm` race (82-87), static CircleCheck (108-112).
- `packages/app/src/settings/exportDownload.ts` — never-throw `exportBackup`, same-tick revoke (58-61).
- `packages/app/src/dex/shareCard.ts` — fallback revoke (285-287), `previewUrl` (234).
- `packages/app/src/dex/ShareCardSheet.tsx` — previewUrl cleanup (62-83).
- `packages/app/src/show/ShowView.tsx` — recap early-return (272-276), EndShowDialog mount + onEnded (518-523).
- `packages/app/src/config.ts` — `dataSafety.SCHEMA_VERSION` (294), toast z-tier (263), confirmation copy (760-777).
- `packages/app/src/components/UpdateToast.tsx` — app-level toast pattern.
- `vitest.config.ts` — projects (core=node, app=jsdom).
- Existing tests: `packages/core/test/merge.test.ts` (215-310), `packages/core/test/dex/derive-dex.test.ts` (91-107), `packages/app/test/endShowDialog.test.tsx`.

### Secondary (MEDIUM — repo conventions)
- `CLAUDE.md` — stack versions, core/UI separation, single-config rule, test layout.
- `.planning/phases/12-data-safety-integrity/12-CONTEXT.md`, `.planning/REQUIREMENTS.md` (24-27).

### Tertiary (LOW — training knowledge, flagged)
- FileSaver.js 40 s revoke-delay precedent (A2) — training knowledge, not re-verified.

## Metadata

**Confidence breakdown:**
- SAFE-04 keying/join analysis: HIGH — every claim traced to a specific verified line; the D-03 fear was resolved by reading the code, not assumed.
- SAFE-01 ordering guarantee: HIGH — Dexie commit/read semantics verified against `db.ts`.
- SAFE-03 toast placement: HIGH — the recap early-return that forces app-level hosting is verified.
- SAFE-02 helper design: HIGH; revoke-delay value: MEDIUM/LOW (device-tunable, UAT-gated).

**Research date:** 2026-07-19
**Valid until:** stable (internal-code findings; ~30 days) — revisit only if `derive-dex.ts`/`merge.ts` grouping or `ShowView` recap seam changes.

## RESEARCH COMPLETE

**Phase:** 12 - Data Safety & Integrity
**Confidence:** HIGH

### Key Findings
- **D-03 resolved, not just flagged:** the archive-setlist "date-join" does not exist — archive
  setlists attach strictly by `show_id`; unbound tracked nights draw sightings only from their own
  `trackedEntries`. The doubleheader fix touches ONLY the unbound key branch and is provably safe.
- **Mechanism A (`date:${date}#${sessionId}`)** splits doubleheaders, preserves every `show_id` join
  and online multi-device dedup, needs no new field, and over-counts only the D-02-sanctioned
  both-offline-two-device night.
- **Verified Q3:** bound + unbound same-date already does not collapse (`id:X` ≠ `date:D`).
- **SAFE-01:** `await endShow` before `exportBackup` genuinely guarantees a finalized snapshot
  (Dexie update resolves post-commit; snapshot is a fresh read).
- **SAFE-03 landmine:** the success toast must be hosted **above ShowView** (App level) because
  End Show swaps ShowView's tree for `<RecapView>`; it cannot live in the dialog or ShowView's main tree.
- **Two green tests must be rewritten** (`merge.test.ts:246`, `derive-dex.test.ts:91`) — the SAFE-04
  inversion is intended, not a regression; the existing EndShowDialog test needs async + `exportBackup` mocking.

### File Created
`.planning/phases/12-data-safety-integrity/12-RESEARCH.md`

### Ready for Planning
Research complete. The planner has a prescriptive keying mechanism (A), an explicit toast-host
constraint, a centralized `triggerDownload` design, and a Wave-0 test gap list including the two
intentional test inversions.
