---
phase: 06-pok-dex-history-stats
plan: 11
subsystem: dex-share-card
tags: [pokedex, share, canvas, web-share, brag-card, shar-02, react, tdd, pure-core]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 03
    provides: "deriveDex / DexStats (completion, perSong tiers, rarestCatch, showCount) — buildShareStats projects these into the card"
  - phase: 06-pok-dex-history-stats
    plan: 06
    provides: "DexHeader surface (reserves the accent Share CTA block) + useDexStats live hook the sheet self-sources"
  - phase: 06-pok-dex-history-stats
    plan: 09
    provides: "RecapView footer (Done-only) the accent Share card CTA joins"
  - phase: 05-live-sync-data-safety
    provides: "exportDownload.ts anchor-download + never-throw { ok } idiom the fallback copies"
provides:
  - "buildShareStats(dex, archive) — pure-core projection of DexStats into flat canvas-ready ShareCardData (completion, tier breakdown, rarest, latest show)"
  - "drawShareCard(ctx, data, opts) — pure 1080×1350 canvas draw (takes ctx, never creates one — mock-ctx testable, Pitfall 8)"
  - "buildShareCardFile(data) — pre-builds the PNG File + preview URL before the tap (Pitfall 7); never-throw { ok:false } on null getContext/toBlob"
  - "shareOrDownload(file) — canShare-gated navigator.share with anchor-download fallback + silent AbortError"
  - "ShareCardSheet — bottom-sheet preview; accent Share CTAs in DexHeader + RecapView footer"
affects: [07-constellation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All share-card NUMBERS assembled in pure core (buildShareStats) — the app draw layer only draws (jsdom has no canvas, Pitfall 8)"
    - "File pre-built on preview-sheet open; share tap calls navigator.share synchronously with the state-captured file — no async between tap and share (iOS transient activation, Pitfall 7)"
    - "Never-throw at the canvas/share boundary (T-06-27): getContext/toBlob/share all guarded → { ok:false } + calm copy, app state untouched"
    - "TDD RED→GREEN per task: failing test committed, then implementation"

key-files:
  created:
    - packages/core/src/dex/share-stats.ts
    - packages/core/test/dex/share-stats.test.ts
    - packages/app/src/dex/shareCard.ts
    - packages/app/src/dex/ShareCardSheet.tsx
    - packages/app/test/shareCard.test.tsx
  modified:
    - packages/core/src/index.ts
    - packages/app/src/config.ts
    - packages/app/src/dex/DexHeader.tsx
    - packages/app/src/dex/DexView.tsx
    - packages/app/src/dex/RecapView.tsx

key-decisions:
  - "buildShareStats signature is (dex, archive) — NOT (dex, snapshot, archive): latest-show DATE is derived as max(perSong.lastSeenDate) and its VENUE resolved from archive by date, so the card needs no attendance re-read (deriveDex exposes no attendance timeline; this keeps the signature minimal + pure)"
  - "tier breakdown counted over dex.perSong (every entry there is a CAUGHT song) — no new core math; scarcest-first ordered array, empty on zero-catch"
  - "ShareCardSheet SELF-SOURCES the live dex via useDexStats rather than taking dex/archive props — both DexHeader (via DexView) and RecapView open it with zero stat plumbing; the card is always the whole-dex brag card in both hosts (per §Layout 5)"
  - "drawShareCard draws the tier breakdown as per-tier-colored segments (measureText layout) so Legendary renders in accent gold (§B3) — the one sanctioned accent-on-card use"

requirements-completed: [SHAR-02]

# Metrics
duration: ~9min
completed: 2026-07-15
---

# Phase 6 Plan 11: Share Card (SHAR-02) Summary

**The brag-card half of the phase's social payoff: pure-core `buildShareStats` projects the derived `DexStats` into a flat canvas-ready `ShareCardData` (completion %, `{caught}/{total}`, show count, rarest catch + tier, scarcest-first tier breakdown, latest show), the app-side `drawShareCard` paints the fixed 1080×1350 PNG on `#0C0C10` (taking the ctx so a recorded mock proves the draw — jsdom has no canvas), `buildShareCardFile` pre-builds the File the instant the preview sheet opens (before any tap — iOS transient activation), and `shareOrDownload` gates on `navigator.canShare` with a never-throw anchor-download fallback and a silent user-cancel. The accent Share card CTA lands in the DexHeader (the phase's reserved accent use #1) and the RecapView footer. TDD RED→GREEN per task.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 (each TDD: failing test → implementation)
- **Files:** 10 (5 created, 5 modified)
- **Tests:** 462 passing full repo (+7 over the 06-10 baseline of 455: 2 core share-stats, 5 app shareCard); both `tsc --noEmit` clean

## Accomplishments

### Task 1 — Core `buildShareStats` (SHAR-02, pure)
- `packages/core/src/dex/share-stats.ts`: `buildShareStats(dex: DexStats, archive: ArchiveArtifact): ShareCardData`. A pure projection — completion/showCount pass straight through; the tier breakdown is counted over `dex.perSong` (all caught songs), scarcest-first; the rarest-catch name and the latest-show venue resolve from `archive`. The latest-show DATE is `max(perSong.lastSeenDate)` so no attendance re-read is needed. Zero-catch → `0%`, empty breakdown, null rarest/latest, no NaN.
- Barrel-exported `buildShareStats` / `ShareCardData`. Grep-verified pure (no I/O, no DB imports).
- Tests: every ShareCardData field pinned for a fixture dex (attend show 100 → caught {10,20,30}, tiers rare×1/common×2, rarest = Song 30/rare, latest = 2020-01-01 · The Venue) + the zero-catch no-NaN path.

### Task 2 — Canvas PNG + Web Share + CTAs (D-18/D-19, Pitfalls 7-8)
- `shareCard.ts`: `drawShareCard(ctx, data, { width, height })` (pure draw — contract colors only, Legendary in gold `#F2C14E`, segmented tier breakdown via `measureText`; creates no canvas), `buildShareCardFile(data)` (creates the canvas, guards null `getContext`, draws, `toBlob` → `File "guezzer-dex.png"` + objectURL preview; never throws → `{ ok:false }` with calm copy), and `shareOrDownload(file)` (canShare-gated `navigator.share` in try/catch → `AbortError` = silent `cancelled`; else the `exportDownload.ts` anchor idiom with `revokeObjectURL` in `finally`).
- `ShareCardSheet.tsx`: the EndShowDialog-idiom bottom sheet. On open it self-sources the live dex (`useDexStats`), assembles the numbers in core, and builds the File immediately (Pitfall 7). The Share button calls `shareOrDownload` with the ALREADY-BUILT, state-captured file — no async between tap and `navigator.share`. Renders the preview `<img>`, the fallback "Card saved to your downloads." success, and the "Couldn't build the card." failure state.
- Accent `Share2` CTA added to `DexHeader` (reserved accent use #1) and the `RecapView` footer ("Share card" accent · "Done" neutral). `DexView` owns the sheet toggle and renders it; RecapView hosts its own.
- `config.share.CARD_WIDTH/CARD_HEIGHT` (1080/1350) + a `config.copy.share` block (CTA, sheet, success/failure copy, card face labels — tier words reuse `config.copy.dex.tierLabels`).

## Task Commits

TDD RED (test) → GREEN (feat) per task:

1. **Task 1 RED:** failing buildShareStats tests — `620f0e5` (test)
2. **Task 1 GREEN:** pure core buildShareStats + barrel — `73f1788` (feat)
3. **Task 2 RED:** failing shareCard draw + share/download tests + config — `acb7e4f` (test)
4. **Task 2 GREEN:** shareCard flow + ShareCardSheet + CTAs + wiring — `797f39f` (feat)

## Decisions Made

- **`buildShareStats(dex, archive)` — no snapshot parameter.** `deriveDex` exposes no attendance timeline, so rather than thread the snapshot through, the latest-show date is `max(perSong.lastSeenDate)` and its venue is resolved from `archive.shows` by date. This keeps the signature minimal and the function pure, and matches the plan's frontmatter artifact contract exactly. Unbound/post-corpus latest nights simply carry a null venue (date stays honest).
- **The sheet self-sources the dex.** `ShareCardSheet({ open, onClose })` calls `useDexStats()` itself, so neither host passes dex/archive props. Both DexHeader (via DexView state) and the RecapView footer open the same whole-dex brag card with zero plumbing — consistent with §Layout 5 (the card is the collection card, not a single-show card).
- **Segmented tier-breakdown draw.** The breakdown line is drawn as per-tier-colored segments (measured with `measureText`) so Legendary renders in accent gold — the one sanctioned accent-on-card use (§B3), rather than a flat muted line that would lose the game-language.

## Deviations from Plan

None — plan executed exactly as written. Both core and app modules, the preview sheet, both accent CTAs, config additions, and all acceptance criteria delivered as specified; TDD RED→GREEN gates observed per task. The `buildShareStats(dex, archive)` signature (vs. a snapshot-carrying variant the action text floated as an alternative) is the "minimal + consistent with deriveDex output" choice the plan explicitly asked the executor to select after reading deriveDex.

## Known Stubs

None. `buildShareStats` is barrel-exported and consumed by ShareCardSheet; `drawShareCard`/`buildShareCardFile`/`shareOrDownload` are all wired into the sheet; the accent CTA is live in both the DexHeader and the RecapView footer. No dead buttons.

## Threat Model Coverage

- **T-06-27 (denial of service / share failure):** mitigated — `getContext`, `toBlob`, and `navigator.share` are all guarded; a build failure returns `{ ok:false }` and the sheet shows "Couldn't build the card." (calm copy), the download fallback shows "Card saved to your downloads.", and a user cancel (AbortError) is silent. No path touches Dexie or app state (the sheet reads the dex read-only via useDexStats). The `buildShareCardFile` getContext-null test pins the never-throw contract.
- **T-06-SC (supply chain):** no new dependencies added.

## Verification

- `npx vitest run --project @guezzer/core test/dex/share-stats.test.ts` — 2/2 green.
- `npx vitest run --project @guezzer/app test/shareCard.test.tsx` — 5/5 green (mock-ctx draw, getContext-null calm failure, canShare-gated share vs download vs cancelled).
- `npx vitest run` (full repo) — **462/462 green (61 files)**; +7 over the 06-10 baseline (455).
- `npx tsc --noEmit -p packages/core/tsconfig.json` and `-p packages/app/tsconfig.json` — both clean.
- grep: `share-stats.ts` has no I/O/DB imports; `shareCard.ts` numbers come from `ShareCardData` (no completion/tier stat arithmetic — only layout math); `RecapView`/`DexView` reference `ShareCardSheet`; the Share button calls `shareOrDownload` with a state-captured file (no `toBlob`/`await` between the tap and `navigator.share`).
- **Deferred device human-check** (per `human_verify_mode: end-of-phase`): real `navigator.share` sheet opens on iPhone with the PNG attached; desktop download fallback saves `guezzer-dex.png`. Tracked to the end-of-phase device gate.

## TDD Gate Compliance

Each task followed RED (a committed failing `test(...)`) → GREEN (`feat(...)`). Gate commits present: Task 1 `620f0e5`→`73f1788`; Task 2 `acb7e4f`→`797f39f`. No refactor commits needed.

## Self-Check: PASSED

All 5 claimed created files exist on disk; all 4 task commits (`620f0e5`, `73f1788`, `acb7e4f`, `797f39f`) exist in git history. Core suite 255/255, full repo 462/462 green, both package typechecks clean.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*
