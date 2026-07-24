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

## Milestone: v1.2 — Pre-Show Hardening

**Shipped:** 2026-07-22
**Phases:** 6 (11–16) | **Plans:** 28 (5+3+4+6+4+6) | **Tasks:** ~53
**Span:** milestone window 2026-07-19 → 2026-07-21 (~3 days) · ~720 tests green · two clusters — three show-critical bug-fix phases (11–13) then the first casual feature, Gizz Bingo (14–16)

### What Was Built
- **Live-sync & prediction correctness (Phase 11):** a past-midnight-safe `guardLatestRows` tonight/show filter (no previous-show leak on night 2+), a lenient-but-detecting `latest` schema surfacing drift on an amber SyncDot instead of silently emptying suggestions, a single `artist_id` ingress (KGLW-only), a reachable era-prior floor, and cross-night rotation suppression finally fed real run-grouping data + an owner "start a fresh run" reset. A code-review **blocker** (rotation window sliced oldest instead of newest, CR-01) was caught and regression-locked.
- **Data safety (Phase 12):** finalize-before-snapshot ordering + an app-level `BackupToast` that fires only on real export success, a shared `triggerDownload` that defers `revokeObjectURL` (iOS Safari abort fix), and a single `attendanceKey` so same-date doubleheaders survive as two attendances.
- **Interface polish (Phase 13):** de-doubled safe-area inset, wake-lock release race fix, off-by-N fill-hint rewrite, and a constellation camera that survives container resizes.
- **Gizz Bingo (Phases 14–16):** a pure DOM-free `bingo/` core (deterministic consume-once `deriveMarks` fold — the third derivation sibling to `deriveTally`/`deriveDex` — + seeded generator + a Monte-Carlo calibration CLI gate), Dexie v5 persistence with lock-on-Start-Show + envelope-v3 export/import + GizzDex replay + catch-up, then the playable surface: one-tap vibe deal, swap/reshuffle with a live honest fill meter, in-flow "one away" tension, a three-tier reduced-motion-aware celebration layer (≤2 big moments/show), and a shareable trophy PNG.

### What Worked
- **Bugs before Bingo held as a hard gate.** All three show-critical bug clusters landed and were device-verified before any Bingo code — the casual feature never competed with the trust-gate fixes for the Aug 14 residency.
- **The calibration gate was the Bingo equivalent of the backtest trust gate.** Rather than ship aspirational win-rate bands, a Monte-Carlo replay over the real `deriveMarks` fold proved the original D-02/D-03 targets structurally unreachable under consume-once marking, and the owner authorized retargeting to the measured range — the trust gate reflects reality, and `bingo-calibrate` exits 0 against the production fold.
- **One pure fold, three consumers.** `deriveMarks` guarantees `live == replay == catch-up` by construction, so the live board, post-show replay, and catch-up needed no separate marking logic — the same core/UI-split discipline that carried v1.0/v1.1.
- **Retro-as-backlog, third time.** v1.2's 13 bug fixes came straight from the 2026-07-19 bug-hunt/research session's captured findings; the milestone was "close the pre-show bug list, then ship the top casual feature."
- **Module-emitter toast pattern reused.** Phase 12's `BackupToast` app-level emitter became the template for Phase 16's app-wide `BingoCelebration` host — a proven pattern applied, not reinvented.

### What Was Inefficient
- **Doc-sync lag persisted — third close running, now in a new form.** This time three VERIFICATION.md files (Phases 11, 15, 16) sat at `status: human_needed` even though their HUMAN-UAT was completed and `passed` on-device days earlier; the milestone-close audit surfaced them as gaps and they had to be reconciled `human_needed → passed` at close. Plus the same class of 20 false-positive open artifacts (10 unmarked-complete quick tasks, a not-a-defect index, a superseded v1.0 verification). The bookkeeping-trails-code lesson is now three-times-confirmed and clearly needs a mechanical fix, not another note.
- **HUMAN-UAT and VERIFICATION statuses drifted apart.** The on-device UAT was recorded faithfully in `*-HUMAN-UAT.md`, but nothing flipped the sibling `*-VERIFICATION.md` frontmatter, so `audit-uat` (which reads VERIFICATION.md) kept flagging finished phases. The two artifacts need to move together.

### Patterns Established
- **Two-gate feature delivery.** A new feature that consumes a shared/live data path carries (1) an upstream-correctness gate (the live-sync fixes had to land before auto-marking) and (2) a calibration/trust gate that writes locked constants before the generator is built. Reuse for any future model-driven casual feature (League, Gizzle).
- **Consume-once derivation as a first-class sibling.** `deriveMarks` joins `deriveTally`/`deriveDex` as a pure fold over the tracked-show trail — marks/counts are never stored, always re-derived; unmark/replay is free.
- **App-level module-emitter for cross-view ephemeral UI.** `BackupToast`/`BingoCelebration` fire via a module emitter that survives view swaps (ShowView→RecapView), decoupling the trigger from the host.

### Key Lessons
1. **Move the VERIFICATION.md status when the HUMAN-UAT resolves — or better, derive one from the other.** Three phases shipped with passed on-device UAT but stale `human_needed` verification markers; the close audit can't tell "genuinely open" from "done but unflagged." A transition hook that flips VERIFICATION status when its HUMAN-UAT reaches `passed`/`resolved` would end the recurring false-positive audit.
2. **A calibration/Monte-Carlo gate is the right trust gate for a probabilistic feature.** Just as the backtest gated the predictor, replaying the real fold gated Bingo — and it earned its keep by proving the original targets unreachable before any UI was built.
3. **Sequence trust-critical work ahead of delight work, explicitly.** "Bugs before Bingo" as a stated gate kept the ~4-weeks-to-show risk budget spent on correctness first; the casual feature slotted in behind verified fixes.

### Cost Observations
- Model mix: still not instrumented (flagged optional since v1.0; low value for a <10-user personal tool).
- Notable: 238 commits / 251 files in the window (+33.8k/−0.4k LOC), but a large share was Gizz Bingo net-new (core fold + persistence + three app surfaces) rather than owner-directed polish as in v1.1; the three bug phases were small (12 plans) and the three Bingo phases carried the bulk (16 plans).

---

## Milestone: v2.0 — Multi-User Foundation

**Shipped:** 2026-07-24
**Phases:** 4 (17–20) | **Plans:** 20 (4+7+4+5) | **Tasks:** 27 (requirements)
**Span:** milestone window 2026-07-22 → 2026-07-24 (~3 days) · 189 commits / 108 files (+11.6k/−0.1k LOC) · full app suite 513 tests green · audit PASSED (27/27 reqs, 4/4 phases) · first backend-dependent milestone

### What Was Built
- **Backend foundation (Phase 17):** a hosted Supabase with a user-keyed `public.progress` table (read-all/write-own RLS + `supabase_realtime` publication), an idempotent GoTrue account-seed with a committed non-secret roster, secrets kept env-only, and — the load-bearing constraint — a `packages/core` purity guard test proven to fail on an injected `@supabase` import.
- **Offline-safe identity (Phase 18):** pre-made email/password sign-in → distinct per-device identity that **still cold-boots fully offline**, because the boot gate keys on an app-owned `gwf-identity` localStorage record rather than a network `getSession()` (the milestone's highest-risk seam, device-verified before anything depended on it). Plus one-time Dexie `version(7)` namespacing so a borrowed phone never cross-contaminates dexes, and the "Gizz With Friends" rebrand.
- **Shared dex progress (Phase 19):** a pure-core `deriveSharedProgress` projector feeding the **byte-for-byte unchanged** shipped `compareDexes`, a singleton `useProgressSync` engine (debounced own-row upsert + app-wide `postgres_changes` re-pull + Dexie offline cache), write-own RLS empirically verified (403/42501), and a live Friends view replacing the manual JSON handoff.
- **Presence & interactions (Phase 20):** ephemeral Realtime presence (online dots + coarse tab-level activity, never persisted) + targeted/broadcast waves + a fixed emoji reaction palette as reduced-motion-aware toasts, on one `gizz-room` channel via a singleton `usePresence` engine — a carbon copy of the Phase-19 engine precedent.

### What Worked
- **Spike-first de-risked a constraint reversal.** Adopting a backend directly contradicted the founding "no backend / no accounts" constraint; spikes 002–004 validated Supabase auth + Postgres + Realtime AND offline-boot coexistence *before* the roadmap committed — so the milestone executed against proven patterns, not hope.
- **The highest-risk seam was sequenced first and device-gated.** AUTH-02 (offline-safe boot) was device-verified at the end of Phase 18 before Phases 19–20 built on the identity — the exact "prove the risky thing on hardware before depending on it" discipline.
- **Core purity held by construction, not review.** A single guard test (`packages/core/test/purity.test.ts`) made "no Supabase in core" mechanical — the app-layer fence (`sync/` + `db/`) never leaked, and the prediction model stayed backendless.
- **One engine pattern, reused twice.** The singleton-engine-at-the-shell + pure `useSyncExternalStore` reader split from Phase 19's `useProgressSync` was copied verbatim into Phase 20's `usePresence` — and again into the close-time mobile fix.
- **The close-time mobile fix propagated cleanly.** The `visibleEpoch` hidden→visible rejoin, once proven on `usePresence` (hqu), was a verbatim mirror onto `useProgressSync` (lgo) — same root cause, same fix, and one two-device UAT covered both.

### What Was Inefficient
- **Doc-sync lag, a FOURTH close running — but this time the audit caught it clean.** Phase-19 SUMMARY frontmatter never listed its `requirements-completed` (PROG-01..08), the AUTH-01..08 REQUIREMENTS checkboxes sat stale `[ ]` despite Phase 18 shipping + device-UAT-passing, `19-VALIDATION.md` stayed a pre-execution draft (`nyquist_compliant: false`) though its tests demonstrably pass, and the lgo quick-task SUMMARY lacked a `status:` marker. All were false positives the milestone audit + pre-close audit surfaced, and all were reconciled at close — but it's the same bookkeeping-trails-code tax, now four-times-confirmed.
- **A real bug slipped past the phase gate to the milestone close.** The Phase-20 two-device UAT *passed* (owner cleared the gate) yet still surfaced a mobile-only activity-staleness bug that wasn't a listed criterion; it — and its Phase-19 sibling on the progress feed — were only fully fixed + device-verified at milestone close. Unit tests proved the re-open trigger but could not prove live socket recovery; only the on-device recheck closed it.

### Patterns Established
- **Singleton Realtime engine + pure external-store reader.** Mount one channel-owning engine at the App shell (gated on identity, driven from live sources); expose state through pure `useSyncExternalStore` readers. Reuse for any future Realtime surface.
- **`visibleEpoch` mobile foreground-rejoin for every `[userId, online]`-keyed channel.** Mobile backgrounding suspends the WebSocket while `navigator.onLine` never flips; bump a `visibleEpoch` only on the hidden→visible edge and add it to the subscription-effect deps so a real foreground re-subscribes (zero in-app-nav churn). Now the standing rule for any new Supabase Realtime hook.
- **App-layer fence + a core-purity guard test.** When a hard constraint ("core stays pure") must survive a new dependency, encode it as a failing-on-violation test, not a convention.

### Key Lessons
1. **A shared root cause lives in every channel that shares the keying.** The mobile-suspension staleness wasn't one bug — it was one gap in two channels (`usePresence` + `useProgressSync`), both keyed `[userId, online]`. When a fix addresses a *keying/lifecycle* class, grep for every sibling with the same shape and fix them together.
2. **Realtime/offline behavior cannot be signed off from unit tests.** The tests proved the re-open *trigger*; only a two-device on-device recheck over a genuinely suspended socket proved *recovery*. Realtime features need a device gate the way the predictor needs a backtest.
3. **The doc-sync tax is now four-times-confirmed and overdue for automation.** Every close (v1.0→v2.0) has produced false-positive "open" artifacts purely from unset completion markers / un-flipped verification status. This is no longer a note to repeat — it warrants a mechanical fix (a transition hook that stamps `requirements-completed`, flips VERIFICATION on HUMAN-UAT resolution, and marks quick-task SUMMARY status).
4. **Sequence the highest-risk seam first and prove it on hardware before dependents build on it.** AUTH-02's offline boot was device-verified at Phase 18's close, so Phases 19–20 built on a proven identity spine — the single most important ordering decision of the milestone.

### Cost Observations
- Model mix: still not instrumented (flagged optional since v1.0; low value for a <10-user personal tool).
- Notable: 189 commits / 108 files (+11.6k/−0.1k LOC) — a smaller footprint than v1.2's Bingo-heavy window, concentrated in a net-new `sync/` + `db/` app fence and a lean pure-core `shared-progress` projector; the backend itself (schema + RLS + seed) is version-controlled SQL/TS, not app LOC.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 46 | Baseline: compile-enforced core/UI split, single-artifact pipeline, tracked device-gate deferrals |
| v1.1 | 3 | 12 | Retro-driven requirements (every req closes a v1.0 finding); shared `<Sheet>` a11y primitive + `config.ui.z`; device dry-run as a first-class close gate |
| v1.2 | 6 | 28 | Two-gate feature delivery (upstream-correctness + Monte-Carlo calibration); consume-once `deriveMarks` as a third derivation sibling; "bugs before Bingo" as an explicit trust-first sequence |
| v2.0 | 4 | 20 | First backend-dependent milestone (spike-validated constraint reversal); app-layer fence + core-purity guard test; highest-risk seam (offline-safe boot) device-gated before dependents; singleton Realtime engine + pure external-store reader; `visibleEpoch` mobile-rejoin pattern |

### Cumulative Quality

| Milestone | Tests | Critical Bugs Caught & Fixed | Zero-Dep Core Additions |
|-----------|-------|------------------------------|-------------------------|
| v1.0 | 481 | 4 (predict self-rank, import data-loss CR-01, logSong position, offline-cover SW clientsClaim) + WARNING-1 at audit | core = fuse.js + zod only |
| v1.1 | 587 | 2 D-09 show-loop blockers (SuggestionStrip sizing, FAB over reserved strip) fixed on-device during VALID-02 | no new core deps (fuse.js + zod) |
| v1.2 | ~720 | 1 rotation-window slice-direction blocker (CR-01, oldest-vs-newest nights) caught in code review + regression-locked; 13 pre-show bugs closed from the bug-hunt backlog | no new core deps (bingo module is pure TS: xmur3/mulberry32 PRNG + zod) |
| v2.0 | 513 (app) | 1 Phase-19 read-boundary blocker (whole-row validation, CR-01) fixed; the mobile Realtime foreground-staleness bug (both channels) fixed + two-device device-verified at close | core = still fuse.js + zod (Supabase confined to app layer, enforced by a purity guard test) |

### Top Lessons (Verified Across Milestones)

1. _(established v1.0, re-confirmed v1.1)_ Bookkeeping flags must move with the code, or they lie at audit time — v1.1's close audit produced 16 false-positive "open" artifacts entirely from unset completion markers.
2. _(established v1.0, applied v1.1)_ Integration/recovery paths need their own tests — v1.1 closed exactly these gaps (DATA-06 survival test, PWA-05 evicted-DB merge, VALID-02 device loop).
3. _(established v1.1, re-confirmed v1.2)_ The retrospective is the next milestone's backlog — v1.2's 13 bug fixes came straight from the captured bug-hunt session; honest notes convert directly into the next requirements set.
4. _(established v1.1)_ Real-hardware device legs should run in one tunnel-backed session, not split across desktop fallback then a later device pass.
5. _(established v1.2, third-time confirmation of the v1.0 bookkeeping lesson)_ VERIFICATION.md status must move with its HUMAN-UAT — three phases shipped `passed` on-device but left `human_needed` verification markers, and the close audit couldn't distinguish genuinely-open from done-but-unflagged. This now warrants a mechanical fix (derive/flip verification status on HUMAN-UAT resolution), not another note.
6. _(established v1.2)_ Probabilistic/model-driven features need a calibration trust gate of their own (the Bingo equivalent of the backtest) — and it earns its keep: v1.2's calibration proved the original win-rate targets unreachable before any UI was built.
7. _(established v2.0, FOURTH-time confirmation of the v1.0 bookkeeping lesson)_ The doc-sync tax appeared again at the v2.0 close (unlisted `requirements-completed`, stale AUTH checkboxes, a draft VALIDATION.md, an unmarked quick-task SUMMARY) — every close from v1.0 forward. It is now unambiguously a tooling gap, not a discipline gap: stamp completion markers / flip verification status mechanically at phase transition.
8. _(established v2.0)_ Realtime/offline behavior cannot be signed off from unit tests — a device gate is mandatory. The mobile foreground-rejoin's unit tests proved the re-open trigger; only a two-device on-device recheck proved live socket recovery. Treat any Realtime channel like the predictor's backtest: it needs a hardware trust gate.
9. _(established v2.0)_ A lifecycle/keying bug is rarely singular — fix every sibling with the same shape at once. The `[userId, online]`-keyed mobile-suspension gap lived in both Realtime channels; grepping the keying found both.
