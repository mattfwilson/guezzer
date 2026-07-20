---
phase: 14-gizz-bingo-core-marking-generation
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/core/src/bingo/types.ts
  - packages/core/src/bingo/prng.ts
  - packages/core/src/bingo/context.ts
  - packages/core/src/bingo/wins.ts
  - packages/core/src/bingo/mark.ts
  - packages/core/src/bingo/generate.ts
  - packages/core/src/cli/bingo-calibrate.ts
  - packages/core/src/config.ts
  - packages/core/src/index.ts
  - packages/core/test/bingo/prng.test.ts
  - packages/core/test/bingo/context.test.ts
  - packages/core/test/bingo/wins.test.ts
  - packages/core/test/bingo/mark.test.ts
  - packages/core/test/bingo/generate.test.ts
  - packages/core/test/bingo/calibrate.test.ts
  - packages/core/test/config.test.ts
  - packages/core/test/fixtures/bingo/synthetic.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-20
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 14 delivers the pure-core bingo subsystem (types + zod schema, seeded PRNG, `buildBingoContext`, win geometry, the consume-once `deriveMarks` fold, the seeded `deal` generator, and the calibration-gate CLI). The code is strong on the hard constraints this phase exists to satisfy:

- **Core purity / determinism verified.** No `Math.random`, `Date.now`, `new Date`, `window`, or `document` in any `src/bingo` file (the only hit is a comment). All randomness flows through the seeded xmur3+mulberry32 PRNG.
- **Calibration gate is genuinely green.** I ran `bingo-calibrate.ts` over the real 241-show corpus: exit code 0, and a fresh run produced zero artifact drift — confirming the `config.bingo.vibes` bands and `assertCalibrationInvariants` thresholds are consistent (the 2026-07-20 retarget landed correctly) and that the report is byte-reproducible.
- **All 46 bingo/config unit tests pass**, including the `live == replay == catch-up` property test and the same-seed reproducibility test.
- **Schema/type agreement** is enforced at compile time via the bidirectional cross-check assignments in `types.ts`.
- **No secrets, no injection surfaces.** The CLI reads only committed JSON and escapes catalog prose before markdown emission.

No blocking defects were found. The findings below are a latent robustness gap in the generator's never-blank fallback (unreachable with the shipped ~250-song corpus but real for degenerate inputs and untested), a project-convention violation on scattered constants in the CLI, and minor defensive/dead-code notes.

## Warnings

### WR-01: `deal` never-blank fallback silently emits DUPLICATE squares on a small catalog

**File:** `packages/core/src/bingo/generate.ts:211-219`
**Issue:** When the weighted-selection loop drains all pools before reaching `fillCount` (song catalog smaller than the ~15 fill slots), the top-up loop cycles `filler[i % filler.length]` and re-pushes squares that were already dealt. `filler = buildSongSquares(ctx)` is a *fresh full list*, so songs already `shift()`-ed into `chosen` reappear. I confirmed this with a 5-song context: the dealt card contained `song:10, song:11, song:12, song:13, song:14` each **twice**. The module header claims completeness ("no holes") but says nothing about distinctness, and `bingoCardSchema` does not reject duplicate squares — so a duplicate-laden card passes validation. In the bone-dry case (`allSongs.length === 0`) the fallback is 15 identical `opener` event squares. Not reachable with the shipped corpus (the real `ctx` carries ~250 nodes, so `song` weight ≥ 1 keeps the loop alive until `fillCount` and no top-up runs), but it is an unguarded correctness gap for any thin/degenerate `ctx`, and it is silently accepted rather than caught.
**Fix:** Dedupe the top-up against `chosen`, or draw filler from the not-yet-used remainder. Minimal version — track used identities and skip:
```ts
const usedSongIds = new Set(
  chosen.flatMap((d) => (d.kind === "song" ? [d.songId] : [])),
);
const fresh = allSongs.filter((d) => d.kind === "song" && !usedSongIds.has(d.songId));
const filler: BingoSquareDef[] = fresh.length > 0 ? fresh : allSongs.length > 0 ? allSongs : [eventDefs.opener];
```
If duplicate squares are genuinely acceptable degeneracy, assert distinctness in `bingoCardSchema` (or explicitly document that the never-blank guarantee permits duplicates) so the contract is honest.

### WR-02: Calibration model constants hardcoded in the CLI instead of `config.ts`

**File:** `packages/core/src/cli/bingo-calibrate.ts:38,41,42,59`
**Issue:** CLAUDE.md is explicit: "All model constants ... in a single config file — no scattered magic numbers." Four model/scope constants live as `bingo-calibrate.ts` module literals instead of `config.bingo`: `LINE_TARGET_TOLERANCE = 0.05` (line 38), `ALBUM_SET_FIRE_RATE = 0.53` (line 41), `ALBUM_MIN_FIRE_RATE = 0.2` (line 42), and `RECENT_ERA_MIN_YEAR = 2022` (line 59). `ALBUM_MIN_FIRE_RATE` (0.2) is a semantic duplicate of `config.bingo.darkSquareFloor` (0.2) — if the floor is retuned, the album-candidate threshold silently won't track it. The code comment on line 34-37 even concedes `LINE_TARGET_TOLERANCE` "may be promoted to config." These are exactly the "scattered magic numbers" the constraint forbids.
**Fix:** Move all four into `config.bingo` (e.g. `lineTargetTolerance`, `albumSetFireRate`, `albumMinFireRate`, `recentEraMinYear`) and have `ALBUM_MIN_FIRE_RATE` reference `config.bingo.darkSquareFloor` so the ≥20% floor has one home.

## Info

### IN-01: `deriveMarks` trusts `card.freeIndex` without a bounds guard

**File:** `packages/core/src/bingo/mark.ts:126`
**Issue:** `marked[card.freeIndex].markedByPosition = FREE_SENTINEL` will throw an opaque `TypeError` (`Cannot set properties of undefined`) if `freeIndex` is out of `[0,15]`. Cards from `deal` and from `bingoCardSchema.parse` are safe, but `deriveMarks` is a public barrel export the Phase-16 app will call on persisted rows; a card loaded from Dexie without re-validation would crash unclearly instead of failing at the trust boundary.
**Fix:** Either document that callers must pass schema-validated cards, or guard: `if (card.freeIndex < 0 || card.freeIndex >= card.squares.length) throw new Error(...)`. Note the schema currently constrains `freeIndex` only indirectly (via the `superRefine` free-cell match) — adding `.min(0).max(15)` there would also close it.

### IN-02: Trail construction omits the sentinel filter that the songId set applies

**File:** `packages/core/src/cli/bingo-calibrate.ts:596-609`
**Issue:** `showToCalibration` nulls a trail entry only on `perf.isPlaceholder`, but the parallel `songIds` set additionally excludes `config.sentinelSongIds`. So a non-placeholder sentinel performance would enter the marking trail while being absent from the fire-rate song set — an asymmetry that could let the "Unknown" sentinel spuriously satisfy a predicate. Empirically harmless today: I checked the corpus and all 28 occurrences of `songId === 1` carry `isPlaceholder: true` (0 non-placeholder, 0 in the recent era), so they are already nulled. The safety therefore rests on the unstated invariant "sentinel ⇒ placeholder," which this function does not enforce.
**Fix:** For symmetry and future-proofing, null sentinels in the trail too: `songId: perf.isPlaceholder || sentinels.has(perf.songId) ? null : perf.songId`.

### IN-03: Reserved-but-unused parameters (dead inputs)

**File:** `packages/core/src/bingo/context.ts:96,99`; `packages/core/src/cli/bingo-calibrate.ts:514,517`
**Issue:** `buildBingoContext` takes `archive` and immediately `void archive`s it (`corpusGap` comes from `rarity`); `buildRosterCandidates` takes `cfg` and `void cfg`s it. Both are documented as "reserved for quartet parity," but they remain dead parameters that force callers to thread an unused artifact and could mask a future wiring mistake (a caller passing the wrong archive would never be detected).
**Fix:** Acceptable as-is given the documentation, but consider dropping the params until actually consumed, or add a lightweight shape assertion so the "parity" argument is at least validated rather than ignored.

### IN-04: `deal` never-blank resilience test asserts completeness but not distinctness

**File:** `packages/core/test/bingo/generate.test.ts:83-93`; `packages/core/src/bingo/generate.ts:110`
**Issue:** The "bone-dry" test checks 16 squares, no holes, and schema-parse success, but never asserts squares are distinct — which is exactly why WR-01 (duplicate top-up) ships unnoticed. Separately, `buildAlbumSquares` sets an album square's display `label` to the raw `albumUrl` (`generate.ts:110`), so album squares would render "/albums/kg" as their label; cosmetic and a Phase-16 concern, but worth a note since labels are frozen at deal time.
**Fix:** Add a distinctness assertion to the resilience test (`new Set(keys).size === keys.length` for the non-free cells) to pin the intended behavior once WR-01 is resolved; resolve the album-label placeholder when the UI lands.

---

_Reviewed: 2026-07-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
