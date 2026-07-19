# Phase 13: Interface & Explore Polish - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A tightly-scoped, lowest-severity bug-fix cluster — the last of the v1.2 bug
phases before Gizz Bingo. No new user-facing features. Four independent
live-venue UI/model rough edges, each with a root cause already identified in a
pending bug-hunt todo:

1. **UX-01** — On a notched iPhone installed PWA, the top safe-area inset is
   applied twice (`body { padding-top: env(safe-area-inset-top) }` in
   `styles.css:186` AND the AppShell header re-adds `calc(env(safe-area-inset-top)
   + 12px)`), producing a doubled ~50px dead band under `viewport-fit=cover`.
   Additionally, the three fixed-position overlays (SearchSheet, ArchiveBrowser,
   RecapView) escape body padding, so their headers sit one inset higher than the
   shell header — inconsistent header heights.
2. **UX-02** — The screen wake lock leaks after End Show: if `releaseWakeLock()`
   runs while an `await navigator.wakeLock.request("screen")` is still in flight,
   the release no-ops on the null sentinel, and the late-resolving request then
   stores a sentinel nothing ever releases (`showActive` is already false). Screen
   stays awake until the app is backgrounded.
3. **UX-03** — Fill-hints name the wrong song after position gaps. `resolvePlaceholders`
   (`suggest.ts:151`) matches a trail placeholder to a latest row by raw
   `position ===`, but trail positions gap on skipped/deleted entries (`logSong`
   uses monotonic max+1 and survives mid-trail deletes). After the first
   divergence a `???` can confidently name an off-by-N song, one tap from applying
   it via rename.
4. **UX-04** — The constellation camera snaps to fit-all on container resize.
   `onEngineStop` (`ConstellationCanvas.tsx:695`) unconditionally calls
   `zoomToFit`; the effect keyed on `[graphData, size.width, size.height]`
   reheats on any resize (iOS address-bar collapse, orientation, keyboard),
   re-firing `onEngineStop` and yanking the camera back to fit-all mid-exploration.

**Out of scope:** Any new features; Gizz Bingo (Phases 14–16); UI polish beyond
these four fixes; the two v2 UI todos that keyword-match Explore (directional-flow
particles, bottom-sheet animation — both conflict with settle-and-freeze / carry
to v2).

**Posture (carried from Phases 9 & 12):** smallest-possible hardening, robustness
over strictness, don't touch working UX beyond the four fixes.

</domain>

<decisions>
## Implementation Decisions

### UX-01 — Safe-area inset single source
- **D-01: One idiom — per-surface `env()`, drop the body padding.** Remove the
  top `padding-top: env(safe-area-inset-top)` from `body` in `styles.css`; every
  top-anchored surface (the shell/AppShell header AND each of the three fixed
  overlays) applies its own `env(safe-area-inset-top)` calc. The fixed overlays
  can't inherit body padding anyway (they escape body flow), so making that the
  single, consistent idiom eliminates the doubled inset and aligns overlay
  headers with the shell header. Planning MUST audit ALL fixed-position top
  surfaces for consistent header heights, not just the two files in the todo.
  - Note: the left/right/bottom body insets in `styles.css:187-189` are not part
    of this bug — only the top inset is doubled. Planning decides whether to
    leave the other three on `body` or move them too; consistency is the goal.

### UX-02 — Wake-lock acquire/release race
- **D-02: Re-check `showActive` after the acquire resolves.** In `acquireWakeLock`,
  after `const next = await navigator.wakeLock.request("screen")` resolves,
  re-check `showActive`; if it is already `false` (End Show fired during the
  in-flight request), release `next` immediately instead of storing it as
  `sentinel`. Keep the never-throw / silent-fallback contract intact. This fix is
  unambiguous — it is essentially locked by the todo; mechanism is planning's
  detail within this behavior.

### UX-03 — Fill-hint safety posture
- **D-03: Conservative-suppress — no hint beats a wrong hint.** Only offer a
  fill-hint when the placeholder's neighborhood clearly aligns with the editor
  sequence (e.g. the nearest surrounding *logged* songs match the editor rows
  around the candidate). When alignment is ambiguous, emit NO hint for that
  placeholder — the user fills it manually. The system must NEVER confidently name
  the wrong song; the worst acceptable outcome is a missing hint. This matches the
  "robustness over strictness" posture and is the simplest change to the pure-core
  `resolvePlaceholders`.
- **D-04: Dependency satisfied.** The todo noted this depends on the wrong-show
  date-guard fix landing first — that is Phase-11 LIVE-01 `guardLatestRows`, which
  shipped in `11-02` (SUMMARY confirms LIVE-01 completed). UX-03 is unblocked.

### UX-04 — Constellation camera on resize
- **D-05: Preserve the user's pan/zoom on resize; re-center only if the focus is
  lost.** Gate `zoomToFit` behind a first-settle flag so it fires ONLY on the
  initial engine stop per graph-data change — never on pure size changes. On a
  container resize the user's exact camera is preserved. Exception: if a focused
  node would fall off-screen after the resize, smoothly re-center on that node
  (do NOT fit-all). Any new duration/threshold constants for the re-center belong
  in the single app config file (`packages/app/src/config.ts`, `explore` section),
  no scattered magic numbers.

### Regression-proof standard
- **D-06: Unit + component + documented iOS UAT (mirrors Phase 12 D-08).**
  - **Unit** (core, Node, existing `packages/core/test` fixture pattern): UX-03 —
    `resolvePlaceholders` with a skipped/deleted-entry trail (position gaps) yields
    NO wrong-song hint; an aligned neighborhood still yields the correct hint; the
    already-covered same-position case still passes.
  - **Component** (app, jsdom): UX-02 — the acquire/release race
    (`releaseWakeLock` during an in-flight `request("screen")` leaves nothing held).
  - **Documented on-device iOS Safari UAT** (can't be unit-tested): UX-01 (single
    inset, aligned overlay headers on a notched iPhone standalone) and UX-04
    (camera survives address-bar collapse / orientation, re-centers when focus is
    lost). UX-02 also gets a device confirm (screen sleeps after End Show). Use the
    cloudflared HTTPS tunnel per the device-UAT memory. Persist as UAT items.

### Claude's Discretion
- UX-01: exact per-surface `env()` calc placement and whether to also move the
  left/right/bottom body insets for consistency (D-01).
- UX-02: exact code shape of the post-acquire re-check/release (D-02).
- UX-03: the precise alignment/neighborhood-match algorithm, as long as it never
  names a wrong song and suppresses on ambiguity (D-03).
- UX-04: the first-settle flag mechanism, off-screen-detection method, and
  re-center duration/threshold constant values in config (D-05).

### Folded Todos
The four Phase-13 bug todos map 1:1 onto the UX requirements and are folded into
this phase's scope:
- `.planning/todos/pending/2026-07-19-fix-doubled-top-safe-area-inset.md` → UX-01 (D-01)
- `.planning/todos/pending/2026-07-19-fix-wake-lock-acquire-release-race.md` → UX-02 (D-02)
- `.planning/todos/pending/2026-07-19-fix-fill-hint-off-by-n-position-matching.md` → UX-03 (D-03)
- `.planning/todos/pending/2026-07-19-stop-constellation-camera-snap-on-resize.md` → UX-04 (D-05)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 13 section: goal, 4 success criteria, requirement
  IDs (UX-01/02/03/04), "independent bug cluster; lowest severity."
- `.planning/REQUIREMENTS.md` — authoritative text for UX-01/02/03/04 (lines 31–34).

### The bug-hunt todos (root causes + proposed fixes — read all four)
- `.planning/todos/pending/2026-07-19-fix-doubled-top-safe-area-inset.md` — UX-01.
- `.planning/todos/pending/2026-07-19-fix-wake-lock-acquire-release-race.md` — UX-02.
- `.planning/todos/pending/2026-07-19-fix-fill-hint-off-by-n-position-matching.md` — UX-03.
- `.planning/todos/pending/2026-07-19-stop-constellation-camera-snap-on-resize.md` — UX-04.

### UX-01 (safe-area inset)
- `packages/app/src/styles.css:185-190` — the `body` `env(safe-area-inset-*)`
  padding block; the top line is the doubled one to remove.
- `packages/app/src/components/AppShell.tsx:41` — the header's re-added
  `calc(env(safe-area-inset-top) + 12px)`.
- `packages/app/src/**` fixed overlays that need their own top inset — SearchSheet,
  ArchiveBrowser, RecapView (planning MUST locate + audit all of them).

### UX-02 (wake-lock race)
- `packages/app/src/wakeLock.ts:36-84` — `acquireWakeLock` (the in-flight
  `await request("screen")` at :50 and the `sentinel = next` store at :62) and
  `releaseWakeLock` (:74, the null-sentinel no-op). The re-check goes after :50/:57.

### UX-03 (fill-hint off-by-N)
- `packages/core/src/live/suggest.ts:144-161` — `resolvePlaceholders`; the raw
  `row.position === entry.position` match at :151 is the bug. `FillHint` interface
  at :83-88.
- `packages/core/test/suggest.test.ts` — existing fixture idiom to extend.
- Phase-11 LIVE-01 `guardLatestRows` (the satisfied dependency):
  `packages/core/src/live/suggest.ts` (added in 11-02) and
  `.planning/phases/11-live-sync-prediction-correctness/11-02-SUMMARY.md`.

### UX-04 (constellation camera)
- `packages/app/src/explore/ConstellationCanvas.tsx:221-233` — the resize effect
  keyed on `[graphData, size.width, size.height]` that reheats/re-fires.
- `packages/app/src/explore/ConstellationCanvas.tsx:690-714` — `onEngineStop` +
  the unconditional `zoomToFit` (:707) that must go behind the first-settle flag.
- `packages/app/src/config.ts` — `explore` section (existing
  `ZOOM_TO_FIT_DURATION_MS`, `ZOOM_TO_FIT_PADDING_PX`, `COOLDOWN_TICKS`); any new
  re-center constant belongs here.

### Prior-phase posture & test standard
- `.planning/phases/12-data-safety-integrity/12-CONTEXT.md` — D-08 regression-proof
  standard (unit + component + documented iOS UAT) that D-06 mirrors, and the
  smallest-possible-hardening posture.
- `.planning/phases/09-data-integrity-restore-ux/09-CONTEXT.md` — origin of the
  "robustness over strictness, don't touch working UX" posture.

### Device UAT
- Device-UAT memory: serve the PWA over an HTTPS cloudflared tunnel
  (`--http-host-header localhost`) for iOS on-device testing (UX-01/02/04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/test/fixtures/` + `suggest.test.ts` — established small-fixture
  unit-test pattern; UX-03 assertions extend it directly.
- `wakeLock.ts` module-level state (`sentinel`, `showActive`) — the UX-02 fix reads
  the existing `showActive` flag, no new state needed.
- `config.explore.*` constants — UX-04 re-center/threshold values slot in beside
  the existing zoom-to-fit constants (single config file rule).

### Established Patterns
- Strict core/UI separation: UX-03 is entirely `packages/core` (pure,
  Node-testable); UX-01/02/04 are `packages/app` (DOM/browser/canvas).
- Never-throw / silent-fallback browser-API idiom in `wakeLock.ts` (mirrors
  `pwa/persist.ts`) — the UX-02 fix must preserve it.
- Settle-and-freeze physics (EXPL-06): nodes are frozen (`fx`/`fy`) at
  `onEngineStop`; UX-04's first-settle gate builds on this frozen invariant.
- Single config file for constants — no scattered magic numbers.

### Integration Points
- UX-01: `body` (styles.css) ↔ `AppShell` header ↔ each fixed overlay header —
  the single-inset idiom must be consistent across all top surfaces.
- UX-02: `acquireWakeLock` ↔ `releaseWakeLock` ↔ End Show teardown ↔ the
  `visibilitychange` reacquire listener (the re-check must not fight reacquire).
- UX-03: `resolvePlaceholders` output → the app's fill-hint UI → `renameEntry`
  (one-tap apply) — suppression happens in the pure function, before the UI.
- UX-04: the resize effect → `onEngineStop` → `zoomToFit` / focus-camera effect —
  the first-settle flag decouples resize from auto-fit.

</code_context>

<specifics>
## Specific Ideas

- **Never name the wrong song (UX-03):** the whole point of the fix is that a
  confident wrong fill-hint is worse than no hint. Suppress on ambiguity.
- **The camera belongs to the user (UX-04):** a resize is not a request to
  reframe. Preserve pan/zoom; only intervene (gently re-center) if the focus would
  otherwise be lost off-screen.
- **One inset, one idiom (UX-01):** the doubled inset is two idioms colliding;
  collapsing to per-surface `env()` is what stops it recurring and aligns overlays.
- **Fix the leak at the seam (UX-02):** the race is between acquire-resolve and
  release; re-checking `showActive` right where the sentinel would be stored closes
  it without new machinery.

</specifics>

<deferred>
## Deferred Ideas

None raised beyond phase scope during discussion — the phase stayed on its four
fixes.

### Reviewed Todos (not folded)
Keyword-matched Explore/UI but deliberately NOT folded — genuine v2 UI ideas that
conflict with the settle-and-freeze constraint or are out of this bug cluster's
scope:
- `2026-07-17-gizzverse-animate-directional-flow-particles-along-constella.md` —
  v2 (conflicts with settle-and-freeze).
- `2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md` — v2 UI polish.
- `2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md` — v2 UI polish.

</deferred>

---

*Phase: 13-Interface & Explore Polish*
*Context gathered: 2026-07-19*
