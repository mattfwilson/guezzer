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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 46 | Baseline: compile-enforced core/UI split, single-artifact pipeline, tracked device-gate deferrals |

### Cumulative Quality

| Milestone | Tests | Critical Bugs Caught & Fixed | Zero-Dep Core Additions |
|-----------|-------|------------------------------|-------------------------|
| v1.0 | 481 | 4 (predict self-rank, import data-loss CR-01, logSong position, offline-cover SW clientsClaim) + WARNING-1 at audit | core = fuse.js + zod only |

### Top Lessons (Verified Across Milestones)

1. _(established v1.0)_ Bookkeeping flags must move with the code, or they lie at audit time.
2. _(established v1.0)_ Integration/recovery paths need their own tests — per-phase verification misses cross-phase and empty-state flows.
