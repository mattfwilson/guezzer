# Phase 10: Pre-Show Validation & Device Dry-Run - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The final v1.1 gate before show #1 (late Aug/Sep 2026): hands-on proof the app is show-ready. Two owner-executed validations, no new user-facing features:

1. **VALID-01** — Owner completes the tuning-family tag spot-check (DATA-04): ~10 well-known songs verified musically sensible, plus an anomaly sweep, so predictions aren't skewed by silent tuning misclassification.
2. **VALID-02** — A full show-loop dry-run passes on a real device: start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit → JSON export/import round-trip, plus an offline (airplane-mode) leg.

**Current state discovered during scouting (important — changes what "completing" means):**
- `data/tuning-tags.json`: **264 songs, `needsReview` is already 0**, 52 already hand-tagged (52/264), families = 238 `standard` / 26 `microtonal`, with **zero `cs-standard` or `other`**. Phase 01's `01-HUMAN-UAT.md` already passed a 10-song spot-check. So VALID-01 is largely **re-confirmation + anomaly sweep**, not fresh bulk hand-filling.
- `?mockLatest=1` harness already exists (`packages/app/src/live/mockLatest.ts`) — a 4-song, single-set, no-encore fixture. Covers the live-sync leg only.

**Out of scope:** new features, model/scoring changes beyond correcting genuine tuning-tag errors, Android-specific work (no device — waived), building an elaborate multi-set simulation harness.

</domain>

<decisions>
## Implementation Decisions

### VALID-01 — Tuning spot-check scope
- **D-01: Confirm + anomaly sweep, not blind regeneration.** Build a **read-only review report** (CLI and/or generated markdown) that (a) lists the ~10 canonical well-known songs with expected vs actual `family`, and (b) surfaces suspicious cases for owner eyeballing. Owner hand-fixes only genuine errors. Do NOT re-run `generate-tuning-tags` as the primary action — the append-only merge already preserves the 52 hand-edits, and `needsReview` is already 0.
- **D-02: The sweep actively hunts `cs-standard` / `other` candidates.** Because `cs-standard` is owner-knowledge and is NEVER auto-assigned by the album-default logic (see `tuning-tags.ts` D-03), the report must flag plausible `cs-standard` (down-tuned) and `other` songs for the owner to confirm — a whole family the auto-logic is blind to — in addition to checking the existing standard/microtonal boundary for obvious errors.
- **D-03: If real tag errors are found → fix + rebuild + backtest.** Hand-edit `data/tuning-tags.json`, then re-run `build-model` and `run-backtest` to confirm predictions hold with no regression before declaring VALID-01 done. This fully closes "predictions aren't skewed by silent misclassification." (If the sweep finds nothing — the likely outcome given prior work — no rebuild is needed and VALID-01 is confirmation-only.)

### VALID-02 — Dry-run live-feed simulation
- **D-04: `mockLatest` for the sync leg only; drive the rest manually.** Use `?mockLatest=1` once to prove the live-sync path (SuggestionStrip → adopt → auto-bind), then drive set break, encore, and End Show through Show Mode's **real controls with manual song entry** — which mirrors how the owner will actually log at the show. Do NOT extend `mockLatest` into a staged multi-set/encore fixture (avoids building harness code that doesn't match real usage).
- **D-05: Add an offline leg.** Mid-rehearsal, flip airplane mode and confirm predictions, logging, and the constellation all still work from precache/IndexedDB — the actual venue condition and the app's core-value premise. This is an explicit added step beyond VALID-02's enumerated loop.

### VALID-02 — Device & hosting scope
- **D-06: iOS only; Android waived.** Rehearse the full loop on iPhone (primary target). No Android device available → criterion 3 is formally marked "no device available / waived" in the UAT record (VALID-02 permits "if a device is available").
- **D-07: Graded pass runs against a production build over the cloudflared tunnel.** The recorded VALID-02 pass MUST run against `vite build` → `vite preview`, exposed via the cloudflared HTTPS tunnel (`--http-host-header localhost`, per `device-uat-hosting` memory). This is required for the service-worker precache, PWA install, and the offline leg (D-05) to behave as they will at the show. The Vite **dev server over the tunnel is allowed only for informal rehearsal/bug-shaking**, never as the graded run — dev-server SW/precache does not match production.

### Evidence & gate behavior
- **D-08: `10-HUMAN-UAT.md` with enumerated steps.** Follow the established `NN-HUMAN-UAT.md` convention. VALID-01 = spot-check + sweep result. VALID-02 = the full loop broken into discrete checklist steps: start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit → **offline leg** → JSON export/import round-trip. Each step gets expected/result. Screenshots optional — attach only where a result is ambiguous.
- **D-09: Triage failures — fix blockers inline, defer cosmetic.** Anything that breaks the show loop (data loss, broken logging, failed import, offline breakage) gets fixed inside Phase 10 before it closes. Cosmetic/minor issues are logged to the backlog as deferred ideas. Show-ready = the loop works reliably, not pixel-perfect.

### Claude's Discretion
- Exact form of the VALID-01 review report (standalone CLI in `packages/core/src/cli/` vs a generated markdown artifact vs augmenting an existing CLI) — planner decides; read-only and surfacing the two things in D-01/D-02 is the requirement.
- The specific heuristics used to nominate `cs-standard`/`other` and standard/microtonal anomaly candidates — researcher/planner decides based on the catalog (album/era signals, known down-tuned tracks).
- Which ~10 songs count as the "canonical well-known" spot-check set — reuse Phase 01's examples ("Doom City" → microtonal, "12 Bar Bruise" → standard) as a starting point.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — VALID-01, VALID-02 (lines 33–34); DATA-04 origin.
- `.planning/ROADMAP.md` §"Phase 10" — success criteria (3 items) and dependency on Phases 8, 9.
- `.planning/phases/01-corpus-ingestion-schema-foundation/01-HUMAN-UAT.md` — the prior tuning spot-check that VALID-01 re-confirms and formally closes (test #1, previously passed).

### Tuning tags (VALID-01)
- `packages/core/src/ingest/tuning-tags.ts` — D-01..D-04 tuning rules, closed 4-value vocabulary (`standard`, `cs-standard`, `microtonal`, `other`), `cs-standard` never auto-assigned, append-only merge.
- `packages/core/src/cli/generate-tuning-tags.ts` — existing manual-run tag generator/merger (reference for how tags are read/written; the review report is read-only alongside it).
- `data/tuning-tags.json` — the committed owner-editable file (264 entries, `needsReview` 0, 52 hand-tagged).
- `packages/core/src/cli/build-model.ts` and `packages/core/src/cli/run-backtest.ts` — rebuild + backtest path if D-03 fires.
- `data/backtest-report.md` / `data/backtest.json` — backtest baseline to compare against for no-regression.
- `docs/SCHEMA.md` — corpus/catalog schema (tuning data context, §9).

### Dry-run harness & show loop (VALID-02)
- `packages/app/src/live/mockLatest.ts` — the `?mockLatest=1` fixture harness (sync leg).
- `packages/app/src/live/useLatestPoll.ts` — live poll path the mock swaps into.
- `packages/app/src/show/ShowView.tsx`, `useShowSession.ts`, `EndShowDialog.tsx` — the Show Mode loop (start, log, set break, encore, End Show, recap).
- `packages/app/src/settings/exportDownload.ts`, `importPicker.ts`, `ownerMatch.ts` — JSON export/import round-trip (final loop leg).

### Hosting
- Memory `device-uat-hosting` — serve over HTTPS cloudflared tunnel with `--http-host-header localhost` for iOS testing.
- Memory `sw-clientsclaim-offline` — SW `clientsClaim=true` so covers/assets serve offline on first load (relevant to the offline leg).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `?mockLatest=1` (`mockLatest.ts`): drop-in live-feed fixture — the sync leg of the dry-run needs no new code, just this flag. Fixture ids: Rattlesnake(168), Robot Stop(172), Gaia(81), Mars for the Rich(133).
- `generate-tuning-tags.ts` + `tuning-tags.ts`: pure, file-agnostic tag read/merge — the review report can reuse `deriveCatalogFromCorpus`/schema loading rather than re-parsing.
- `build-model.ts` / `run-backtest.ts`: existing CLIs for the D-03 rebuild-and-verify path.

### Established Patterns
- `NN-HUMAN-UAT.md` step-checklist is the standard evidence format across all prior phases (01, 03–08).
- Tuning families are a closed 4-value vocabulary enforced by zod; `cs-standard` is only ever hand-assigned.
- CLIs live in `packages/core/src/cli/`, Node-native TS execution, never run in CI (manual-run only, D-05 etiquette).

### Integration Points
- A VALID-01 tag change ripples: `tuning-tags.json` → `build-model` → `transition-matrix.json` → backtest. This is the only path where Phase 10 touches shipped artifacts.
- Offline leg exercises the vite-plugin-pwa precache + Dexie/IndexedDB — only faithful in a prod build (D-07).

</code_context>

<specifics>
## Specific Ideas

- Spot-check anchors from Phase 01: "Doom City" → expect `microtonal` (Flying Microtonal Banana), "12 Bar Bruise" → expect `standard`. Reuse as the seed of the ~10-song canonical set.
- Fixture already dates rows to "today" so adopting recenters the orbit with a live prediction fan — good enough to demonstrate the sync leg on-device.

</specifics>

<deferred>
## Deferred Ideas

- **Android device validation** — deferred: no Android device available. VALID-02 criterion 3 is conditional ("if a device is available"); revisit if hardware becomes available before show #1.
- **Cosmetic/minor bugs found during the dry-run** — per D-09, logged to backlog rather than fixed inline; not lost, just not blockers for the gate.
- **Staged multi-set/encore `mockLatest` fixture** — considered and rejected (D-04) as harness code that doesn't match real logging; note if a future automated E2E of the full loop is ever wanted.

</deferred>

---

*Phase: 10-pre-show-validation-device-dry-run*
*Context gathered: 2026-07-18*
