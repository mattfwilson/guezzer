# Phase 12: Data Safety & Integrity - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A tightly-scoped bug-fix cluster — no new user-facing features. The exported JSON
backup (the iOS-eviction backstop) must be **honest and complete**, and same-date
doubleheaders must survive as **distinct attendances** through merge and dex
derivation. Four fixes:

1. **SAFE-01** — Ending a show then exporting a backup always records that show as
   finalized; a restored backup never resurrects an "active" show. Root cause:
   `EndShowDialog.handleConfirm` fires `void endShow()` then `void exportBackup()`
   with neither awaited, so the backup can snapshot the DB before the finalize
   commits.
2. **SAFE-02** — Backup and share-card downloads complete reliably on iOS Safari;
   no same-tick `revokeObjectURL` aborting the download. Root cause: `exportDownload.ts`
   and `shareCard.ts` both revoke the object URL in a `finally` on the same tick as
   `anchor.click()`.
3. **SAFE-03** — The "Backup saved" confirmation appears only after a backup actually
   succeeds, never while the End-Show dialog is still open. Root cause: a static
   `CircleCheck` "backup saved" line is rendered as markup while the dialog is open,
   regardless of any backup result.
4. **SAFE-04** — Two shows attended on the same date are tracked and counted as two
   distinct attendances across merge and dex derivation; doubleheaders are not
   collapsed. Root cause: `attendanceGroupKey` (shared by `merge.ts` and
   `derive-dex.ts`) keys unbound shows by `date:`, collapsing any two unbound
   same-date shows — a deliberate Phase-5 D-11 choice for phone+iPad "same night"
   dedup that now over-collapses genuine doubleheaders.

**Out of scope:** Phase-13 UX bugs (safe-area inset, wake-lock race, fill-hint
off-by-N, constellation camera — UX-01/02/03/04) even though they keyword-match;
any new features; any UI polish beyond what SAFE-03's confirmation surface requires.

**Posture (carried from Phase 9):** smallest-possible hardening, robustness over
strictness, don't touch working UX beyond the four fixes.

</domain>

<decisions>
## Implementation Decisions

### SAFE-04 — Doubleheader identity (the substantive one)
- **D-01: Doubleheaders MUST survive; that priority is locked.** Two genuinely-
  distinct shows on the same date must remain two distinct attendances through both
  `merge.ts` and `derive-dex.ts`. This is non-negotiable — it is the requirement.
- **D-02: Mechanism is Claude's discretion, with a hard constraint.** The exact
  keying change is planning's call, BUT multi-device "same night, two devices"
  dedup (Phase-5 D-11's original purpose) must **degrade gracefully** — never
  re-introduce doubleheader loss to preserve dedup. The safe direction is
  over-counting your own attendance (rare: two devices BOTH offline/unbound all
  night) over losing a caught show. Note: the ambiguous case is narrow — the
  date-collapse only fires when BOTH shows are unbound; a bound (`id:X`) and an
  unbound (`date:D`) show already don't collapse today.
- **D-03: The derive-dex date-join is the KEY research subtlety — flag it, don't
  lock a mechanism.** In `derive-dex.ts` the SAME `date:` key that collapses
  doubleheaders also JOINS an unbound tracked night to its retro/archive setlist by
  date. The doubleheader-split and the tracked↔archive join are the same code path
  in tension. Research/planning MUST solve both together (do not split doubleheaders
  in a way that silently drops an unbound night's archive-setlist join). This is the
  first thing the researcher should dig into.

### SAFE-01 + SAFE-03 — End-Show backup sequencing & honest confirmation
- **D-04: Sequence the finalize before the snapshot.** `handleConfirm` must
  `await endShow(sessionId)` (finalize committed) BEFORE `exportBackup()` reads the
  DB snapshot, so the backup can never capture the show as still-active (SAFE-01).
  The current fire-and-forget `void endShow(); void exportBackup();` is the bug.
- **D-05: Honest confirmation is a post-close toast on real success.** The dialog
  closes immediately on confirm; a brief, non-blocking toast/nudge ("Backup saved")
  appears ONLY once `exportBackup()` resolves `{ ok: true }` (SAFE-03). Remove the
  static `CircleCheck` "backup saved" line that currently renders while the dialog
  is open. A failed backup should not show a success toast (surface the Settings
  export as the retry path, per the existing never-throw contract). The recap
  (`onEnded` seam) may open in parallel — it does not carry the confirmation.

### SAFE-02 — iOS download-abort fix
- **D-06: Defer the revoke via a config-driven timeout.** Replace the same-tick
  `finally { URL.revokeObjectURL(url) }` with a deferred revoke
  (`setTimeout(() => URL.revokeObjectURL(url), <config delay>)`) long enough for the
  iOS download to start. The delay constant lives in the single app config file
  (no scattered magic numbers).
- **D-07: Centralize the anchor-download idiom into one helper.** Extract a single
  `triggerDownload()` (or equivalent) helper shared by `exportDownload.ts` and
  `shareCard.ts` so the SAFE-02 fix lives in ONE place and can't drift — the
  duplication is exactly what produced two copies of the same bug. While there,
  address the `shareCard.ts` `previewUrl` (`URL.createObjectURL` at ~line 234) leak
  consistently.

### Regression proof standard
- **D-08: Unit + component + documented iOS UAT.**
  - **Unit** (core, Node, the established fixture pattern): the pure doubleheader
    path in `merge.ts` and `derive-dex.ts` — two distinct same-date shows stay
    distinct; a genuine phone+iPad same-night (bound) still dedups.
  - **Component** (app, jsdom): the End-Show `finalize → backup → confirm` ordering
    (SAFE-01 sequencing + SAFE-03 confirmation only on success).
  - **Manual iOS UAT** (can't be unit-tested): the SAFE-02 download-abort fix on a
    real iOS Safari device — persist as a UAT item.

### Claude's Discretion
- SAFE-04 exact keying/grouping mechanism (D-02) and the derive-dex join solution
  (D-03), within the locked priority and constraints.
- The revoke defer-delay value (D-06) and the exact shape/placement/copy of the
  post-close success toast (D-05) — UI/planning's call.
- Whether the centralized `triggerDownload` helper lives in `packages/app`
  (browser-only; it touches DOM, so NOT core) and its exact signature (D-07).
- Test fixture strategy for the doubleheader assertions (existing small fixture
  setlists in `packages/core/test/fixtures/` are the established pattern).

### Folded Todos
The four Phase-12 bug todos map 1:1 onto the SAFE requirements and are folded into
this phase's scope:
- `.planning/todos/pending/2026-07-19-fix-end-show-backup-race-with-finalize.md` → SAFE-01 (D-04)
- `.planning/todos/pending/2026-07-19-defer-revoke-object-url-on-downloads.md` → SAFE-02 (D-06/D-07)
- `.planning/todos/pending/2026-07-19-fix-premature-backup-saved-message.md` → SAFE-03 (D-05)
- `.planning/todos/pending/2026-07-19-fix-same-date-doubleheader-collapse.md` → SAFE-04 (D-01/02/03)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 12 section: goal, 4 success criteria, requirement
  IDs (SAFE-01/02/03/04), "independent bug cluster."
- `.planning/REQUIREMENTS.md` — authoritative text for SAFE-01/02/03/04 (lines 24–27).

### SAFE-01 + SAFE-03 (End-Show backup flow)
- `packages/app/src/show/EndShowDialog.tsx` — `handleConfirm` (the `void endShow();
  void exportBackup();` race, SAFE-01) and the static `CircleCheck` "backup saved"
  line (SAFE-03). This is the primary edit surface for both.
- `packages/app/src/settings/exportDownload.ts` — `exportBackup()` (never-throw
  contract, `snapshot()` read); the sequencing in D-04 must ensure the snapshot is
  read AFTER finalize commits.
- `packages/app/src/db/db.ts` — `endShow(sessionId)` (flips `status: "finalized"`)
  and `snapshot()` (reads the four tables + owner); the ordering guarantee lives at
  the seam between these two.

### SAFE-02 (iOS download-abort)
- `packages/app/src/settings/exportDownload.ts` — same-tick `revokeObjectURL` in the
  `finally` (~line 60).
- `packages/app/src/dex/shareCard.ts` — the duplicated anchor idiom's `finally`
  revoke (~line 286) AND the unreleased `previewUrl` `createObjectURL` (~line 234).
- `packages/app/src/dex/ShareCardSheet.tsx` — the share-card download/preview caller
  (context for where the previewUrl is consumed/should be released).
- `packages/app/src/config.ts` — single app config file where the revoke defer-delay
  constant belongs.

### SAFE-04 (doubleheader collapse)
- `packages/core/src/data-safety/merge.ts` — `attendanceGroupKey` (bound→`id:showId`,
  unbound→`date:date`, ~line 58) and the Step-5 same-show dedupe (~lines 174–275).
  This is where D-11's collapse lives on the merge side.
- `packages/core/src/dex/derive-dex.ts` — its own `attendanceGroupKey` (~line 71) and
  the tracked∪retro grouping (~lines 126–158). The date-join-vs-split tension (D-03)
  is HERE.
- `packages/core/test/fixtures/` — established small-fixture pattern for the
  doubleheader unit tests.

### Prior-phase decisions (the behavior being revised)
- `.planning/phases/05-live-sync-data-safety/05-CONTEXT.md` — D-11 (same-show dedupe
  bound→show_id / unbound→date — the SAFE-04 root cause), D-13 (auto-backup at End
  Show, never-throw contract, one-time persist warning — the SAFE-01/02/03 flow),
  D-07 (live-sync auto-bind to show_id, which is what makes multi-device dedup work
  when online).
- `.planning/phases/09-data-integrity-restore-ux/09-CONTEXT.md` — the "smallest-
  possible hardening, robustness over strictness, don't touch working UX" posture and
  the pure-function-with-direct-tests style to mirror.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `attendanceGroupKey` — deliberately duplicated (same idiom) in `merge.ts` and
  `derive-dex.ts`; the SAFE-04 fix must keep the two in sync (or share one source of
  truth). Both derive from Phase-5 D-11.
- `exportBackup()` never-throw contract (`{ ok: boolean }`) — the honest-confirmation
  fix (D-05) keys off its real resolved value; the contract stays.
- `packages/core/test/fixtures/*.json` — small fixture setlists with known expected
  outputs; established pattern for the doubleheader unit tests (D-08).
- Vitest `projects` (core=`node`, app=`jsdom`) — merge/derive-dex tested in Node;
  the End-Show ordering component test in jsdom.

### Established Patterns
- Strict core/UI separation: SAFE-04 is entirely `packages/core` (pure, Node-testable);
  SAFE-01/02/03 are `packages/app` (DOM/browser). The `triggerDownload` helper (D-07)
  is browser-only → app, NOT core.
- Never-throw browser-call idiom (`pwa/persist.ts`, `exportDownload.ts`): a failed
  Blob/anchor/DB call surfaces as `{ ok: false }`, never breaks the finalize flow.
- Single config file for constants (revoke defer-delay belongs there).
- Additive-only, committed-artifact-reviewed ethos (unchanged this phase).

### Integration Points
- `EndShowDialog.handleConfirm` → `endShow` → `exportBackup` → success toast: the
  SAFE-01/03 seam. Ordering: finalize commit → snapshot read → download → confirm.
- `merge.ts parseAndMergeImport` and `derive-dex.ts` both consume the attendance-group
  key — a doubleheader must stay split in BOTH, and the derive-dex archive-setlist
  date-join must still resolve (D-03).
- `triggerDownload` helper (new, D-07) plugs into both `exportDownload.ts` and
  `shareCard.ts`.

</code_context>

<specifics>
## Specific Ideas

- **The backup must not lie:** finalize-before-snapshot (SAFE-01) and confirm-only-on-
  real-success (SAFE-03) are two halves of one principle — the "Backup saved" signal
  must reflect a backup that actually happened, of a show that's actually finalized.
- **The safe direction for SAFE-04:** if forced to choose, over-count your own
  attendance (a rare both-offline two-device night) rather than ever lose a caught
  doubleheader. Losing a show from the dex is the failure this project exists to prevent.
- **Fix the bug once:** SAFE-02 exists twice because the download idiom was copied;
  centralizing (D-07) is the fix that stops it recurring.

</specifics>

<deferred>
## Deferred Ideas

None raised beyond phase scope during discussion — the phase stayed on its four fixes.

### Reviewed Todos (not folded)
These keyword-matched Phase 12 but belong to **Phase 13** (Interface & Explore Polish,
UX-01/02/03/04) or are UI polish/backlog — reviewed and deliberately NOT folded:
- `2026-07-19-fix-doubled-top-safe-area-inset.md` — Phase 13 (UX-01).
- `2026-07-19-fix-wake-lock-acquire-release-race.md` — Phase 13 (UX-02).
- `2026-07-19-fix-fill-hint-off-by-n-position-matching.md` — Phase 13 (UX-03).
- `2026-07-19-stop-constellation-camera-snap-on-resize.md` — Phase 13 (UX-04).
- `2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`,
  `2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`,
  `2026-07-18-final-show-share-card-uses-gizzdex-totals.md` — UI polish, out of scope
  (also reviewed-not-folded in Phase 9).

</deferred>

---

*Phase: 12-Data Safety & Integrity*
*Context gathered: 2026-07-19*
</content>
</invoke>
