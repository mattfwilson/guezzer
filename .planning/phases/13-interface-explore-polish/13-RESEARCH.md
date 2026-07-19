# Phase 13: Interface & Explore Polish - Research

**Researched:** 2026-07-19
**Domain:** iOS PWA safe-area layout · Screen Wake Lock lifecycle · pure-core placeholder resolution · react-force-graph-2d camera control
**Confidence:** HIGH (all four root causes confirmed by direct code read; fixes are locked in CONTEXT.md — research de-risks planning, not the decisions)

## Summary

This is a four-fix hardening cluster, not a feature phase. Every root cause is confirmed
against the live source, and every fix approach is locked (D-01..D-06). Research value is in
three places: (1) the **UX-01 surface audit** — the codebase has **seven** top-anchored
`env(safe-area-inset-top)` surfaces, not the three named in the todo, and exactly **one** of
them (the in-flow AppShell header) is the double-inset bug; (2) a **precise, testable
algorithm** for UX-03 that fixes the off-by-N *and keeps all four existing `resolvePlaceholders`
tests green*; (3) the **first-settle / off-screen-focus** mechanics for UX-04 that decouple
resize from auto-fit with the smallest possible change, plus the residual **wake-lock
rapid-restart** edge for UX-02.

**Primary recommendation:** UX-01 is a one-line deletion (`styles.css:186`) that realigns
every overlay automatically — the six fixed overlays were *always* single-inset; only the
in-flow header was doubled. UX-03 should use **interval-count-match subsequence anchoring** in
pure core. UX-02 is the locked `showActive` re-check plus a documented accepted residual. UX-04
is a `graphData`-keyed first-settle ref gating `zoomToFit`, reusing the existing focus-camera
effect for the off-screen re-center.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (UX-01):** One idiom — per-surface `env(safe-area-inset-top)`, drop the top `body`
  padding. Remove `padding-top: env(safe-area-inset-top)` from `body` in `styles.css`; every
  top-anchored surface applies its own `env()` calc. **Planning MUST audit ALL fixed-position
  top surfaces for consistent header heights, not just the two files in the todo.** The
  left/right/bottom body insets (`styles.css:187-189`) are not part of this bug — only the top
  inset is doubled. Planning decides whether to leave the other three on `body` or move them
  too; consistency is the goal.
- **D-02 (UX-02):** Re-check `showActive` after the acquire resolves. In `acquireWakeLock`,
  after `const next = await navigator.wakeLock.request("screen")` resolves, if `showActive` is
  already `false`, release `next` immediately instead of storing it as `sentinel`. Keep the
  never-throw / silent-fallback contract intact.
- **D-03 (UX-03):** Conservative-suppress — no hint beats a wrong hint. Only offer a fill-hint
  when the placeholder's neighborhood clearly aligns with the editor sequence. When alignment
  is ambiguous, emit NO hint. The system must NEVER confidently name the wrong song; the worst
  acceptable outcome is a missing hint.
- **D-04 (UX-03):** Dependency satisfied — Phase-11 LIVE-01 `guardLatestRows` shipped (`11-02`).
  UX-03 is unblocked.
- **D-05 (UX-04):** Preserve the user's pan/zoom on resize; re-center only if the focus is
  lost. Gate `zoomToFit` behind a first-settle flag (fires ONLY on the initial engine stop per
  graph-data change, never on pure size changes). Exception: if a focused node would fall
  off-screen after the resize, smoothly re-center on that node (do NOT fit-all). Any new
  duration/threshold constants belong in `packages/app/src/config.ts` `explore` section.
- **D-06 (regression standard):** Unit (core, UX-03) + component (jsdom, UX-02) + documented
  on-device iOS Safari UAT (UX-01/02/04 via the cloudflared HTTPS tunnel).

### Claude's Discretion
- UX-01: exact per-surface `env()` calc placement and whether to also move the left/right/bottom
  body insets for consistency.
- UX-02: exact code shape of the post-acquire re-check/release.
- UX-03: the precise alignment/neighborhood-match algorithm, as long as it never names a wrong
  song and suppresses on ambiguity.
- UX-04: the first-settle flag mechanism, off-screen-detection method, and re-center
  duration/threshold constant values in config.

### Deferred Ideas (OUT OF SCOPE)
- Any new features; Gizz Bingo (Phases 14–16); UI polish beyond these four fixes.
- The two v2 Explore/UI todos that keyword-matched but were NOT folded: directional-flow
  particles and bottom-sheet up/down animation (both conflict with settle-and-freeze / carry to
  v2); app-wide "Mon D, YYYY" date format (v2 UI polish).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Notched-iPhone PWA top safe-area inset applies once; overlay headers align with the shell header | Complete 7-surface audit below: only the in-flow `AppShell` header is double-inset; deleting `styles.css:186` realigns all fixed overlays automatically |
| UX-02 | Wake lock reliably released after End Show even when release races an in-flight acquire | Exact race traced in `wakeLock.ts`; re-check placement, never-throw contract points, reacquire-listener interaction, and the residual rapid-restart edge characterized |
| UX-03 | Fill-hints name the correct song after skipped/deleted trail entries (no off-by-N) | Two independent position-numbering systems identified; interval-count-match algorithm specified that fixes off-by-N AND keeps all 4 existing `resolvePlaceholders` tests green; new fixtures enumerated |
| UX-04 | Constellation keeps the user's pan/zoom across container resizes instead of snapping to fit-all | First-settle-ref mechanism keyed on `graphData`; filters proven not to rebuild `graphData`; existing focus-camera effect identified as the off-screen re-center hook; minimal new config constant scoped |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UX-01 safe-area inset | Browser / CSS (`styles.css`, per-surface `env()` in app components) | — | Pure presentation; `env()` is a CSS/viewport concern with zero core logic |
| UX-02 wake-lock lifecycle | Browser API glue (`packages/app/src/wakeLock.ts`) | — | Screen Wake Lock is a browser API; module-level singleton state, never in core |
| UX-03 fill-hint resolution | **Pure core** (`packages/core/src/live/suggest.ts`) | App fill-hint UI → `renameEntry` (adoption only) | CLAUDE.md strict separation: the suppress decision is a pure derivation, before any UI |
| UX-04 constellation camera | App canvas layer (`ConstellationCanvas.tsx`) | Pure core supplies `{nodes,links}` (unchanged) | Camera/settle lifecycle is a react-force-graph-2d concern; graph data derivation is untouched |

## Standard Stack

No new libraries. This phase touches existing, CLAUDE.md-blessed surfaces only:

| Library | Version (installed) | Used By | Notes |
|---------|--------------------|---------|-------|
| react-force-graph-2d | 1.29.1 | UX-04 | Existing `zoomToFit`, `d3ReheatSimulation`, `onEngineStop`, `centerAt`, `zoom`, `graph2ScreenCoords` API — no version change |
| Vitest | 4.1.10 | UX-02, UX-03 tests | `projects` config already splits core(node)/app(jsdom) |
| React | 19.2.7 | UX-04 refs/effects | `useRef` first-settle flag |

**No packages are installed, added, or upgraded in this phase.**

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All four fixes edit existing files
(`styles.css`, `wakeLock.ts`, `suggest.ts`, `ConstellationCanvas.tsx`, `config.ts`) and their
tests. No `npm install` occurs, so the slopcheck / registry-verification gate does not apply.

---

## UX-01 — Safe-Area Inset: Complete Surface Audit

### The bug, precisely
- `body` (`styles.css:186`) applies `padding-top: env(safe-area-inset-top)`. Body is the normal
  flow container.
- The `AppShell` header (`AppShell.tsx:41`) is **in-flow inside body**, so it inherits body's
  top padding AND re-adds its own `paddingTop: calc(env(safe-area-inset-top) + 12px)`. Result:
  a doubled `~2·env + 12px` dead band above "Guezzer" under `viewport-fit=cover`.
- Every **`fixed inset-0`** overlay is positioned against the **viewport**, not body's padded
  content box, so it never receives body's padding — it is single-inset. That is why overlay
  headers sit ~`env` **higher** than the shell header today.

### Complete audit of top-anchored `env(safe-area-inset-top)` surfaces
`[VERIFIED: grep of packages/app/src, 2026-07-19]`

| # | Surface | Location | Positioning | Top calc | Status |
|---|---------|----------|-------------|----------|--------|
| 1 | AppShell header | `components/AppShell.tsx:41` | **in-flow (inside body)** | `env + 12px` | **DOUBLE — the bug** |
| 2 | SearchSheet | `show/SearchSheet.tsx:105` | `fixed inset-0` | `env + 12px` | single (named in todo) |
| 3 | ArchiveBrowser | `dex/ArchiveBrowser.tsx:256` | `fixed inset-0` | `env + 12px` | single (named in todo) |
| 4 | RecapView | `dex/RecapView.tsx:162` | `fixed inset-0` | **`env + 24px`** | single (named in todo) — **inconsistent value** |
| 5 | AlbumDetail | `dex/AlbumDetail.tsx:53` | `fixed inset-0` | `env + 12px` | single — **NOT named in todo/CONTEXT** |
| 6 | CompareView | `dex/CompareView.tsx:57` | `fixed` header block | `env + 12px` | single — **NOT named in todo/CONTEXT** |
| 7 | SetlistView | `dex/SetlistView.tsx:136` | `fixed inset-0` | `env + 12px` | single — **NOT named in todo/CONTEXT** |
| — | OrbFitHarness | `dev/OrbFitHarness.tsx:147` | `sticky top-0` | none | **DEV throwaway, out of scope** (remove post-phase) |
| — | NodeSheet | `explore/NodeSheet.tsx:153` | `fixed bottom-0` | bottom only | not a top surface |

**The completeness finding D-01 demanded:** the todo/CONTEXT name three overlays (SearchSheet,
ArchiveBrowser, RecapView), but **AlbumDetail, CompareView, and SetlistView are equally
top-anchored fixed overlays**. Planning must list all six overlays + the header when reasoning
about header-height consistency.

### What actually changes
- **The fix is a single deletion:** remove `padding-top: env(safe-area-inset-top)` at
  `styles.css:186`. Because all six overlays were always single-inset, deleting the body top
  pad makes the shell header single-inset too, and every header lands at the same `env + 12px` —
  **they align automatically with no overlay edits.**
- **Consistency flag (RecapView `+24px`):** RecapView uses `+24px`, so after the fix its header
  content sits 12px lower than the other six. This is pre-existing and may be intentional
  breathing room (RecapView has no menu button, different layout). Planning decides: normalize
  to `+12px` for strict consistency, or leave `+24px` as a deliberate exception and document it.
  *Do not silently normalize without a decision — it changes recap layout.*

### Latent same-class doubles (NOT the reported bug — flag, likely leave)
- **Bottom:** `body` has `padding-bottom: env(safe-area-inset-bottom)` while `<main>`
  (`AppShell.tsx:63`) adds its own `calc(4rem + env(safe-area-inset-bottom) + overlayInset)` and
  the fixed `BottomTabBar` already includes `env`. The body bottom pad over-reserves by `env`,
  but the fixed tab bar covers that strip — no visible dead band. Leave per posture.
- **Left/right:** `body` L/R insets inset the in-flow header from screen edges (landscape
  notch), while `fixed inset-0` overlays extend edge-to-edge. A symmetric latent inconsistency,
  landscape-only, in a portrait-first one-thumb app. Moving all four insets off body to
  per-surface calc is the "one idiom" end-state D-01 gestures at, but it **enlarges the blast
  radius** (must re-add L/R/bottom to `<main>` and verify every overlay) and risks the posture.

**Recommendation:** ship the **minimal top-only deletion** (fixes the reported doubled inset +
overlay misalignment), decide RecapView's `+24px`, and treat the full four-inset "one idiom"
migration as optional discretion with explicit added-risk notes. `[VERIFIED: code read] [ASSUMED:
posture recommendation]`

---

## UX-02 — Wake-Lock Acquire/Release Race

### The race, traced (`packages/app/src/wakeLock.ts`)
`[VERIFIED: code read]`
1. `acquireWakeLock` sets `showActive = true`, then `await navigator.wakeLock.request("screen")`
   is **in flight** — `sentinel` is still `null` (:50).
2. End Show → `releaseWakeLock` runs: `showActive = false`, `held = sentinel = null` → early
   `return` (no-op, :78).
3. The request resolves: `next.released` is `false` (a live lock), so control reaches
   `sentinel = next` (:62). Now `showActive` is `false` but a live lock is stored that nothing
   will release. Screen stays awake until the app backgrounds.

### The fix (D-02) and its exact contract points
Insert the re-check **immediately after** the `await` (:50), **before** the `next.released`
check (:54):

```
const next = await navigator.wakeLock.request("screen");
if (!showActive) {                 // End Show fired during the in-flight request
  try { await next.release(); } catch { /* best-effort, swallow */ }
  return;                          // do NOT store sentinel, do NOT call onUnsupported
}
if (next.released) { onUnsupported(); return; }
...
sentinel = next;
```

Contract points that MUST hold (`[VERIFIED: reading the module's stated contract, lines 1-19,
63-66, 79-83]`):
- **Never-throw:** the new `next.release()` is wrapped in `try/catch` and swallows — identical
  to `releaseWakeLock` (:79-83).
- **No false "unsupported" notice:** the End-Show path must **not** call `onUnsupportedCb`. End
  Show is a normal teardown, not an unsupported device; calling it would wrongly surface
  `config.copy.show.wakeLockFallback`.
- **No sentinel stored:** return before `sentinel = next`, so the reacquire listener's
  `sentinel === null` guard stays true (harmless — see below).

### Interaction with the `visibilitychange` reacquire listener
`[VERIFIED: code read, bindVisibilityReacquire :91-105]` The reacquire fires only when
`document.visibilityState === "visible" && sentinel === null && showActive && onUnsupportedCb`.
After End Show `showActive` is `false`, so **reacquire cannot fire post-End-Show** — the D-02
re-check does not fight the reacquire path. Confirmed safe.

### Residual edge planning must consciously accept (or trivially harden)
**Rapid End-Show → Start-Show while an old acquire is in flight.** `showActive` is a boolean and
cannot distinguish "still show 1" from "now show 2":
1. Show 1 acquire in flight → End Show 1 (`showActive=false`) → Start Show 2 (`showActive=true`,
   new acquire in flight).
2. Show 1's request resolves → re-check sees `showActive === true` → stores show-1's lock as
   `sentinel`. Show 2's request then overwrites `sentinel` with show-2's lock; show-1's lock is
   orphaned (its `release` listener only nulls `sentinel` if `sentinel === next`, but it's now
   show-2's) and leaks until backgrounding.

This is the **same symptom class**, at LOW severity, and D-02's boolean re-check does not close
it. Options for planning:
- **Accept & document** (matches "smallest possible hardening"): the practical window is tiny
  and the orphan clears on next background.
- **Trivial epoch token** (optional completeness): a module-level monotonic `epoch` incremented
  each `acquireWakeLock`; capture `const myEpoch = ++epoch` before the `await`, and after it only
  store `sentinel = next` if `epoch === myEpoch` (else release). This closes both the End-Show
  race and the rapid-restart leak with ~3 lines. Recommend flagging as a discretion upgrade;
  do not silently expand scope beyond D-02 without noting it. `[ASSUMED: recommendation]`

---

## UX-03 — Fill-Hint Off-by-N: Two Numbering Systems

### Root cause (`packages/core/src/live/suggest.ts:144-161`)
`[VERIFIED: code read]` `resolvePlaceholders` matches a trail placeholder to an editor row by
raw equality: `latestRows.find((row) => row.position === entry.position)` (:151). But
`entry.position` and `row.position` are **two independent coordinate systems**:

| System | Source | Semantics |
|--------|--------|-----------|
| Trail `TrackedEntry.position` | `db.ts:325-334` (`logSong`/`adoptSuggestion`, `nextPosition = (existing.at(-1)?.position ?? 0) + 1`) | **Monotonic max+1, sort-only.** Survives mid-trail deletes → **gaps by design** (`db.ts:92-94, 371`). |
| Editor `LatestSetlistRow.position` | kglw.net `latest` payload | **Contiguous setlist order** (1,2,3,…). |

They coincide only for a gap-free trail that started aligned with editor position 1. After the
user **skips** an unlogged song or **deletes** a mid-trail entry, the two diverge and raw `===`
resolves a placeholder to the wrong editor row → a confident off-by-N name that one tap applies
via `renameEntry`.

### Recommended algorithm: interval-count-match (subsequence anchoring)
`[ASSUMED: algorithm design — satisfies D-03 conservative-suppress; verified by hand against all
existing tests below]`

1. Sort trail by `position`; sort editor rows by `position`.
2. **Anchors** = logged trail entries (`!isPlaceholder && songId !== null`). Match each anchor
   to its editor row **by `songId`**, recording the editor index. Require the anchors to form a
   **strictly increasing in-order subsequence** of editor rows. Any anchor absent from editor,
   or out of order, marks its bounding interval(s) ambiguous.
3. **Partition** both sequences into intervals bounded by consecutive anchors — including the
   **head** interval (before the first anchor) and the **tail** interval (after the last).
4. **Per interval:** if `#placeholder-trail-slots === #editor-rows-in-interval`, map them 1:1 in
   order → emit `FillHint`s. Otherwise **suppress** that interval (emit nothing). Any
   out-of-order / missing anchor → suppress the affected interval(s) (simplest safe fallback:
   suppress everything).

**Why this shape:** it resolves a placeholder only when the surrounding logged songs *uniquely
bracket* exactly the right number of editor rows — never guessing across a count mismatch.

### It fixes the bug AND keeps all four existing tests green
Hand-verified against `packages/core/test/suggest.test.ts:177-216`:

| Existing test | Trail | Editor | Interval logic | Result | Matches current expectation? |
|---------------|-------|--------|----------------|--------|------------------------------|
| :183 leading placeholder + logged B | `[ph, B(200)]` | `A(1),B(2)` | head interval before anchor B: 1 ph vs 1 row (A) → 1==1 | hint A | ✅ `[100]` |
| :198 placeholder pos 9, editor 1-2 | `[ph]` | `A,B` | whole trail one interval: 1 ph vs 2 rows → 1≠2 | suppress | ✅ `[]` |
| :203 non-placeholder only | `[named]` | `A,B` | no placeholders | `[]` | ✅ `[]` |
| :208 two placeholders | `[ph,ph]` | `A,B` | whole trail: 2 ph vs 2 rows → 2==2 | A,B | ✅ `[100,200]` |

### New regression fixtures to add (extend `suggest.test.ts`)
- **Deleted mid-trail entry (position gap):** trail positions `1,3,4` with a placeholder among
  them → correct bracketed hint, never off-by-N.
- **Skipped song:** trail `A(logged), ph, C(logged)`; editor `A,B,C` → placeholder resolves to
  **B**, NOT C.
- **Ambiguous (count mismatch):** two editor rows between anchors, one placeholder → **suppress**.
- **Logged trail song absent-from-editor / out-of-order:** → **suppress** the affected interval.
- **Trailing placeholder with multiple tail editor rows:** → **suppress**.
- **Regression:** contiguous gap-free trail still resolves (the `:208`-style case).

### FillHint field semantics to preserve (integration point)
`FillHint` (:83-88) carries `entryPosition` (the placeholder's trail position — the UI's handle
for `renameEntry`) and `position/songId/songName` (from the matched editor row). Under the new
algorithm, keep `entryPosition = placeholder.position` and take the song fields from the
**bracketed** editor row (no longer the raw same-position row). Confirm the app's fill-hint UI
targets the entry by `entryPosition` (or entry id) — not by editor position — when adopting via
`renameEntry`. `[VERIFIED: FillHint shape; integration point noted in CONTEXT code_context]`

---

## UX-04 — Constellation Camera on Resize

### The reheat → re-fit loop (`ConstellationCanvas.tsx`)
`[VERIFIED: code read]`
- The spacing effect (`:221-233`) is keyed on `[graphData, size.width, size.height]` and calls
  `fg.d3ReheatSimulation()` (:232). With frozen `fx/fy` (pinned at `onEngineStop`) the reheat is
  visually inert but still runs `cooldownTicks` and **re-fires `onEngineStop`**.
- `onEngineStop` (`:695-714`) **unconditionally** calls `fgRef.current?.zoomToFit(...)` (:707).
- So any container resize (iOS address-bar collapse on scroll, orientation, keyboard) reheats →
  re-fires `onEngineStop` → yanks the camera to fit-all mid-exploration.

### The fix (D-05): first-settle flag keyed on `graphData`
`[ASSUMED: mechanism — matches D-05; verified against the memoization invariants below]`
- Add a `useRef(true)` first-settle flag. Reset it to `true` in a `useEffect` keyed on
  `[graphData]`. In `onEngineStop`, still pin `fx/fy` every time (the settle-and-freeze
  invariant EXPL-06), but call `zoomToFit` **only if the flag is `true`**, then set it `false`.
- **Pure size changes** → flag already `false` (from the prior settle) → reheat still fires but
  `zoomToFit` is skipped → the user's exact pan/zoom is preserved.
- **Effect timing is safe:** `onEngineStop` fires asynchronously after `cooldownTicks`, long
  after the `[graphData]` reset effect runs, so the flag is reliably `true` before the first
  post-change settle.

### Why `graphData` is the correct key (filters must NOT re-fit)
`[VERIFIED: memo comments :253-259, :239-246]` Toggling the edge-declutter slider (`topK`),
`overlay`, or `visibleNodeIds` recomputes only derived Sets — "the node objects and their frozen
fx/fy are never rebuilt, so the sim never reheats." Only a genuine **view change (Rotation ↔ Full
catalog)** rebuilds `graphData`, which *legitimately* should re-fit. So first-settle-per-
`graphData` re-fits exactly when it should and never on filters or resizes.

### Off-screen focus re-center (the D-05 exception)
`[VERIFIED: focus-camera effect :325-348]` A focus-camera effect already frames the focused node
via `fg.zoom(k, ms)` + `fg.centerAt(node.x, node.y + offset, ms)`, keyed on
`[focusId, graphData, size.height, visibleViewportHeight]` — note it **excludes `size.width`**.
To satisfy "re-center only if the focused node would fall off-screen after the resize":
- **Add `size.width` to that effect's deps** so a width-changing resize re-evaluates.
- **Gate the re-center on an actual off-screen test** so a resize does NOT reframe a focus that
  is still visible (preserve the camera). Use `fg.graph2ScreenCoords(node.x, node.y)` and check
  against `[0..size.width] × [0..size.height]` minus a margin; only re-center when the node is
  outside. `[ASSUMED: API — react-force-graph-2d exposes graph2ScreenCoords; verify on the
  installed 1.29.1 build]`
- Prefer **pan-only** re-center (keep the current zoom `k`) as the smallest intervention, rather
  than re-zooming to `FOCUS_ZOOM_K`.

### New config constants (`config.explore`, app-side, keep minimal)
- Reuse `FOCUS_CAMERA_DURATION_MS` for the re-center ease (no new duration constant needed).
- Add **one** threshold: `FOCUS_OFFSCREEN_MARGIN_PX` — how far past the viewport edge (in screen
  px) a focused node must be before re-centering (avoids re-centering a node grazing the edge).
  Tag `[ASSUMED]` and device-tune, consistent with the other `explore` render constants.
- Do **not** add a re-zoom constant unless planning chooses to re-zoom rather than pan.

`[ASSUMED: constant set — respects the single-config-file rule and the smallest-hardening posture]`

## Runtime State Inventory

Not a rename/refactor/migration phase — the four fixes edit code and one CSS line; none rewrites
a stored key, service config, OS registration, secret, or build artifact.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — UX-03 changes a *pure derivation* over the trail; `TrackedEntry.position` semantics are unchanged (still monotonic max+1). No stored records are rewritten or re-keyed. | none |
| Live service config | None — no external service touched. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None. | none |
| Build artifacts | None — no package rename, no new dependency, no artifact regeneration. | none |

## Common Pitfalls

### Pitfall 1: Editing overlay `env()` calcs for UX-01 (unnecessary churn)
**What goes wrong:** planning "fixes" all six overlays by touching each `paddingTop`.
**Why it happens:** the todo names three overlays, implying they're broken.
**How to avoid:** the overlays are already single-inset and correct; only `styles.css:186` needs
deletion. Touching overlays risks introducing a NEW inconsistency. The only overlay *decision*
is RecapView's `+24px` normalization (a judgment call, not a bug).

### Pitfall 2: Calling `onUnsupported` on the UX-02 End-Show release path
**What goes wrong:** the re-check releases the late lock but also surfaces the wake-lock fallback
notice, confusing the user at End Show.
**How to avoid:** the End-Show branch returns silently — no `onUnsupportedCb`. Only genuine
absence/rejection/false-positive calls it.

### Pitfall 3: A UX-03 algorithm that breaks the all-placeholder test
**What goes wrong:** a naive "anchor on surrounding logged songs" rule suppresses the
`[ph, ph]` / `[ph]`-leading cases that existing tests expect to resolve.
**How to avoid:** use interval-count-match with **head and tail intervals** and count-equality
(not "must have a logged anchor on both sides"). Verified to keep all four existing tests green.

### Pitfall 4: UX-04 first-settle flag keyed on the wrong dependency
**What goes wrong:** keying the reset on `[size]` or a filter dep re-fits on every resize/filter;
keying on nothing never re-fits after a view change.
**How to avoid:** key the reset strictly on `[graphData]` — the only thing that legitimately
warrants a fresh fit. Filters provably don't rebuild `graphData`.

### Pitfall 5: Re-centering a still-visible focused node on resize (UX-04)
**What goes wrong:** adding `size.width` to the focus effect without an off-screen gate re-frames
the focus on every resize, fighting the user's camera — the very thing UX-04 fixes.
**How to avoid:** gate the re-center on an actual `graph2ScreenCoords` off-screen test; no-op
when the node is still on screen.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`test.projects`: core→`node`, app→`jsdom`) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run suggest` (UX-03) · `npx vitest run wakeLock` (UX-02) |
| Full suite command | `npm test` (= `vitest run`, both projects) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File | Exists? |
|-----|----------|-----------|---------|------|---------|
| UX-03 | Position-gap trail yields NO wrong-song hint; aligned neighborhood yields correct hint; existing cases still pass | unit (pure core, node) | `npx vitest run suggest` | `packages/core/test/suggest.test.ts` (extend `resolvePlaceholders` block) | ✅ extend |
| UX-02 | `releaseWakeLock` during an in-flight `request("screen")` leaves nothing held (late sentinel released, not stored) | component/unit (jsdom) | `npx vitest run wakeLock` | `packages/app/test/wakeLock.test.ts` (extend) | ✅ extend |
| UX-01 | Single top inset; overlay headers aligned with shell header on a notched iPhone standalone | manual — on-device iOS Safari UAT | cloudflared HTTPS tunnel (`--http-host-header localhost`) | UAT item | ❌ document |
| UX-04 | Camera survives address-bar collapse / orientation; re-centers only when focus lost off-screen | manual — on-device iOS Safari UAT | same tunnel | UAT item | ❌ document |
| UX-02 | Screen actually sleeps after End Show | manual — on-device confirm | same tunnel | UAT item | ❌ document |

### Observable signals that prove each fix
- **UX-03 (automated):** new fixtures — a trail with a deleted-entry gap and a skipped-song gap
  produce either the *correct bracketed* hint or *no* hint, **never** an off-by-N songId; all
  four pre-existing `resolvePlaceholders` assertions stay green.
- **UX-02 (automated):** using the existing deferred-request mock idiom
  (`packages/app/test/wakeLock.test.ts:12-34`, `liveSentinel().release` is a `vi.fn()`), resolve
  the `request("screen")` promise **after** `releaseWakeLock` runs; assert the late sentinel's
  `release()` spy was called and the module never retained it (a subsequent `releaseWakeLock` is
  a no-op / the mock's release fired exactly once from the re-check).
- **UX-01 (device):** on a notched iPhone installed PWA, a single ~`env` inset above the header;
  header content vertically aligned across shell / SearchSheet / ArchiveBrowser / RecapView /
  AlbumDetail / CompareView / SetlistView (subject to the RecapView `+24px` decision).
- **UX-04 (device):** scroll to collapse the address bar / rotate while panned-zoomed into the
  constellation — the camera stays put; drive a focused node off-screen via resize — it smoothly
  re-centers (does not fit-all).

### Sampling Rate
- **Per task commit:** `npx vitest run suggest` (UX-03 tasks) / `npx vitest run wakeLock` (UX-02).
- **Per wave merge:** `npm test` (full suite, both projects green).
- **Phase gate:** full suite green + the three documented iOS UAT items recorded before
  `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] None — both target test files already exist (`packages/core/test/suggest.test.ts`,
  `packages/app/test/wakeLock.test.ts`); this phase **extends** them. The jsdom setup
  (`packages/app/test/setup.ts`) and the deferred-request/`vi.resetModules` mock idiom are in
  place. No new framework, config, or fixture scaffolding required.

## Environment Availability

Code/CSS-only changes plus on-device UAT. No new runtime tools.

| Dependency | Required By | Available | Notes / Fallback |
|------------|------------|-----------|------------------|
| Node ≥ 24.12 + Vitest 4.1.10 | UX-02/03 automated tests | ✓ (existing toolchain) | — |
| cloudflared HTTPS tunnel | UX-01/02/04 iOS UAT | per device-UAT memory | `--http-host-header localhost`; workbox `clientsClaim=true` already set for offline first-load (see MEMORY) |
| Notched iPhone in installed-PWA / standalone mode | UX-01/02/04 UAT | user-provided (owner's iPhone 16 Pro per device spike) | no automated substitute for `viewport-fit=cover` + notch behavior |

**No blocking gaps.** The only non-automatable validations (UX-01/04, and the UX-02 device
confirm) are covered by the documented iOS UAT, exactly as D-06 specifies.

## Security Domain

`security_enforcement` is unset (treated as enabled), but this is a pure UI/model-polish phase
with **no new attack surface**: no auth, no network endpoints added, no crypto, no untrusted
input parsing beyond what already exists.

| ASVS Category | Applies | Standard Control (existing, unchanged) |
|---------------|---------|-----------------------------------------|
| V5 Input Validation / Output Encoding | tangentially | UX-03 improves *data integrity* (never applies a wrong song); kglw-derived song names already render as escaped React text / canvas `fillText`, never HTML |
| V7 Error Handling & Logging | yes | UX-02 preserves the never-throw / silent-fallback contract on the Wake Lock browser API (module docstring cites ASVS V7) |
| V2/V3/V4/V6 (Auth/Session/Access/Crypto) | no | personal, no-backend, no-accounts app — none in scope |

No threat-model changes; no new dependencies to audit.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Deleting only `styles.css:186` (top inset) fully realigns all overlays because fixed overlays never received body padding | UX-01 | LOW — verified by positioning semantics; device UAT confirms |
| A2 | Interval-count-match is the right conservative-suppress shape and keeps all 4 existing tests green | UX-03 | LOW — hand-verified against each existing test |
| A3 | Filters (`topK`/`overlay`/`visibleNodeIds`) never rebuild `graphData`, so `[graphData]`-keyed first-settle re-fits only on view change | UX-04 | LOW — asserted by the memo comments; confirm at implementation |
| A4 | `react-force-graph-2d` 1.29.1 exposes `graph2ScreenCoords` for off-screen detection | UX-04 | MEDIUM — verify against the installed build; fallback: compute screen coords from `fg.zoom()`/`fg.centerAt()` state |
| A5 | Rapid End-Show→Start-Show wake-lock leak is an accepted LOW residual (D-02 boolean re-check doesn't close it); epoch token is optional | UX-02 | LOW — symptom clears on background; planning may accept or add the token |
| A6 | RecapView's `+24px` is intentional breathing room, not a bug | UX-01 | LOW — planning decides; normalizing changes recap layout |
| A7 | `FOCUS_OFFSCREEN_MARGIN_PX` is the only genuinely new config constant needed (re-center reuses `FOCUS_CAMERA_DURATION_MS`, pans at current zoom) | UX-04 | LOW — value is device-tunable like its `explore` peers |

## Open Questions

1. **RecapView `+24px` normalization** — leave as deliberate exception or normalize to `+12px`?
   - Known: it will sit 12px lower than the other six headers after the fix.
   - Recommendation: leave `+24px` and add a one-line comment marking it intentional, unless the
     owner wants pixel-identical headers.
2. **UX-02 rapid-restart residual** — accept & document, or add the 3-line epoch token?
   - Recommendation: accept for the smallest-hardening posture; note the token as a cheap upgrade
     if planning wants zero residual.
3. **UX-04 re-center: pan-only vs re-zoom** — preserve the user's zoom on re-center, or snap to
   `FOCUS_ZOOM_K`?
   - Recommendation: pan-only (smallest intervention; the camera belongs to the user).

## Sources

### Primary (HIGH confidence — direct code read, 2026-07-19)
- `packages/app/src/styles.css:173-190` — body `env()` inset block.
- `packages/app/src/components/AppShell.tsx` — in-flow header double-inset.
- `packages/app/src/{show/SearchSheet,dex/ArchiveBrowser,dex/RecapView,dex/AlbumDetail,dex/CompareView,dex/SetlistView}.tsx` — six fixed top overlays (grep-verified).
- `packages/app/src/wakeLock.ts` (full) — acquire/release race + reacquire listener.
- `packages/core/src/live/suggest.ts:144-161` (+ `FillHint` :83-88) — `resolvePlaceholders` bug.
- `packages/app/src/db/db.ts:92-94, 311-345, 371, 406-434` — trail `position` monotonic max+1 / gaps.
- `packages/app/src/explore/ConstellationCanvas.tsx:176, 200-233, 239-259, 321-348, 690-714` — resize effect, memo invariants, focus-camera effect, `onEngineStop` `zoomToFit`.
- `packages/app/src/config.ts:389-505` — `explore` constants (existing zoom/focus values).
- `packages/core/test/suggest.test.ts` + `packages/app/test/wakeLock.test.ts` + `vitest.config.ts` — test idioms and projects config.
- `.planning/phases/13-interface-explore-polish/13-CONTEXT.md` — locked decisions D-01..D-06.
- `.planning/REQUIREMENTS.md:31-34` — UX-01..04 authoritative text.
- Four bug-hunt todos in `.planning/todos/pending/` — confirmed root causes.

### Secondary (MEDIUM)
- `react-force-graph-2d` `graph2ScreenCoords` availability (A4) — verify against installed 1.29.1.

## Metadata

**Confidence breakdown:**
- UX-01 surface audit: HIGH — grep + positioning semantics fully enumerate all seven surfaces.
- UX-02 race & contract: HIGH — traced line-by-line; residual edge explicitly characterized.
- UX-03 algorithm: HIGH on correctness/test-compat (hand-verified); MEDIUM on being the *chosen*
  shape (D-03 leaves the algorithm to discretion — this is a strong recommendation, not a lock).
- UX-04 mechanism: HIGH on the reheat/settle diagnosis; MEDIUM on `graph2ScreenCoords` API (A4).
- Validation architecture: HIGH — both test files and the mock idioms already exist.

**Research date:** 2026-07-19
**Valid until:** ~2026-08-18 (stable internal code; only the `react-force-graph-2d` API check
(A4) could shift, and only on a dependency bump — none planned this phase).
