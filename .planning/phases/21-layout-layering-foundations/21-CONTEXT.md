# Phase 21: Layout & Layering Foundations - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Collapse the app's bottom-space and layering arithmetic to exactly one owner, remove the
installed-PWA dead bottom gap, lock modal-sheet layering with an automated invariant test,
render every full calendar date from one shared UTC-safe helper, and shorten the bottom-tab
display labels — so phases 22–24 build on settled ground instead of rewriting it in a second
layout state.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, NAV-01, NAV-02, NAV-03

**Not in this phase:** any chrome-hide *behavior* (Phase 22), sheet *animation* (Phase 22),
in-show overlays (Phase 23), reaction fly-ups (Phase 24). This phase ships the seams those
phases consume, wired to today's behavior.

</domain>

<decisions>
## Implementation Decisions

### Bottom-space single owner (FOUND-01, FOUND-02)

- **D-01: Hybrid config → CSS custom property.** Numeric values live in `config.ts`
  (CLAUDE.md single-config-file rule, unit-testable); one place at the app root writes them to
  CSS custom properties. Every consumer reads `var(...)` instead of composing its own `calc()`
  string. One owner for the value, one idiom for consumption.
- **D-02: Two named compositions, not one.** `AppShell.tsx:64-78` deliberately reserves the
  runtime overlay inset ONLY on scrolling routes — non-scrolling routes (orbit stage,
  constellation) let banners float, because reserving would squish a `flex-1` full-height stage
  every time a transient banner appears. The owner therefore exposes **two** named values
  derived from the same parts:
  - a **content reserve** (tab bar + measured overlays) for scrolling routes, and
  - a **chrome reserve** (tab bar only) for non-scrolling routes and fixed-position surfaces.

  This preserves shipped behavior exactly and turns an undocumented divergence between call
  sites into a named, explained one.
- **D-03: Runtime overlay heights fold into the content reserve.** The existing
  `useBottomOverlayInset` store feeds the composed value, so "reserved bottom" means one thing.
- **D-04: `rem` is the source unit.** Keep `4rem` (scales with the user's font-size setting) and
  retire the `64px` literals that don't. The tab labels inside the bar already scale; a fixed-px
  bar would clip them under enlarged Dynamic Type. Everything composed from the owner inherits
  the scaling.
- **D-05: The FAB does not move when a strip appears.** "Tap targets never move on their own" is
  a founding rule this milestone explicitly cites. Measured strip heights feed the *content*
  reserve, but the FAB's offset composes from a stable part a transient strip cannot shift.
  **This partly reverses shipped `fabLayout.ts`**, which currently adds
  `config.ui.SUGGESTION_STRIP_HEIGHT` to the FAB offset — recorded here so it is not later
  rediscovered as a regression. Cross-check against the Phase-10 rehearsal fix `a60d5e2`
  ("FAB lifted above the reserved strip") before implementing: that fix must not be undone,
  only re-expressed as a stable offset.
- **D-06: Measure only genuinely variable overlays.** `useBottomOverlayHeightRegistration`
  applies to overlays with variable content (install instructions, toasts). The
  **SuggestionStrip is exempt** — `SuggestionStrip.tsx:9` documents its height as fixed and
  ALWAYS reserved (`reserveSpace || hasContent`) precisely so the layout never jumps mid-show.
  The 56→112px drift found in the Phase-10 rehearsal was a wrong constant, not a wrong
  mechanism. Do not convert it to a measured height.
- **D-07: Modal sheet bottom padding gets its own owned value.** The
  `calc(env(safe-area-inset-bottom) + 32px)` idiom in `Sheet.tsx:104` is copy-pasted into
  `ArchiveBrowser.tsx:379`, `CometTrail.tsx:231` and `RecapView.tsx:442`. Collapse those into a
  **distinct** named value (sheets are not tab-bar-relative — do not merge it with the reserve).
  Small deliberate widening beyond FOUND-02's list; it means Phase 22 animates a sheet whose
  padding already has one owner.
- **D-08: Audit every bottom-anchored surface, convert what is tab-bar-relative.** Includes
  surfaces FOUND-02 does not name (`MapView.tsx:468` `absolute bottom-0` pin strip,
  `NodeSheet.tsx:148` `fixed bottom-0`). Anything left unconverted carries a comment saying why.
- **D-09: Fix the `bottom-16` one-inset overlap.** `InstallBanner`, `UpdateToast`, `BackupToast`,
  `WaveToast` and `BingoCelebration` all sit at Tailwind `bottom-16` = 64px from the **viewport**
  bottom (`fixed` ignores body padding), while `BottomTabBar` is `64px + env(safe-area-inset-bottom)`
  tall — so on an installed instance each overlaps the top of the tab bar by exactly one inset.
  `BingoCelebration.tsx:207` carries a comment reasoning that `bottom-16` clears the bar: correct
  in a Safari tab where the inset is `0`, wrong on the installed instance. All five compose from
  the chrome reserve instead. Include in the before/after device measurement.
- **D-10: Peek strip is out of scope — FOUND-02's wording overreached.** `BingoPeekStrip.tsx:3`
  states it is in-flow in the show column and NEVER fixed; its expanded panel is absolutely
  positioned inside its own `relative` container on the `z.peek` tier. It has no bottom offset to
  unify. Recorded so the planner does not hunt for one and the milestone audit does not read it
  as unmet.
- **D-11: Landscape gets correct math, not a new layout.** No landscape-specific design. The bar
  stays bottom-anchored full-width; the phase guarantees the arithmetic holds when
  `inset-bottom` shrinks. Note `styles.css:221-222` already applies `inset-left`/`inset-right`
  at body level. Verified in the same device pass as portrait.
- **D-12: Source-scanning guard test locks the single owner.** A Vitest test over
  `packages/app/src` that fails if a bottom-anchored magic literal (`4rem`, `64px`, or a bare
  `env(safe-area-inset-bottom)` outside the owner module) appears anywhere but the one owner.
  This is the only form that tests FOUND-02's own wording. Precedent: `configMirror.test`, the
  cover-art budget-guard test.
- **D-13: Per-surface revertibility, no compatibility shim.** One commit establishes the owner
  and variables with behavior byte-identical to today; subsequent commits convert surfaces in
  small groups (tab bar + main → FAB family → toast family). Any single surface reverts as one
  commit. **No old-constants-kept-alongside shim** — that recreates the two-systems state this
  phase exists to eliminate and would fail FOUND-02 on its own wording. No feature flag.

### Installed-PWA dead gap (FOUND-01)

- **D-14: Diagnose on device before fixing.** First slice ships a temporary on-device readout
  (env insets, `window` vs `visualViewport` height, measured heights of
  `html`/`body`/`#root`/`main`/OrbitStage) so installed-vs-Safari-tab can be compared directly.
  The fix follows the evidence. The FOUND-01 before/after measurement is already a phase
  deliverable, so the harness pays for itself twice. **Do not** reintroduce `100vh`/`min-h-screen`
  (caused the start-show-not-clickable bug — see `AppShell.tsx:28-36`) and **do not** reach for
  `dvh` (iOS 26.0 shipped its own `100dvh` bottom-gap regression).
- **D-15: Lead hypothesis — the body-level bottom inset is double-counted.**
  `styles.css:220` applies `padding-bottom: env(safe-area-inset-bottom)` to `body`, and the
  comment directly above it (lines 217-219) records that the equivalent **top** inset was removed
  under UX-01/D-01 for exactly this reason. `#root` is `height:100%` of body's already-shortened
  content box, and `BottomTabBar.tsx:25-26` then adds `env(safe-area-inset-bottom)` again. That
  inset is `0` in a Safari tab and non-zero only on an installed instance — the exact visibility
  signature of the reported bug. Test this first; mirror the UX-01 fix (drop the body-level
  bottom padding, let each bottom-anchored surface own its inset). The left/right body gutters
  stay — they have no per-surface duplicate. Fall back to the open investigation if the
  measurement contradicts it.
- **D-16: Build the chrome-collapse hook now, wired to always-visible.** The chrome reserve is
  designed so it can go to `0` (or to bare safe-area) when chrome hides, and everything composed
  from it follows automatically. Phase 21 ships it pinned to a constant — no behavior change, no
  way to hide yet. Phase 22 flips one source instead of revisiting every call site in a second
  layout state. Phase 24 takes its reaction spawn anchor from the same value.
- **D-17: Keyboard behavior — check during the device pass, fix only if broken.** Add
  "open SearchSheet with the keyboard up" to the diagnosis session. Fix only if the reserved
  arithmetic misbehaves (FAB or strip riding the keyboard, search input covered). No speculative
  `visualViewport` mechanism without a reproduced defect.
- **D-18: Proof is numbers + screenshots in `21-HUMAN-UAT.md`** — before and after, portrait and
  landscape, installed instance, with device model and iOS version recorded. Same practice as the
  Phase-10 VALID-02 rehearsal and the Phase-4 SHOW-12/13 checks.
- **D-19: A non-reproduction still satisfies FOUND-01.** The success criterion is "measured
  before and after, portrait and landscape." If the numbers show flush, the measurement IS the
  evidence — no code change required to close it. Record the baseline for future regressions.

### Layer ordering (FOUND-03)

- **D-20: Structural is the lead hypothesis; get the repro first.** Evidence gathered during
  scouting:
  - `App.tsx:119-123` renders `InstallBanner`, `UpdateToast`, `BackupToast`, `BingoCelebration`
    and `WaveToast` as **siblings of `AppShell`** — top level, `toast: 20` / `celebration: 18`.
  - `ShowView.tsx:176-179` wraps the entire show column in `style={{ zIndex: config.ui.z.content }}`
    — **that creates a stacking context** at 10.
  - `SearchSheet.tsx:95-103` is hand-rolled (`role="dialog"`, own `zIndex: config.ui.z.sheet`,
    **no portal**) and renders inside ShowView. `AlbumDetail.tsx:48`, `ArchiveBrowser.tsx:270`,
    `SetlistView.tsx:120/131` and `NodeSheet.tsx:150` are the same shape.
  - Only `Sheet.tsx:77/90` calls `createPortal(…, document.body)`.

  A `z-index: 50` nested inside a stacking context of `10` loses to a top-level `20`. The tier
  numbers are consistent; the **nesting** is not — which is why renumbering could not fix it, and
  is consistent with the standing "renumber nothing" constraint. Produce the repro the roadmap
  asks for (open a modal sheet, fire a toast) and name the offending surface before acting.
- **D-21: Fix by portaling, not renumbering.** Sheet-tier surfaces escape the stacking context
  via `createPortal` to `document.body`, exactly as `Sheet.tsx` already does. **No tier is
  renumbered.**
- **D-22: Portal only — keep the five surfaces hand-rolled.** Do NOT migrate them onto the shared
  `<Sheet>` primitive in this phase. Smallest possible diff on five shipped VoiceOver-verified
  surfaces, and it deliberately does not grow the count of surfaces Phase 22's sheet animation
  must not break (11 → 16). Migration remains available later as its own decision.
- **D-23: Audit what each surface loses by being portaled, and re-apply it.** A portaled node
  loses ancestor-scoped CSS — including the `.orbit-stage` / `.fab-menu` gesture-suppression
  rules (`touch-action: manipulation`, `overscroll-behavior: none`, `-webkit-touch-callout: none`)
  that SHOW-13 depends on (`styles.css:27-35`) — plus anything relying on tree position for focus
  or Escape. `SearchSheet` matters most: it is the one-thumb, in-the-dark surface, and losing
  double-tap-zoom / long-press-callout suppression there is a real venue regression. Apply the
  needed classes directly on the portaled root.
- **D-24: The invariant test is structural.** Assert that every surface rendering at the sheet
  tier is portaled to `document.body`, so its z-index competes at the top level rather than
  inside a nested context. A pure config-value comparison would **pass today despite the defect**
  (the numbers are already correctly ordered) and therefore cannot satisfy FOUND-03.
- **D-25: Plus two named numeric guards.** Add targeted assertions for **WR-01** (`page < sheetScrim`
  — else a RecapView-opened sheet's scrim lands behind the opaque page) and **CR-01**
  (`fabScrim < fab` — else the scrim eats every speed-dial tap). Both are real bugs already found
  and fixed once, currently protected only by comments in `config.ui.z`. Two named guards, **not**
  a full ladder pin.
- **D-26: Modal-only invariant, non-modal exempt by name.** `NodeSheet` (non-modal) and the
  `focusedFab: 60` lift above `sheet: 50` are carried as explicitly named, commented exceptions,
  preserving shipped decision D-03. Matches FOUND-03's own wording ("open **modal** sheet") and
  the roadmap's "the deliberate non-modal `focusedFab` exception survives".
- **D-27: FabMenu is included in the repro (same root cause).** `FabMenu.tsx:120/129` sits at
  `fabScrim: 25` / `fab: 30` inside the same ShowView `z: 10` column. If the nesting analysis
  holds, a `toast: 20` paints over the FAB and eats its taps **mid-show** — worse than the sheet
  case, because it hits the live-logging loop. Fix if it reproduces; note as same-root-cause
  inclusion, not scope expansion.
- **D-28: Audit transform-created stacking contexts too.** `transform`, `filter`,
  `backdrop-filter`, `opacity` and `will-change` on an ancestor also create a stacking context
  AND make `fixed` descendants position relative to that ancestor. Live instances:
  `MapView.tsx:213`, `ExploreBackground.tsx:120/157`, `ShowBackground`, `ExploreFilterFab.tsx:97`.
  Same defect family, strictly worse when it hits (mispositioned, not just mispainted). Grep for
  it; fix only what reproduces.
- **D-29: Repro via a URL-flag harness, following the `?mockLatest=1` precedent.** A flag that
  force-shows a toast so any sheet or the FAB can be opened over it on demand, in a desktop
  browser. Reproducible for the Phase 22–24 authors, not just once here.
- **D-30: Order — repro first, then bottom-space, then portals.** The repro is browser-only and
  costs nothing, and its result sizes the layering work. Then land the bottom-space rewrite (the
  phase's stated reason to go first; phases 22–24 are blocked on it), then portal fixes on top of
  settled offsets. Avoids editing the same five toast files twice.

### Date format (FOUND-04, FOUND-05)

- **D-31: `formatFullDate` is a sibling of `formatMonYear`,** in
  `packages/app/src/dex/formatMonYear.ts` — same module-level `Intl.DateTimeFormat`, same
  `timeZone: "UTC"` guard, same invalid-input-returns-raw-string behavior. Rename the file to
  something format-neutral if housing two formatters reads wrong. **Not core** — this is
  presentation, and core has no display-formatting layer.
- **D-32: Convert full dates only; coarse Mon-Year stays coarse.** Convert the five raw-ISO
  sites — `ShowView.tsx:515`, `ShowsList.tsx:234`, `SetlistView.tsx:148`,
  `ArchiveBrowser.tsx:209` — plus the share card. Leave `formatMonYear` at its existing call
  sites (`SongRow.tsx:39`, `WhyDetail.tsx:69`): "last seen Jan 2025" is the right granularity for
  a song's era, and a full date there would imply precision the stat does not carry. Two
  vocabularies is correct: one for a specific show, one for a song's history.
- **D-33: Convert the two accessible names too.** `SetlistView.tsx:129`
  (`aria-label={resolved.date}`) and `ArchiveBrowser.tsx:249` (unmark-confirm label) currently
  announce `2026-08-14` as a number sequence. Converting gives natural speech and keeps visible
  and announced text identical — which matters most on the unmark confirm, where the label is
  what identifies the show being unmarked.
- **D-34: Format at the call site; the copy template stays strings-only.** `config.ts:1142-1144`
  composes `{date} · {venue}`; it keeps composing whatever string it is given. Components format
  before calling. Keeps `config.ts` free of presentation logic and keeps the helper the single
  owner.
- **D-35: Display-only — formatted dates never reach stored or exported data.** Dexie rows, the
  backup envelope, export filenames, the `show_id`/date join keys and the `attendanceKey` unbound
  branch all stay ISO, always. This is load-bearing: the date **is** a join key in the unbound
  attendance path (`attendance-key.ts`), so a formatted date leaking into stored data would
  silently break dex derivation and merge. Same discipline as NAV-02's display-labels-only rule.
- **D-36: Share-card overflow — ellipsize the venue via the existing helper.** The footer
  `date · venue` line is drawn by `centerText` at a fixed 44px with **no width constraint**
  (`shareCard.ts:193`, `shareCard.ts:424`), while `truncateToWidth` (`shareCard.ts:252`) and a
  wrap helper already ship in that same file for square labels and badges. Pass a max width from
  the card margins and **truncate the venue, never the date** — the date is the requirement.
  "Mon D, YYYY" is ~2 characters longer than the ISO string it replaces, so this change makes an
  existing overflow risk worse.
- **D-37: Check the footer baseline in the same device pass.** The footer sits at
  `height * 0.99` with a 44px font — descenders may already clip at the card's bottom edge,
  independent of the date change. Look while producing the FOUND-05 card; fix only if it clips.
- **D-38: Helper unit tests plus a source guard.** Test the UTC boundary case that motivates the
  helper (a `2026-01-01` must never render as Dec 31 in a negative-offset zone) and the
  invalid-input path returning the raw string rather than `Invalid Date`; then a source check
  that no component renders a bare ISO show date. Mirrors D-12 so both foundations are protected
  the same way.

### Tab rename & presence labels (NAV-01, NAV-02, NAV-03)

- **D-39: Token → label map; wire tokens frozen.** `presenceActivity.ts:21-23` currently states
  "These ARE the display labels … so no separate label map is needed" and `FriendRow.tsx:72`
  renders `activity.tab` straight to screen. NAV-01 breaks that assumption. `Tab` stays exactly
  the `gizz-room` wire vocabulary (`LiveGizz`, `GizzVerse`, `GizzMap`, `GizzDex`, `GizzGames`,
  `idle`); a display map turns each token into its label. The map lives with the tab copy so
  `BottomTabBar` and `FriendRow` read one source. **Correct the stale comment.** The `TABS`
  allow-list keeps validating tokens, untouched.
- **D-40: Two label voices off one token.** Tab labels and presence labels are different voices.
  The tab reads "Me" because it is *your* tab; a friend's dot must not read "Alex is on Me".
  Presence uses second-person-sensible wording (e.g. "on GizzDex"). Two maps, one token, decided
  in the same file.
- **D-41: Unknown token → generic readable fallback.** An unrecognized token resolves to neutral
  wording ("in the app", or the online dot with no place named) — never blank, never a raw token,
  per NAV-03. Since tokens are frozen, the live risk is a *newer* build sending a token an older
  build doesn't know; add the fallback now so any tab a later phase introduces is already safe on
  today's builds. Mixed builds are the designed state under prompt-to-update SW.
- **D-42: NAV-03 verified old-build vs new-build over the HTTPS tunnel.** Serve the pre-rename
  build to one device and the post-rename build to the other, sign in as two identities, and
  check the activity label in **both** directions. Only this exercises the real path — real
  Realtime, real allow-list validation, real mixed vocabulary. This project has learned twice
  (the two `visibleEpoch` fixes, quick tasks `260724-hqu` / `260724-lgo`) that a unit-proven
  realtime path is not a verified one.
- **D-43: Tab strip only — in-page headings keep the brand names.** The short names exist so five
  tabs fit under a thumb; that is a space constraint, not a rebrand. `config.ts:1201`
  (`sectionHeading: "GizzGames"`) and its peers stay as page headings while the tab reads
  "Games".
- **D-44: "Me" is a name change only — contents untouched.** The `dex` route keeps `DexHeader`,
  the album shelf, the shows list and `FriendsList` in their current order. NAV-02 is explicit
  (display labels only; routes, file paths and saved data keys unchanged), and Phase 24's NAV-04
  puts a friends-online badge on this exact tab, which only works if it stays the friends
  surface it already is.

### Claude's Discretion

None — every question in this discussion was answered explicitly.

### Folded Todos

- **`.planning/todos/pending/2026-07-20-fix-bottom-viewport-gap-in-installed-standalone-pwa.md`**
  (tagged `resolves_phase: 21`) — the installed/standalone bottom gap. Owner device-tested on
  iPhone 2026-07-20. Carries the "do not naively fix with `100vh`" constraint and the candidate
  investigation directions. Folded whole into FOUND-01 (D-14…D-19).
- **`.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`**
  (tagged `resolves_phase: 21`) — "Mon D, YYYY" app-wide from one UTC-safe helper mirroring
  `formatMonYear.ts`, leaving coarse Mon-Year alone. Folded whole into FOUND-04/05 (D-31…D-38).
- **`.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`**
  (tagged `resolves_phase: 22`) — **split across two phases.** Its *always-on-top layering* half
  is FOUND-03 and is folded here (D-20…D-30); its *smooth up/down animation* half remains Phase 22
  (SHEET-01/02). Do not close the todo in this phase. Note its cited instance (`ExploreFilterFab`
  `z-30` vs `AppMenu` `z-20`) predates the `config.ui.z` tier scale and is already retired — the
  live defect is the nesting one in D-20.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and standing constraints
- `.planning/ROADMAP.md` §"Phase 21: Layout & Layering Foundations" — the five success criteria
  this phase is judged against.
- `.planning/ROADMAP.md` §Coverage, "Standing constraint on FOUND-03" — *"write the invariant
  test, renumber nothing."* No phase may promise a z-tier renumbering; a device repro naming the
  offending surface resolves the structural-vs-numeric disagreement.
- `.planning/REQUIREMENTS.md` §"Layout & Layering Foundations" + §"Navigation & Install" —
  FOUND-01..05, NAV-01/02/03 verbatim.
- `.planning/REQUIREMENTS.md` §"Verification Notes" — why FOUND-01 and NAV-03 cannot be verified
  in a desktop browser tab, and the `env(safe-area-inset-bottom)` reports-0-in-a-tab explanation.
- `.planning/REQUIREMENTS.md` §"What NOT to build" table — renaming the presence wire tokens and
  speculatively renumbering the z-tier scale are both explicitly excluded.
- `.planning/v2.1-ux-polish-backlog.md` — the 12 owner items this milestone derives from.
- `.planning/research/SUMMARY.md` — v2.1 research synthesis (source of the four-notation and
  regression-risk findings).

### Folded todos (full context + owner's own constraints)
- `.planning/todos/pending/2026-07-20-fix-bottom-viewport-gap-in-installed-standalone-pwa.md`
- `.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`
- `.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`
  (layering half only — animation half is Phase 22)

### Prior decisions this phase must not unpick
- `.planning/STATE.md` §"Accumulated Context / Decisions" — the v2.1 roadmap decision record,
  including the six device-verification items budgeted inside their owning phases.
- `.planning/phases/20-presence-interactions/20-CONTEXT.md` — Phase-20 presence decisions
  (D-01 route→tab map, D-02 hidden-wins, D-03/SOCL-V2-01 coarse-payload scope line) that D-39…D-42
  build on.
- `.planning/quick/260724-hqu-*/` and `.planning/quick/260724-lgo-*/` — the `visibleEpoch`
  mobile-suspension rejoin fixes; the precedent for why NAV-03 needs a real two-device check.
- `.planning/phases/10-pre-show-validation-device-dry-run/10-HUMAN-UAT.md` — the VALID-02
  rehearsal format that `21-HUMAN-UAT.md` should follow (D-18), and the origin of the
  SuggestionStrip 56→112px fix and the `a60d5e2` FAB lift referenced in D-05/D-06.
- `CLAUDE.md` §Constraints — single-config-file rule (no scattered magic numbers), strict
  core/UI separation, zero new runtime dependencies.

### Code the phase rewrites (read before planning)
- `packages/app/src/pwa/bottomOverlayInset.ts` — the existing runtime overlay-height store and
  its documented root-cause history.
- `packages/app/src/components/AppShell.tsx:22-78` — the scroll/non-scroll divergence (D-02) and
  the `100vh` iOS-trap comment (D-14).
- `packages/app/src/components/BottomTabBar.tsx:20-27` — the `4rem` + safe-area border-box model.
- `packages/app/src/styles.css:14-18, 217-223` — the `height:100%` chain and the body-level
  safe-area padding that D-15 targets.
- `packages/app/src/config.ts` §`ui.z` (lines ~240-297) — the tier ladder, its INVARIANT comment,
  the D-03 `focusedFab` exception, and the WR-01 / CR-01 regression-guard rationale.
- `packages/app/src/components/Sheet.tsx` — the portal + z-tier pattern D-21/D-24 assert against.
- `packages/app/src/sync/presenceActivity.ts` — the `Tab` union, `ROUTE_TO_TAB`, the `TABS`
  allow-list, and the now-stale "these ARE the display labels" comment D-39 corrects.
- `packages/app/src/dex/formatMonYear.ts` — the helper D-31 mirrors.
- `packages/app/src/dex/shareCard.ts:185-200, 252-295, 418-430` — `centerText`,
  `truncateToWidth`, the wrap helper, and the two unconstrained footer draws.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pwa/bottomOverlayInset.ts` — `useSyncExternalStore` overlay-height registry with a
  `ResizeObserver` and a jsdom fallback. Already the dynamic half of the reserve; becomes the
  feed into the composed content value (D-03) rather than being replaced.
- `components/Sheet.tsx` — the only surface already doing `createPortal(…, document.body)` at
  `config.ui.z.sheet` / `sheetScrim`. It is both the pattern D-21 copies and the assertion target
  for D-24.
- `dex/shareCard.ts` — `truncateToWidth` (line 252) and the wrap-and-ellipsize helper (line ~260)
  already exist and are used for square labels and badges; D-36 needs no new code.
- `dex/formatMonYear.ts` — module-level `Intl.DateTimeFormat` with `timeZone: "UTC"` and
  invalid-input-returns-raw. Exact template for D-31.
- `?mockLatest=1` URL-flag harness (quick task `260713-wjd`) — the precedent for D-29's
  layering-repro flag; it found the suggestion-strip dismissal bug.
- `dev/OrbFitHarness.tsx` — precedent for a dev-only harness route, and the home of the app's one
  remaining Tailwind `z-10` class (dev-only, not production).

### Established Patterns
- **All z-index goes through `config.ui.z` as an inline `style`, never a Tailwind class** —
  `config.ts:242-250` explains why (Tailwind v4 resolves arbitrary values at author-time from
  static strings, so a JS-config value must go through inline style to keep `config.ts` the one
  source). Production has zero `z-*` utility classes; only `OrbFitHarness` has one.
- **Guard tests over source text** — `configMirror.test`, the cover-art budget guard. D-12 and
  D-38 follow this shape.
- **Never-throw display helpers** — `formatMonYear` returns the raw input on an unparseable date
  rather than "Invalid Date". Same discipline as `wakeLock.ts` / `persist.ts`.
- **Display name decoupled from route and storage key** — established by quick task `260716-wwj`
  (the first tab rebrand): routes `show`/`explore`/`dex`, file paths, and Dexie keys are never
  renamed with the labels. D-39/D-44 are the second application of that rule.
- **Device-verified items are recorded in a phase `-HUMAN-UAT.md`** with device model, OS version
  and pass/fail per numbered test.

### Integration Points
- `App.tsx:98-123` — `AppShell` plus the five top-level overlay siblings. The boundary where the
  stacking-context defect (D-20) and the `bottom-16` overlap (D-09) both live.
- `ShowView.tsx:172-183` (`withBackground`) — the `z.content` stacking context that captures
  `SearchSheet`, `TrailNodeSheet`, `WhyDetail`, `EndShowDialog`, `CatchUpSheet` and `FabMenu`.
- `show/fabLayout.ts` — the shared FAB/weak-fan-hint offset; both the FAB and the "Low confidence"
  hint consume it, so D-05 must keep them aligned.
- `sync/presenceActivity.ts` → `sync/usePresenceReaders.ts` → `dex/FriendRow.tsx:72` /
  `dex/SelfRow.tsx:69` — the token-to-screen path D-39/D-40/D-41 insert the label map into.
- `config.copy` — where both label maps (D-39/D-40) and any new fallback wording (D-41) belong.

</code_context>

<specifics>
## Specific Ideas

- **Mirror the UX-01 top-inset fix on the bottom axis.** The owner-visible bug (dead gap on the
  installed PWA) is very likely the exact structural mirror of a bug this project already fixed
  once at the top of the screen — and the comment recording that fix sits three lines above the
  code that still has it at the bottom (`styles.css:217-220`).
- **"Alex is on Me" is the test for the presence-label decision** — if the friend-facing wording
  reads as nonsense in a sentence, it is the wrong map.
- **Truncate the venue, never the date** on the share card. The date is what FOUND-05 is about.
- **The FAB must not move under a reaching thumb mid-show**, even at the cost of re-expressing
  shipped `fabLayout.ts` behavior.

</specifics>

<deferred>
## Deferred Ideas

- **Simultaneous bottom-overlay stacking.** The overlay store sums all registered heights, but
  each overlay is independently pinned above the tab bar — two visible at once would double the
  reserve while overlapping each other. Over-reserving is the safe failure (nothing gets
  covered), and fixing the visual stacking means each overlay offsetting by the total below it,
  which is new layout behavior. Capture as a todo.
- **Migrating `SearchSheet` / `AlbumDetail` / `ArchiveBrowser` / `SetlistView` / `NodeSheet` onto
  the shared `<Sheet>` primitive.** Deliberately excluded (D-22) so Phase 22's animation blast
  radius stays at 11 surfaces, not 16. Revisit after Phase 22 ships.
- **Reordering the "Me" tab so the personal/friends surface leads.** A layout change, not a
  rename (D-44). Its own phase if wanted.
- **Full landscape safe-area gutter treatment** beyond the body-level `inset-left`/`inset-right`
  already in `styles.css:221-222` — only if the D-11 measurement shows a defect.
- **Renaming internal code identifiers to match the brand names** (layer-2 of the tab-rebrand
  todo, `2026-07-17-rebrand-tabs-*`) — explicitly deferred since `260716-wwj`, and NAV-02 forbids
  touching routes, file paths and storage keys regardless.

### Reviewed Todos (not folded)

- **Couch Mode, Gizzle, Guezz League** (score 0.6 keyword matches from `todo.match-phase`) —
  feature ideas, not layout foundations. No overlap with this phase's scope.

</deferred>

---

*Phase: 21-Layout & Layering Foundations*
*Context gathered: 2026-07-24*
