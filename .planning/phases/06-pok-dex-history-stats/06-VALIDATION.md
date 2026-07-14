---
phase: 6
slug: pok-dex-history-stats
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (root `test.projects`: `@guezzer/core`=node, `@guezzer/app`=jsdom + fake-indexeddb) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --project @guezzer/core` (or `--project @guezzer/app`) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30-45 seconds |

---

## Sampling Rate

- **After every task commit:** Run the project-scoped suite matching the task (`--project @guezzer/core` for core-touching, `--project @guezzer/app` for app-touching)
- **After every plan wave:** Run `npx vitest run` (both projects)
- **Before `/gsd-verify-work`:** Full suite green + `npx tsc --noEmit` (the envelope type-pinning contract)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 06-01 | 1 | D-15 config, artifact schemas | T-06-02 | strictObject artifact schemas reject drift | unit (core) | `npx vitest run --project @guezzer/core test/dex/archive-artifact.test.ts` | ❌ created in-task | ⬜ pending |
| 01-T2 | 06-01 | 1 | DEX-04, STAT-04 (D-04 mapping) | T-06-01 | album_notes HTML never enters artifacts | unit (core, real-data drift guard) | `npx vitest run --project @guezzer/core test/dex/albums.test.ts && npm run build:albums` | ❌ created in-task | ⬜ pending |
| 01-T3 | 06-01 | 1 | DEX-02 (archive substrate) | T-06-02 | schemaVersion-guarded artifact | unit (core) + CLI determinism | `npx vitest run --project @guezzer/core test/dex/archive-artifact.test.ts && npm run build:archive` | ❌ created in-task | ⬜ pending |
| 02-T1 | 06-02 | 1 | D-20 (SHOW-04/05 surfaces) | T-06-04 | scrim blocks pass-through taps | component (app) | `npx vitest run --project @guezzer/app test/fabMenu.test.tsx` | ❌ replaces actionBar.test.tsx | ⬜ pending |
| 02-T2 | 06-02 | 1 | D-21 (SHOW-02 floors kept) | — | — | unit (app pure helper) | `npx vitest run --project @guezzer/app test/orbLabelFit.test.ts` | ❌ created in-task | ⬜ pending |
| 02-T3 | 06-02 | 1 | D-22 | T-06-06 | meta-flag write failure harmless | component (app, fake-indexeddb) | `npx vitest run --project @guezzer/app test/installBannerVersion.test.tsx` | ❌ created in-task | ⬜ pending |
| 03-T1 | 06-03 | 2 | STAT-01, STAT-02, D-15 | T-06-08 | min-plays cap kills fake Legendary | unit (core fixtures) | `npx vitest run --project @guezzer/core test/dex/rarity.test.ts` | ❌ created in-task | ⬜ pending |
| 03-T2 | 06-03 | 2 | DEX-03, DEX-04, STAT-03, STAT-04 | T-06-07 | pure fn safe on hostile snapshots | unit (core fixtures) | `npx vitest run --project @guezzer/core test/dex/derive-dex.test.ts` | ❌ created in-task | ⬜ pending |
| 03-T3 | 06-03 | 2 | SHOW-14, STAT-02 (D-14) | — | — | unit (core fixtures) | `npx vitest run --project @guezzer/core test/dex/recap.test.ts` | ❌ created in-task | ⬜ pending |
| 04-T1 | 06-04 | 2 | DEX-04 (D-03 covers) | T-06-10, T-06-SC | paced fetch, pinned sharp devDep | typecheck + source assertions | `npx tsc --noEmit` | n/a | ⬜ pending |
| 04-T2 | 06-04 | 2 | DEX-04 (D-03 budget) | T-06-09 | re-encoded assets, 25 KB cap | unit (app fs assertions) | `npx vitest run --project @guezzer/app test/coversManifest.test.ts` | ❌ created in-task | ⬜ pending |
| 05-T1 | 06-05 | 3 | DEX-03 (reactive derivation) | T-06-12 | guarded loaders never crash | component (app) | `npx vitest run --project @guezzer/app test/dexView.test.tsx` | ❌ created in-task | ⬜ pending |
| 05-T2 | 06-05 | 3 | DEX-04 (D-01/02/07) | T-06-11 | React-text-only rendering | component (app) | `npx vitest run --project @guezzer/app test/dexView.test.tsx` | shared with 05-T1 | ⬜ pending |
| 05-T3 | 06-05 | 3 | STAT-01, STAT-03, STAT-04 (D-05/06/08) | T-06-13 | no seen-toggle affordance exists | component (app) | `npx vitest run --project @guezzer/app test/songRow.test.tsx` | ❌ created in-task | ⬜ pending |
| 06-T1 | 06-06 | 4 | SHAR-01 (envelope v2) | T-06-14 | strictObject + owner length clamp | unit (core, extends existing) | `npx vitest run --project @guezzer/core test/serialize.test.ts test/merge.test.ts` | ✅ extends existing | ⬜ pending |
| 06-T2 | 06-06 | 4 | DEX-02 (persistence) | T-06-15 | atomic fallback-mark txn; round-trip | unit (app, fake-indexeddb) | `npx vitest run --project @guezzer/app test/retroMark.test.ts test/exportImportRoundtrip.test.ts` | ❌ retroMark new; roundtrip extends | ⬜ pending |
| 06-T3 | 06-06 | 4 | SHAR-01 (owner identity) | T-06-16 | clamped owner field | component (app) | `npx vitest run --project @guezzer/app test/exportImportRoundtrip.test.ts && npx tsc --noEmit` | ✅ extends existing | ⬜ pending |
| 07-T1 | 06-07 | 5 | DEX-02 (D-10 search) | — | — | unit (core fixtures) | `npx vitest run --project @guezzer/core test/dex/search-archive.test.ts` | ❌ created in-task | ⬜ pending |
| 07-T2 | 06-07 | 5 | DEX-02 (D-09 fallback) | T-06-17, T-06-19 | zod + assertFilterApplied; never retry | unit (core, injected fetch) | `npx vitest run --project @guezzer/core test/dex/recent-shows.test.ts` | ❌ created in-task | ⬜ pending |
| 07-T3 | 06-07 | 5 | DEX-02, DEX-03 (D-11/D-12) | T-06-18, T-06-20 | React text; dual-source dedupe | component (app, fake-indexeddb) | `npx vitest run --project @guezzer/app test/archiveBrowser.test.tsx` | ❌ created in-task | ⬜ pending |
| 08-T1 | 06-08 | 6 | HIST-01 (D-16) | T-06-21 | React text only | component (app) | `npx vitest run --project @guezzer/app test/showsList.test.tsx` | ❌ created in-task | ⬜ pending |
| 08-T2 | 06-08 | 6 | SHOW-14, STAT-02 (D-14/D-15) | T-06-21 | zero stat arithmetic in view | component (app) | `npx vitest run --project @guezzer/app test/recapView.test.tsx` | ❌ created in-task | ⬜ pending |
| 08-T3 | 06-08 | 6 | SHOW-14 (D-13 seam) | T-06-23 | recap-before-early-return pinned | component (app) | `npx vitest run --project @guezzer/app test/recapView.test.tsx test/endShowDialog.test.tsx` | shared + extends existing | ⬜ pending |
| 09-T1 | 06-09 | 7 | SHAR-01, SHAR-02 (core) | — | pure diff, input immutability | unit (core fixtures) | `npx vitest run --project @guezzer/core test/dex/compare.test.ts test/dex/share-stats.test.ts` | ❌ created in-task | ⬜ pending |
| 09-T2 | 06-09 | 7 | SHAR-01 (D-17 fork) | T-06-24, T-06-25, T-06-26 | zero-writes deep-equal proof | unit+component (app, fake-indexeddb) | `npx vitest run --project @guezzer/app test/importFork.test.ts` | ❌ created in-task | ⬜ pending |
| 09-T3 | 06-09 | 7 | SHAR-02 (D-18/D-19) | T-06-27 | never-throw share flow | component (app, mock ctx/navigator) | `npx vitest run --project @guezzer/app test/shareCard.test.tsx` | ❌ created in-task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No standalone Wave 0: every task creates its test file within the same task (fixture + implementation together, the phase-4/5 convention), and every `<verify>` carries an `<automated>` command targeting that file. Framework infrastructure (Vitest projects, fake-indexeddb, @testing-library/react, jsdom) is already installed and configured (RESEARCH §Environment Availability — verified).

- [x] Core fixture directory `packages/core/test/fixtures/dex/` — created by plan 06-03 Task 1 (shared factories for all dex tests)
- [x] No new test framework installs required

---

## Manual-Only Verifications

Per `workflow.human_verify_mode: end-of-phase` — these roll into the end-of-phase device gate (no mid-phase checkpoints):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `navigator.share` sheet with PNG attached | SHAR-02 (D-19) | OS share sheet + transient activation can't be exercised in jsdom | On iPhone: Dex header → Share card → preview → Share; OS sheet opens with image. On desktop: same flow downloads the PNG + "Card saved to your downloads." |
| FAB thumb-reach + no overlap | D-20 | Physical ergonomics + safe-area rendering | On iPhone in dark mode: open Show Mode, verify FAB findable by feel, expanded rows reachable one-thumbed, no overlap with SuggestionStrip X or home indicator |
| Orb label legibility with real titles | D-21 | Subjective readability on a real 60px-90px orb | Start a show; verify "The Dripping Tap" / "Am I in Heaven?" render readable, no clipped glyphs |
| Cover rendering on device | D-03 | Raster quality at 2× density is visual | Open #/dex on device; shelf reads as a discography, covers crisp at 80px, placeholders clean |
| Recap auto-appear after a real End Show | SHOW-14 (D-13) | Full venue flow incl. auto-backup ordering | Track a short mock show → End Show → backup downloads → recap appears without any tap |
| Retro-mark instant recompute feel | DEX-02/DEX-03 | Perceived latency of liveQuery recompute | Mark a large past show; dex header counts jump immediately |
| Card-album allowlist review | D-04 (A4) | Owner's mental "discography shelf" is subjective | Review the album grid contents against your expected shelf; allowlist is config-editable (`config.dex.cardAlbumUrls`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vacuous — tests created in-task)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
