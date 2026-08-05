---
phase: 21-layout-layering-foundations
verified: 2026-08-05T05:06:41Z
status: passed
score: 5/5 must-haves accounted for (4 verified, 1 accepted under a recorded override)
overrides_applied: 1
overrides:
  - must_have: "a two-device test across different app builds shows a friend on an older build with a correct, readable activity label (NAV-03)"
    reason: "Owner-approved time-box before the Aug 2026 shows. Mechanism is delivered and unit-covered; the harness cost (two worktrees, two builds, two tunnels, two devices, two identities) is not justified pre-show. Tracked as the phase's named residual gap in 21-HUMAN-UAT.md and in REQUIREMENTS.md, which correctly still reads NAV-03 Pending. T-21-38 risk accepted, not eliminated."
    accepted_by: "mattfwilson"
    accepted_at: "2026-08-05T05:06:41Z"
resolved_since_verification:
  - finding: "WR-02 — ArchiveBrowser's scroll list composed no bottom inset, putting its last row and the fallback-search button under the home indicator on an installed instance."
    resolution: "Fixed in commit `61e0b90`: the list container composes `--gz-sheet-pad-bottom` (D-07 — the browser is `fixed inset-0` at `z.sheet` and COVERS the tab bar, so it must not compose from `--gz-chrome-reserve`). Two positive assertions added in `archiveBrowser.test.tsx`, which the pattern-matching FOUND-02 guard structurally cannot express. Full suite green at 1137 tests."
    human_item_closed: 3
human_verification:
  - test: "NAV-03 mixed-build presence, two devices on DIFFERENT builds, both directions. Old build (base `e92d4a8` = `1cc5787^`) on device A, current build on device B, both signed in, both over HTTPS tunnels. Record the exact observed activity label text in each direction, the `At a show 🎸` precedence case, and the background→idle→foreground recovery."
    expected: "Each device shows the other a correct, readable activity label — never a blank slot, never a raw wire token. Device B (new) should read device A's `GizzDex` as 'on GizzDex'; device A (old, pre-`GizzSched`) meeting the newer `GizzSched` token should render the constant fallback, not blank."
    why_human: "Requires two physical devices on two simultaneously-served production builds over live Supabase Realtime with a genuinely mixed token vocabulary. Label resolution is receiver-side, so the failure mode is silent — the sender sees nothing wrong. jsdom cannot exercise a real socket, and `presenceLabels.test.ts` proves the label MECHANISM, not live behaviour. Same class of gap as quick tasks `260724-hqu` / `260724-lgo`, where a unit-proven realtime path was not a verified one."
  - test: "Two bottom overlays visible simultaneously (CR-01). In a browser tab on a freshly bumped build, trigger the SW update while the InstallBanner is armed; separately, mid-show, trigger a BingoCelebration mark toast while a WaveToast is draining."
    expected: "Both overlays are legible and both sets of controls are tappable."
    why_human: "All five overlays are pinned to the same `bottom: var(--gz-chrome-reserve)` at the same `z.toast` tier with no mutual layout, so paint order falls back to DOM order in App.tsx. Needs a real compositor and a real SW update cycle. Pre-existing (the surfaces shared the `bottom-16` anchor before this phase too) and captured in `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md` — surfaced here so the deferral is a decision, not an oversight."
  - test: "ArchiveBrowser list scrolled to the very bottom on an INSTALLED instance (WR-02). Open the archive browser, scroll the show list to its end."
    expected: "The last show row and the 'Search kglw.net for newer shows' button clear the home-indicator swipe zone."
    why_human: "Requires a non-zero `env(safe-area-inset-bottom)`, i.e. an installed standalone instance. UAT test 1's session-#3 scrolled-to-end check covered the Me (GizzDex) tab, not this sheet. `ArchiveBrowser.tsx:334`'s scroll container composes no bottom inset at all — the D-12 guard cannot catch an OMITTED inset, only a hand-written one."
deferred: []
---

# Phase 21: Layout & Layering Foundations — Verification Report

**Phase Goal:** The app's bottom-space and layering arithmetic has exactly one owner, the installed PWA has no dead bottom gap, calendar dates read the same everywhere, and the bottom tabs carry their short names — so every later v2.1 surface is built on settled ground instead of rewriting it.

**Verified:** 2026-08-05T05:06:41Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, merged with PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On an **installed** home-screen PWA, body content sits flush against the top of the bottom tab bar with no dead gap — measured on-device before and after, portrait **and** landscape (FOUND-01) | ✓ VERIFIED | Code: `styles.css` body block carries **no** `padding-bottom` (lines 247-250 name its removal); `--gz-safe-bottom: env(safe-area-inset-bottom)` declared exactly once in `:root` (line 33). `AppShell.tsx:87-88` reserves `var(--gz-content-reserve)` / `var(--gz-chrome-reserve)`; `BottomTabBar.tsx:42-43` reads the **same** `--gz-chrome-reserve`. Device: session-#2 measured before/after on iPhone 16 Pro / iOS 26.5.2, installed standalone (`nav=true mq=true`), **both orientations**, `sab` non-zero (34/20) — `GAP` 35→1 portrait, 21→1 landscape, residual 1px = the `<nav>` `border-t`. Controlled: `sab` and `tabTop` byte-identical before vs after within each orientation; change magnitude equals `sab` independently in each (the D-15 signature). Screenshots in `evidence/`. Session-#3's `GAP:1` was correctly **rejected** as corroboration (arithmetically the `sab:0` Safari context) — closure rests on session #2 alone, which is sufficient. Tests: `bottomSpace.test.ts` CONFIRMATION-BRANCH assertions (raw bottom `env()` occurs exactly once; body carries no bottom inset; no fabricated D-19 claim). |
| 2 | Every bottom-anchored surface — tab bar, FAB, FAB scrim, toasts, peek strip, suggestion strip — sits at the correct offset in a browser tab **and** an installed instance, and a search for the tab-bar height returns exactly one owner (FOUND-02) | ✓ VERIFIED (with reservations) | Single owner exists and is substantive: `layout/bottomSpace.ts` (137 lines) composes six vars from `config.ui.bottomSpace`, written to `document.documentElement` in a **layout** effect. Repo-wide grep confirms `4rem`/`64px`/`bottom-16`/`h-16`/`inset-y-16` survive **only** in comments and the `dev/` harnesses; raw `env(safe-area-inset-bottom)` appears in exactly one production site (`styles.css:33`). All named surfaces wired: tab bar (`BottomTabBar.tsx:42`), FAB + weak-fan hint (`fabLayout.ts:30-34` → `--gz-fab-offset`, consumed by `FabMenu.tsx:124` and `OrbitStage.tsx:343`), Explore FAB (`ExploreFilterFab.tsx:85`), all five toasts (`InstallBanner:107`, `UpdateToast:48`, `BackupToast:85`, `BingoCelebration:219`, `WaveToast:175`), sheets (`Sheet.tsx:110`, `ArchiveBrowser:411`, `CometTrail:232`, `RecapView:450`, `NodeSheet:190`). Peek strip + MapView carry their D-10/D-08 exemptions **in their own source**, as the plan required. D-12 source guard is real, non-vacuous (asserts >100 files scanned, names two known files, refuses `dist/`) and carries five self-tests proving it can fail. Device: UAT test 2 PASS for **all five** overlays on an installed instance, session #3. See ⚠ WR-01 / CR-01 / WR-02 below. |
| 3 | An automated layer-ordering test fails if any surface can paint over an open **modal** sheet, written against the current tier ordering; the non-modal `focusedFab` exception survives; no tier renumbered without a device repro (FOUND-03) | ✓ VERIFIED | `test/layerOrder.test.tsx` (911 lines) exports `createsStackingContext` + `ancestorsUpToBody`, walks every ancestor up to `document.body` for the real rendered surfaces, and discovers modals via `aria-modal` rather than a hand-list (line 532). Anti-vacuity is explicit: the shipped `DexView` wrapper is asserted inert **and** an armed variant is asserted to trip the detector (line 567). `focusedFab: 60 > sheet: 50` is asserted so nobody "fixes" it (line 764); `NodeSheet` is excluded by declaring `aria-modal={false}`, not by a list (line 728). `page < sheetScrim` and `fabScrim < fab` are named numeric assertions (lines 774, 782). Portal source-scan closes D-24 (line 890). Nothing renumbered: `21-12` commit `363b42c` states "config.ts untouched", confirmed. Six surfaces verified portaling to `document.body` in source: Sheet, SearchSheet, FabMenu, AlbumDetail, ArchiveBrowser, SetlistView (both return paths), NodeSheet. Ran clean: 109 tests across the six phase test files. See ⚠ WR-09 below. |
| 4 | Every full calendar date — ShowView header, ShowsList, SetlistView, ArchiveBrowser, RecapView subline — **and** the share-card PNG read "Mon D, YYYY" from one shared UTC-safe helper, PNG verified on-device at the widest realistic venue name (FOUND-04, FOUND-05) | ✓ VERIFIED (with a scope caveat) | One owner: `dex/formatDate.ts`, both formats module-scope `Intl.DateTimeFormat` pinned `timeZone: "UTC"`, never-throw (returns raw input on unparseable). **Behavioural spot-check executed by this verifier**: `formatFullDate('2026-08-15')` → `Aug 15, 2026`; under `TZ=America/New_York`, `formatFullDate('2026-01-01')` → `Jan 1, 2026` (the exact off-by-one-day hazard the pin exists to prevent, confirmed live, not just asserted); `''` → `''` byte-identical; `'not-a-date'` → `'not-a-date'`. All five named surfaces call it — `ShowView.tsx:517`, `ShowsList.tsx:235`, `SetlistView.tsx:154,173` (visible + `aria-label`), `ArchiveBrowser.tsx:234,276` (visible + unmark-confirm `aria-label`), `RecapView.tsx:223`. Repo grep finds **zero** other date-formatting paths (`toLocaleDateString`/`DateTimeFormat`/`toDateString`) outside this module. Share card: `shareCard.ts:194,462` both draw via `composeFooterLine`, which budgets the venue as `maxWidth − measureText(date + " · ")` and truncates the **venue** — the date cannot truncate by construction. Device: UAT test 5 PASS (session #1, re-affirmed #2) + a headless real-canvas descender measurement (`evidence/descender-zoom.png`, +3.50px clearance) that also proved the contingency `height*0.97` nudge would have **collided** the footer lines — so `shareCard.ts` was correctly left unmodified. Caveat, recorded honestly in the UAT: the *widest venue in the actual corpus specifically* remains attested rather than instrumented, and the descender measurement ran on Windows/Segoe UI, not iOS/SF Pro. |
| 5 | The bottom tabs read **Live · GizzVerse · Map · Me · Games** while every route, file path and saved data key is untouched — **and** a two-device test across *different* app builds shows a friend on an older build with a correct, readable activity label, never a blank and never a raw internal token (NAV-01, NAV-02, NAV-03) | ⚠ PARTIAL | **NAV-01 ✓** — `config.copy.tabs` = `{show:"Live", explore:"GizzVerse", map:"Map", schedule:"Sched", dex:"Me", games:"Games"}`; `BottomTabBar.tsx:13-23` reads every label from it. (Sched is an additive sixth tab from a later, owner-accepted feature, 2026-07-30.) Device: UAT test 3 PASS at MAXIMUM iOS Dynamic Type on the six-tab strip. **NAV-02 ✓** — `rebrand.test.ts` locks `ROUTES`, `ROUTE_TO_TAB`, the `Tab` union key-set, `config.DB_NAME === "guezzer"`, the in-page `GizzGames` heading, and DexView's child order (`DexHeader < AlbumGrid < ShowsList < FriendsList`). Every one of those assertions is unmergeable-to-break by design. **NAV-03 ⚠ MECHANISM ONLY** — `presenceActivity.ts` freezes the wire vocabulary and validates untrusted peer entries against an allow-list; `FriendRow.presenceActivityLabel` implements the render-path fallback with a `??` arm that is a **constant** (`activityUnknown: "in the app"`), never `activity.tab`, so no peer-supplied text can reach the DOM. Unit-covered and green. **But the two-device mixed-build exchange in SC5's second clause was NEVER RUN** — `21-HUMAN-UAT.md` test 6, closed `NOT RUN` as the phase's one named residual gap (owner-approved time-box). Nothing is known broken; the path is unverified, not failing. The module's own doc records the honest asymmetry: the fallback is forward protection only and cannot reach builds already in the wild. |

**Score:** 4/5 truths verified · 1 partial (NAV-03 device clause outstanding)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/app/src/layout/bottomSpace.ts` | The single owner: config → CSS custom properties | ✓ VERIFIED | 137 lines. Exports all four declared names (`BOTTOM_SPACE_VAR_NAMES`, `bottomSpaceVarEntries`, `applyBottomSpaceVars`, `useBottomSpaceVars`). Composition spot-checked live by this verifier — emits the six vars in declared order with the D-02 two-reserve split intact. |
| `packages/app/src/styles.css` | `:root` declaration of `--gz-safe-bottom`; the one permitted raw `env()` | ✓ VERIFIED | Line 33. Occurrence count asserted `=== 1` from source (never `dist`), and the body block's own comment names both the FOUND-01/D-15 bottom removal and the UX-01/D-01 top omission. |
| `packages/app/src/dex/formatDate.ts` | Single owner for both display date formats | ✓ VERIFIED | 61 lines, both formats UTC-pinned, both never-throw. Behaviourally spot-checked including the negative-offset-timezone hazard. |
| `packages/app/src/sync/presenceActivity.ts` | Frozen wire vocabulary + allow-list validation | ✓ VERIFIED | `Tab` union, `ROUTE_TO_TAB` and the `TABS` allow-list all present; `reduceActivity` skips malformed/hostile entries without throwing. |
| `packages/app/src/show/fabLayout.ts` | The one FAB / weak-fan-hint offset source | ✓ VERIFIED | Reads `var(--gz-fab-offset)`; `stripSlotReserved` is the D-05 reserved-slot signal, wired from `openerSeeded` at `ShowView.tsx:578,608` — the Phase-10 `a60d5e2` lift is re-expressed, not undone. |
| `packages/app/src/dex/shareCard.ts` | Width-constrained footer composition | ✓ VERIFIED | `composeFooterLine` present at line 281, reusing the shipped `truncateToWidth`; both footer draws route through it. Deliberately unmodified by 21-13 per the D-37 measurement. |
| `packages/app/test/layerOrder.test.tsx` | FOUND-03 structural invariant + numeric guards | ✓ VERIFIED | 911 lines, both helpers exported, anti-vacuity tests present, self-tests present. |
| `packages/app/test/bottomSpace.test.ts` | Composition + D-12 single-owner source guard | ✓ VERIFIED | 556 lines. Guard walks `src/` (>100 files), refuses `dist/`, pins the exemption set so widening it shows as a diff, and carries five self-tests proving it can fail. |
| `packages/app/test/formatDate.test.ts` · `presenceLabels.test.ts` · `rebrand.test.ts` | The four VALIDATION Wave-0 test files | ✓ VERIFIED | All present and green (109 tests across the six phase test files). |
| `packages/app/src/dev/layerRepro.tsx` · `LayoutProbe.tsx` | URL-flag-gated harnesses | ✓ VERIFIED | Both gated and wired at `App.tsx:59-60,140,144`; a normal load renders neither. |
| `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md` | Deferred overlay-stacking capture | ✓ VERIFIED | Present, and it states the sum-vs-max reserve defect explicitly. |
| `.planning/phases/.../21-HUMAN-UAT.md` | The phase's device-verification record | ⚠ PARTIAL (by design) | `status: partial` with a `residual_gap` frontmatter field naming test 6. This is the honest state, not a formatting miss — plan 21-13's own Task 3 sanctions it. |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `AppShell.tsx` | `layout/bottomSpace.ts` | `useBottomSpaceVars()` in the shell, layout effect before paint | ✓ WIRED (line 31) |
| `layout/bottomSpace.ts` | `config.ts` | `config.ui.bottomSpace` constants interpolated | ✓ WIRED (line 75) |
| `BottomTabBar.tsx` | `config.ts` | `config.copy.tabs` per TABS entry | ✓ WIRED (lines 13-23) |
| `FriendRow.tsx` | `config.ts` | `config.copy.presence.activity` lookup with constant `??` fallback | ✓ WIRED (line 84) |
| `RecapView.tsx` | `dex/formatDate.ts` | `subline(formatFullDate(...), venue)` at the call site | ✓ WIRED (line 223) |
| `ArchiveBrowser.tsx` | `dex/formatDate.ts` | `formatFullDate` in visible row **and** unmark-confirm `aria-label` | ✓ WIRED (lines 234, 276) |
| `shareCard.ts composeFooterLine` | `shareCard.ts truncateToWidth` | venue budget = maxWidth − measured date+separator | ✓ WIRED (line 291) |
| `ShowView.tsx` | `FabMenu.tsx` | `stripSlotReserved={openerSeeded}` — the reserved-slot signal, not rendered rows | ✓ WIRED (lines 578, 608) |
| `Sheet.tsx` | `layout/bottomSpace.ts` | `var(--gz-sheet-pad-bottom)` inherited via `documentElement` by the portaled node | ✓ WIRED (line 110) |
| `SearchSheet.tsx` / `FabMenu.tsx` / `AlbumDetail` / `ArchiveBrowser` / `SetlistView` / `NodeSheet` | `document.body` | `createPortal` | ✓ WIRED (all six confirmed in source) |
| `BingoCelebration.tsx` | `layout/bottomSpace.ts` | `bottom: var(--gz-chrome-reserve)` replacing `bottom-16` | ✓ WIRED (line 219) |
| `App.tsx` | `dev/layerRepro.tsx` · `dev/LayoutProbe.tsx` | flag-guarded conditional render | ✓ WIRED (lines 140, 144) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AppShell` `<main>` reserve | `--gz-content-reserve` | `useBottomSpaceVars()` → `useBottomOverlayInset()` → `useSyncExternalStore` over a `ResizeObserver`-measured height map | Yes — `useBottomOverlayHeightRegistration` measures `el.offsetHeight` and registers/clears per overlay lifecycle | ✓ FLOWING |
| `BottomTabBar` `<nav>` height | `--gz-chrome-reserve` | composed from `config.ui.bottomSpace.TAB_BAR_HEIGHT_REM` + the CSS-authored `--gz-safe-bottom` | Yes — composition spot-checked live; `env()` never round-trips through JS (D-01) | ✓ FLOWING |
| `BottomTabBar` labels | `config.copy.tabs[route]` | `config.ts:902-909` | Yes — six real strings, `satisfies Record<Exclude<Route,"settings">, string>` | ✓ FLOWING |
| `PresenceActivitySlot` text | `presenceActivityLabel(activity, online)` | `reduceActivity` over live Supabase presence entries → `config.copy.presence.activity` | Yes in unit/local paths; the **cross-build** path is the unverified one (see human item 1) | ⚠ FLOWING (single-build), UNVERIFIED (mixed-build) |
| Show-date renders | `formatFullDate(show.date)` | raw ISO from the bundled archive / Dexie rows | Yes — verified live under a negative-offset timezone | ✓ FLOWING |
| Share-card footer | `composeFooterLine(ctx, formatFullDate(date), venue, …)` | real canvas `measureText` at draw time | Yes — device PASS + headless real-canvas measurement | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| App builds clean at HEAD | `npm run build --workspace packages/app` | exit 0; `dist/sw.js` + 41 precache entries generated | ✓ PASS |
| Full suite green at HEAD | `npx vitest run` | `134 passed (134)` files, `1135 passed (1135)` tests | ✓ PASS |
| Phase test files green in isolation | `npx vitest run layerOrder bottomSpace formatDate presenceLabels rebrand sheet.a11y` | `6 passed (6)` files, `109 passed (109)` tests | ✓ PASS |
| `formatFullDate` UTC pin holds in a negative-offset zone | `TZ=America/New_York node -e "formatFullDate('2026-01-01')"` | `Jan 1, 2026` (not `Dec 31, 2025`) | ✓ PASS |
| `formatFullDate` never-throw + empty round-trip | `node -e` on `''` and `'not-a-date'` | `""` and `not-a-date` | ✓ PASS |
| Bottom-space ladder composes the D-02 split | `node -e "bottomSpaceVarEntries(0)"` | six vars, chrome-reserve free of the overlay term | ✓ PASS |
| Tab-bar-height literals absent from production source | repo grep for `4rem\|64px\|bottom-16\|h-16\|inset-y-16` | matches only in comments + `dev/` harnesses | ✓ PASS |
| Raw bottom `env()` appears once | repo grep for `env(safe-area-inset-bottom)` | `styles.css:33` only (plus `dev/LayoutProbe.tsx`, exempt by design) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo, and no PLAN or SUMMARY declares a probe. **Step 7c: SKIPPED (no probes declared or discoverable).** `npm test` + `npm run build` are the project's declared automated gate per `21-VALIDATION.md` §Test Infrastructure, and both were executed independently above rather than taken from SUMMARY claims.

---

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| **FOUND-01** — installed PWA, no dead gap, both orientations | 21-01, 21-04, 21-07, 21-13 | ✓ SATISFIED | Truth 1. Code + session-#2 measured before/after with non-zero insets both orientations. |
| **FOUND-02** — every bottom surface from one shared source; one owner for the height | 21-07, 21-08, 21-09, 21-10 | ✓ SATISFIED (2 reservations) | Truth 2. Every enumerated surface wired; D-12 guard operational and non-vacuous. Reservations: WR-01 bare mirror, CR-01 concurrent-overlay layout. |
| **FOUND-03** — nothing paints over an open modal sheet, locked by an automated test | 21-01, 21-04, 21-11, 21-12 | ✓ SATISFIED (1 reservation) | Truth 3. 911-line invariant with anti-vacuity coverage; six surfaces portaled; no tier renumbered. Reservation: WR-09 detector holes. |
| **FOUND-04** — all full dates "Mon D, YYYY" from one shared UTC-safe helper | 21-02, 21-05 | ✓ SATISFIED | Truth 4. All five named surfaces + zero competing date-format paths in the tree. **Note: `REQUIREMENTS.md:26` still shows `[ ]` and the traceability table at line 166 still reads `Pending` — the ledger under-reports what shipped.** |
| **FOUND-05** — share-card PNG date, on-device at the widest realistic venue | 21-06, 21-13 | ✓ SATISFIED (scope caveat) | Truth 4. Date cannot truncate by construction; device PASS + headless descender measurement. Caveat: widest-corpus-venue case attested, not instrumented; measurement on Segoe UI not SF Pro. |
| **NAV-01** — tabs read Live · GizzVerse · Map · Me · Games | 21-03, 21-13 | ✓ SATISFIED (1 reservation) | Truth 5. Exact strings in `config.copy.tabs`; UAT test 3 PASS at max Dynamic Type. Reservation: WR-04 — the labels are fixed `px`, so that PASS evidences immunity rather than resilience. |
| **NAV-02** — display-only rename; routes, paths, saved keys untouched | 21-03 | ✓ SATISFIED | Truth 5. `rebrand.test.ts` locks all four surfaces of the contract. **Note: `REQUIREMENTS.md:75` still `[ ]`, traceability line 187 still `Pending`.** |
| **NAV-03** — cross-build presence label, never blank, never a raw token | 21-03, 21-13 | ? NEEDS HUMAN | Truth 5. Mechanism delivered, unit-covered and structurally sound; the two-device mixed-build exchange was never run. Correctly recorded `Pending` in REQUIREMENTS.md. |

**Orphaned requirements:** none. `REQUIREMENTS.md:204` maps exactly `FOUND-01..05, NAV-01, NAV-02, NAV-03` to Phase 21, and every one appears in at least one plan's `requirements` field.

---

### Anti-Patterns Found

Scanned all 38 source files touched between `ef49e7e~1` and `dafadeb` (the phase's commit range).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` / `HACK` / `TODO` | — | **None found.** Zero debt markers across every phase-modified source file. The debt-marker gate passes cleanly. |
| — | — | stub language ("coming soon", "not yet implemented") | — | The `placeholder` hits are domain vocabulary (the `"???"` placeholder-song feature) and `config.copy` input placeholders, not stubs. |
| `explore/ExploreFilterFab.tsx` | 35 | `RESTING_BOTTOM_PX = 64 + 8` — a second numeric encoding of the tab-bar height, safe-area inset dropped | ⚠️ Warning | See WR-01 below. Not a silent miss: the guard **allowlists it by name** and fails if a second bare mirror ever appears (`bottomSpace.test.ts:472-487`). |
| `dex/ArchiveBrowser.tsx` | 334 | scroll container with no bottom inset composed | ⚠️ Warning | See WR-02 / human item 3. |
| `dex/AlbumDetail.tsx` · `dex/SetlistView.tsx` | 104 · 184 | `pb-16` hardcoded 64px gutter on full-screen sheets | ℹ️ Info | Explicitly classified out of scope: `21-RESEARCH` Hazard 2 enumerates twelve legitimate `pb-16`/`pt-16` sites the guard must not trip on, these among them. A documented decision, not a miss — but the review's WR-03 disputes the classification for these two, which are full-screen sheets rather than content pages. |
| `test/bottomSpace.test.ts` | 480 | repo-wide `/\b64\b/` assertion | ℹ️ Info | WR-10 — will fail on any unrelated standalone `64` anywhere in `src/`, with a message about tab-bar mirrors. Brittle, not wrong. |

**Code-review findings cross-checked against source (not accepted on the review's word):**

- **CR-01 (Critical) — five overlays share one anchor + one z-tier.** CONFIRMED in source: all five set `bottom: var(--gz-chrome-reserve)` at `z.toast`, nothing lays them out mutually, and `bottomOverlayInset.ts:37-41` **sums** heights for boxes that occupy `max()`. **Not a phase regression** — before 21-10 all five shared the `bottom-16` class, i.e. the same anchor. Captured as a pending todo by plan 21-10 (itself a declared must-have artifact), so the deferral is documented. Routed to human decision.
- **CR-02 (Critical) — `SetlistView` loading dialog is an empty `aria-modal` full-viewport box with no exit.** CONFIRMED in source (`SetlistView.tsx:136-148`). **Pre-existing** — `git diff 363b42c~1 363b42c` shows plan 21-12 only wrapped the already-existing empty `<div>` in `createPortal`. Out of phase-21 scope; belongs in the milestone backlog, not this phase's gaps.
- **WR-01 — the bare mirror.** CONFIRMED at `ExploreFilterFab.tsx:35`. Materially mitigated: `bottomOffset` (the resting position) reads `calc(var(--gz-chrome-reserve) + 8px)`; the literal feeds **only** the A11Y-02 lift math, where drift is absorbed by `FAB_SHEET_GAP_PX`. FOUND-02's *offset-derivation* clause is satisfied; its *"a search returns exactly one owner"* clause is satisfied only because the exemption is named and guard-locked rather than because the number is unique.
- **WR-04 — fixed-px tab labels.** CONFIRMED at `BottomTabBar.tsx:59` (`text-[14px]`). `config.ts:328-334` justifies `TAB_BAR_HEIGHT_REM: 4` on the premise that "the 14px/600 tab labels inside the bar scale with the user's iOS Dynamic Type setting" — which is **false as written**. Consequence for the record: UAT test 3's "PASS at MAXIMUM Dynamic Type" demonstrates the labels are *immune* to Dynamic Type, not *resilient* to it. NAV-01 as written ("the bottom tabs read …") is still satisfied — it asks for the strings, not for type scaling — so this does not fail the requirement, but the D-04 rationale should be corrected before a future reader trusts the comment.
- **WR-09 — invariant holes.** CONFIRMED: `createsStackingContext` (line 124) requires a positioned element to *also* carry a non-auto inline `z-index`, so a bare `position: fixed` ancestor — which forms a stacking context in WebKit/Blink on its own — is not detected; and the portal scan is file-granular. Neither invalidates today's state (every modal sheet portals to `document.body`, so its ancestor chain up to body is empty), but both weaken future regression protection below what the test's own header claims.

---

### Process / Bookkeeping Findings

These do not affect goal achievement but should be closed before the milestone audit:

1. **`21-VALIDATION.md` was never closed out.** Frontmatter still reads `status: draft`, `nyquist_compliant: false`, `wave_0_complete: false`, and all seven sign-off checkboxes are unchecked — despite the file's own note that these are execution-time fields to be flipped during `/gsd-execute-phase`. All four Wave-0 test files **did** land and are green, so this is bookkeeping, not substance.
2. **`REQUIREMENTS.md` ledger is stale in two directions.** FOUND-04 (line 26) and NAV-02 (line 75) are still `[ ]` with `Pending` traceability rows, although both are fully delivered and test-locked. NAV-03's `Pending` is correct.
3. **Three origin todos with `resolves_phase: 21` remain in `.planning/todos/pending/`** — `2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md` (FOUND-04), `2026-07-20-fix-bottom-viewport-gap-in-installed-standalone-pwa.md` (FOUND-01), and `2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md` (FOUND-03, partly Phase 22). The first two are satisfied by this phase and should move to `completed/`.

---

### Human Verification Required

#### 1. NAV-03 — two devices on different builds, both directions

**Test:** Old build (base `e92d4a8` = `1cc5787^`) on device A, current build on device B, both signed in as distinct identities, both served over HTTPS tunnels simultaneously. Record the exact observed activity-label text in each direction, plus the `At a show 🎸` precedence case and the background→idle→foreground recovery.
**Expected:** Each device shows the other a correct, readable label — never a blank slot, never a raw wire token. Device B (new) reads device A's `GizzDex` as "on GizzDex"; device A (old, predating `GizzSched`) meeting the newer token renders the constant fallback rather than a blank.
**Why human:** Requires two physical devices on two simultaneously-served production builds over live Supabase Realtime with a genuinely mixed vocabulary. Label resolution is receiver-side, so the failure is silent — the sender sees nothing wrong. `presenceLabels.test.ts` proves the label mechanism, not live behaviour. This is the same class of gap as quick tasks `260724-hqu` / `260724-lgo`, where a unit-proven realtime path was not a verified one; the UAT record itself restates those two as still outstanding on this same run.

**This looks intentional.** The owner explicitly time-boxed this before the Aug 2026 shows and recorded it as a named residual gap rather than running it or faking it — sanctioned by plan 21-13's own Task 3 and threat-register entry T-21-40. To accept the deviation and close the phase, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "a two-device test across different app builds shows a friend on an older build with a correct, readable activity label (NAV-03)"
    reason: "Owner-approved time-box before the Aug 2026 shows. Mechanism is delivered and unit-covered; the harness cost (two worktrees, two builds, two tunnels, two devices, two identities) is not justified pre-show. Tracked as the phase's named residual gap in 21-HUMAN-UAT.md and in REQUIREMENTS.md, which correctly still reads NAV-03 Pending. T-21-38 risk accepted, not eliminated."
    accepted_by: "mattfwilson"
    accepted_at: "2026-08-05T05:06:41Z"
```

Then re-run verification to apply.

#### 2. CR-01 — two bottom overlays visible simultaneously

**Test:** In a browser tab on a freshly bumped build, trigger the SW update while the InstallBanner is armed. Separately, mid-show, trigger a BingoCelebration mark toast while a WaveToast is draining.
**Expected:** Both overlays legible; both sets of controls tappable.
**Why human:** Needs a real compositor and a real SW update cycle. Pre-existing (the surfaces shared the `bottom-16` anchor before this phase too) and already captured in `.planning/todos/pending/2026-07-24-simultaneous-bottom-overlay-stacking.md` — surfaced here so the deferral is an explicit decision rather than an oversight.

#### 3. WR-02 — ArchiveBrowser list scrolled to the bottom on an installed instance

**Test:** Open the archive browser on the installed standalone instance, scroll the show list to its very end.
**Expected:** The last show row and the "Search kglw.net for newer shows" button clear the home-indicator swipe zone.
**Why human:** Requires a non-zero `env(safe-area-inset-bottom)`. UAT test 1's session-#3 scrolled-to-end check covered the Me (GizzDex) tab, not this sheet. `ArchiveBrowser.tsx:334`'s scroll container composes no bottom inset at all, and the D-12 guard structurally cannot catch an *omitted* inset — only a hand-written one.

---

### Gaps Summary

**The phase goal is achieved in the codebase.** Every clause of it was verified against source rather than against SUMMARY claims:

- *"exactly one owner for the bottom-space arithmetic"* — `layout/bottomSpace.ts` exists, is substantive, is wired into every enumerated surface, and its values flow from real measured data. The repo-wide grep for tab-bar-height literals returns matches only in comments and flag-gated dev harnesses, and the D-12 guard that enforces this is itself non-vacuous and self-tested.
- *"no installed-PWA dead gap"* — closed on a controlled on-device before/after with non-zero insets in both orientations. Notably, the executor **rejected** a later probe reading that would have made the record look stronger, correctly identifying it as a `sab: 0` Safari-tab reading where the bug class is unobservable by construction. That is the opposite of the failure mode this verification exists to catch.
- *"one date format"* — one UTC-pinned helper, all five named surfaces plus the share card routed through it, zero competing date paths anywhere in the tree, confirmed by live execution under a negative-offset timezone.
- *"the short tab names"* — exact strings in config, read by the bar, with the display-only boundary locked by assertions that cannot be broken without a visible diff.

**One clause of the roadmap contract is not met: NAV-03's two-device mixed-build verification was never run.** This is a *verification* gap, not an *implementation* gap — the mechanism is present, structurally sound (the fallback's `??` arm is a constant, so no peer-supplied text can reach the DOM) and unit-covered, and nothing is known to be broken. The gap is honestly recorded in `21-HUMAN-UAT.md` at `status: partial` with a `residual_gap` frontmatter field, and `REQUIREMENTS.md` correctly still shows NAV-03 as Pending. Because it is a human-only check that the owner has already declined once, it is surfaced here as an escalation with a ready-to-paste override rather than as a blocking code gap.

**No blockers.** No debt markers, no stubs, no unwired artifacts, no orphaned requirements. The two Critical review findings were both traced to source and neither is a phase-21 regression: CR-01's shared anchor predates the phase and carries a deferral todo; CR-02's empty loading dialog predates 21-12, which only portaled it.

**Watch items for the next phase, in priority order:** (1) the D-04 rationale in `config.ts` is factually inverted by `BottomTabBar.tsx:59` — fix the comment or the component before Phase 22 builds the chrome mechanism on top of it; (2) `createsStackingContext` should learn bare `position: fixed` before Phase 22 starts hiding chrome, since that is exactly when new `fixed` ancestors appear; (3) close the three bookkeeping items above before the milestone audit.

---

_Verified: 2026-08-05T05:06:41Z_
_Verifier: Claude (gsd-verifier)_
