# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-17
**Phases:** 7 | **Plans:** 46 (+3 quick tasks) | **Tasks:** 102
**Span:** 9 days (2026-07-08 → 2026-07-16) · 385 commits (101 `feat`) · ~26,600 LOC TypeScript · 481 tests green

### What Was Built
- A frozen, inspectable weighted-Markov transition model (264 nodes) with a Node-CLI backtest trust gate — top-5 66.9% overall / 68.6% free-choice on the held-out 2025 Phantom Island Australia tour, with per-signal ablation.
- The full one-thumb Show Mode loop: deterministic radial orbit predictions, fuzzy/??? logging, comet trail + hit/miss tally, crash-proof IndexedDB write-through, and a device-verified dark-venue survivability layer (wake lock, gesture suppression).
- Offline-first installable PWA shell with prompt-based (never mid-show) updates; polite ≤1/60s `latest`-only live sync (suggest-only); prominent JSON export/import data safety.
- A derived Pokédex (sighting counts computed from attendance, never stored), retroactive archive marking, gap/rarity stats, post-show recap, friend-compare, and a share card.
- An Explore-mode force-directed constellation fed from the *same* matrix artifact the predictor uses, with focus+context, edge/rotation filters, and a live dex overlay.

### What Worked
- **Compile-enforced core/UI separation.** Core's `lib: ["ES2023"]` (no DOM) + zero UI deps made "pure domain logic" a build error to violate, not a code-review catch. The integration audit confirmed zero reverse imports.
- **One artifact, one pipeline.** The transition matrix as a single frozen JSON consumed by predictor AND constellation via one shared `loadMatrix` loader held all the way through — no second pipeline crept in.
- **Derive-don't-store.** `deriveDex` as the single derivation entry point (counts from raw attendance) made unmark free, friend files reuse the same code, and left no stored counts to drift.
- **Tracked deferrals, not skipped ones.** Device-only checks (SHOW-12/13 wake lock, SYNC-03 offline, cover offline) were explicitly deferred to end-of-phase gates with owner approval and then actually closed — not quietly dropped.
- **TDD RED→GREEN in the data/stats phases** (6 & 7) kept the pure-core derivations honest against fixture setlists with known outputs.

### What Was Inefficient
- **Doc-sync lag was chronic.** REQUIREMENTS.md traceability checkboxes repeatedly lagged actual completion (flagged in multiple VERIFICATION.md files as "doc-sync lag, not a code gap"), and the Phase 02/03 VALIDATION.md `nyquist_compliant` flags were left at their draft `false` — producing a false alarm at the milestone audit. Bookkeeping trailed the code.
- **A headline-flow bug surfaced only at the integration audit.** WARNING-1 (own-backup restore misrouting to friend-compare on an evicted DB) undercut the exact "losing a phone must not mean losing a dex" promise PWA-04 exists for, yet wasn't caught until cross-phase integration checking. Per-phase review didn't exercise the reinstall path.
- **A spec claim outran the code.** `shownotes` is validated/read but never carried into the normalized model despite SCHEMA.md §12 requiring it (WR-01) — a latent re-normalize cost for any future show-prose feature.

### Patterns Established
- **Bundled-artifact loader idiom:** Vite alias + ambient `declare module` + guarded, memoized `schemaVersion` sentinel that never throws (`@matrix`, `@archive`, `@dexAlbums`). Reuse for any future build-time JSON.
- **Never-throw boundary helpers:** platform/persistence/wake-lock/poll wrappers all feature-detect + try/catch + surface a handled sentinel instead of an exception. New device/network APIs should follow it.
- **Cross-phase integration audit as a distinct gate.** Per-phase verification passed everything; the *integration* checker found the one real UX gap. Keep it as a required milestone-close step.

### Key Lessons
1. **Flip the bookkeeping flag in the same commit as the work.** REQUIREMENTS checkboxes and VALIDATION `nyquist_compliant` should move when the code lands, not at milestone close — stale flags cost a false-alarm investigation.
2. **Test the recovery path, not just the happy path.** The evicted-DB restore (the whole point of export/import) was never exercised until integration audit. Data-safety features need an explicit "fresh/empty DB" test case.
3. **When a spec says "carry X through," add a test that asserts X survives normalization** — WR-01 slipped because nothing checked `shownotes` end-to-end.

### Cost Observations
- Model mix: not tracked this milestone (instrument in v1.1 if it matters).
- Notable: heavy use of pure-core + fixture TDD kept the test suite fast (481 tests in ~3s) and let the whole model run/backtest from Node with zero browser deps — the core/UI split paid for itself in test velocity.

---

## Milestone: v1.1 — Polish & Pre-Show Hardening

**Shipped:** 2026-07-19
**Phases:** 3 (8–10) | **Plans:** 12 (8 + 2 + 2) | **Tasks:** ~26
**Span:** milestone window 2026-07-16 → 2026-07-19 (~3 days) · 587 tests green · no new user-facing features (hardening pass)

### What Was Built
- An accessibility foundation — one shared portal-to-body `<Sheet>` primitive (modal/non-modal/fullscreen) + `useFocusTrap`/`useDialogDismiss`/LIFO `dialogStack`/ref-counted `inertRoot` + a `config.ui.z` tier scale — with all 7 dialog surfaces migrated onto it; Escape-dismiss, focus-trap, focus-restore verified on iOS with VoiceOver + external keyboard.
- Explore a11y: FilterFab lifted above the NodeSheet, shared visible-viewport source, resize-reframe on the focused node.
- Circle-aware orb-label legibility (per-line chord + height budget), geometric [56..112]px sweep, on-device `#/dev/orb-fit` harness; D-20 FAB + D-22 InstallBanner verified and todos closed.
- `shownotes` carried verbatim through normalization on all 738 shows with a survival test and byte-stable downstream artifacts (resolves audit WR-01).
- Own-backup restore hardening — pure `isTypedNameMine` routes the typed-name path to merge on an evicted DB, real-Dexie union-merge proof.
- Pre-show validation gates cleared — owner tuning spot-check (9 *Infest* tracks re-tagged, zero backtest regression) and a full real-device iPhone show-loop rehearsal incl. the offline + export/import legs.

### What Worked
- **The v1.0 retrospective's lessons paid off directly.** Every v1.1 requirement traces to a v1.0 finding: WR-01 → DATA-06, WARNING-1 → PWA-05, per-phase-review-misses-recovery-paths → the VALID-02 device rehearsal. The retrospective functioned as the next milestone's requirements seed.
- **One primitive, not seven fixes.** A11Y-01 was solved by building a single `<Sheet>` and migrating onto it, rather than bolting Escape/focus handling onto each dialog — the LIFO dialog stack and `config.ui.z` mean new dialogs inherit correctness for free.
- **A test that asserts survival caught the spec-vs-code gap the v1.0 way.** DATA-06 shipped with an end-to-end `shownotes`-survives-normalization test — exactly the "add a test that asserts X survives" lesson from v1.0.
- **On-device gap-closure worked as designed.** POLISH-01's small-orb overflow only appeared on real hardware; the end-of-phase device gate caught it and the 08-08 gap-closure plan (circle-aware fit + geometric sweep) closed it before milestone close, not after.

### What Was Inefficient
- **Doc-sync lag persisted from v1.0.** At milestone close the pre-close audit surfaced 16 "open" artifacts that were all benign — 10 completed quick tasks with no parseable completion marker, a superseded verification gap, a not-a-defect debug session, and one already-resolved todo. Bookkeeping still trailed the code; the audit is noisy because completion flags aren't set when work lands.
- **The VALID-02 device leg fragmented.** The iPhone-specific offline (iOS SW eviction) and import (Files picker) legs were initially deferred to desktop-localhost fallback during the rehearsal, then completed on-device two days later over a tunnel. A single tunnel-backed session up front would have avoided the split.

### Patterns Established
- **Shared modal primitive + LIFO dialog stack.** Portal-to-body `<Sheet>`, one shared keydown listener, ref-counted `inert` on `#app-content` through `display:contents`. Any new dialog uses it; correctness is not re-implemented per surface.
- **config-driven z-index.** All stacking via `config.ui.z` named tiers (never Tailwind `z-[…]`) so collisions are resolved in one place — the "no scattered magic numbers" constraint applied to layering.
- **Carry-tolerant vs fail-loud ingestion split.** Prose fields (`shownotes`, footnotes) record to `NormalizeStats` and never throw; structural fields hard-fail. Reuse for any future additive normalized field.
- **Device dry-run as a first-class milestone gate.** A graded on-device UAT checklist (10-HUMAN-UAT.md) + a build/preview/tunnel harness turned "is it show-ready?" into a repeatable pass/fail, not a vibe.

### Key Lessons
1. **The retrospective is the next milestone's backlog.** v1.1 was essentially "close every v1.0 retro finding" — writing honest What-Was-Inefficient notes directly produced the next requirements set. Keep the retro specific enough to act on.
2. **Set the completion flag when the work lands, or the close audit lies (again).** Same lesson as v1.0, now cross-milestone verified — 16 false-positive open artifacts at close came entirely from unset status markers on finished quick tasks.
3. **Run device legs on-device in one tunnel-backed session.** Splitting the offline/import legs across desktop-fallback then a later device pass cost a second setup; a live-venue tool's device gate should be one real-hardware sitting.

### Cost Observations
- Model mix: not instrumented this milestone (flagged as optional in v1.0; still not wired — low value for a <10-user personal tool).
- Notable: a large share of the 236 commits / 212 files in the window were owner-directed quick tasks and UI polish (GizzVerse constellation, rarity tiers, ambient backgrounds) done alongside the three planned phases — the planned hardening itself was small (12 plans, ~3 days).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 46 | Baseline: compile-enforced core/UI split, single-artifact pipeline, tracked device-gate deferrals |
| v1.1 | 3 | 12 | Retro-driven requirements (every req closes a v1.0 finding); shared `<Sheet>` a11y primitive + `config.ui.z`; device dry-run as a first-class close gate |

### Cumulative Quality

| Milestone | Tests | Critical Bugs Caught & Fixed | Zero-Dep Core Additions |
|-----------|-------|------------------------------|-------------------------|
| v1.0 | 481 | 4 (predict self-rank, import data-loss CR-01, logSong position, offline-cover SW clientsClaim) + WARNING-1 at audit | core = fuse.js + zod only |
| v1.1 | 587 | 2 D-09 show-loop blockers (SuggestionStrip sizing, FAB over reserved strip) fixed on-device during VALID-02 | no new core deps (fuse.js + zod) |

### Top Lessons (Verified Across Milestones)

1. _(established v1.0, re-confirmed v1.1)_ Bookkeeping flags must move with the code, or they lie at audit time — v1.1's close audit produced 16 false-positive "open" artifacts entirely from unset completion markers.
2. _(established v1.0, applied v1.1)_ Integration/recovery paths need their own tests — v1.1 closed exactly these gaps (DATA-06 survival test, PWA-05 evicted-DB merge, VALID-02 device loop).
3. _(established v1.1)_ The retrospective is the next milestone's backlog — honest What-Was-Inefficient notes convert directly into the next requirements set.
4. _(established v1.1)_ Real-hardware device legs should run in one tunnel-backed session, not split across desktop fallback then a later device pass.
