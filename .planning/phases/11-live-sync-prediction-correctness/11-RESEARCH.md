# Phase 11: Live-Sync & Prediction Correctness - Research

**Researched:** 2026-07-19
**Domain:** Correctness/bug-fix on the existing live-sync (`packages/core/src/live/*`, `packages/app/src/live/*`) and prediction (`packages/core/src/model/predict.ts`) pipelines. No new capabilities.
**Confidence:** HIGH — every finding below is grounded in the actual shipped code, cited by file + symbol. Where CONTEXT.md's hypothesis diverges from the code, the corrected finding is stated explicitly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Feed prior finalized tracked shows of the current run into `recentShowSongSets` so `rotationSuppression` fires. Root cause: `buildShowContext()` is always called with the default `recentFinalizedShowSongSets = []` (never wired at `useShowSession.ts`). Core scoring already works; only app-side context assembly is missing.
- **D-02:** "This run" is grouped **automatically by date gap** — consecutive tracked shows within a threshold form one run; a larger gap starts a fresh run. No per-show setup on the happy path.
- **D-03:** The date-gap threshold is a **tunable constant in `packages/core/src/config.ts`**; planner picks the default (~2 calendar days). Single named config value, not a scattered literal.
- **D-04:** Provide a **manual "start a fresh run" / "clear cross-night rotation" override control** in addition to auto-grouping. After reset, subsequent shows are not suppressed by pre-reset songs.
- **D-05:** Additive/unknown API fields must **not** kill the live path. Parse leniently so an unknown key leaves the row usable.
- **D-06:** **Detect + surface** drift rather than swallow it. `pollLatest` returns/exposes a drift flag to `useLatestPoll`; the app sets the SyncDot state.
- **D-07:** Consumed-field breakage is unchanged — a missing/wrong-typed *consumed* field still skips that row. Only *additive/unknown* keys switch from fatal-to-tolerated.
- **D-08:** SyncDot drift signal is a **quiet, distinct, non-blocking state** (amber "syncing — API shape changed", tap for detail). Never modal/mid-set blocker. Log drift **once**, not per-row.
- **D-09:** Guard `latestRows` before suggestions and placeholder resolution by bound `show_id` when bound, else the tracked show's own date. `trackedShow.showId != null` → keep rows where `row.show_id === trackedShow.showId`; unbound → keep rows where `row.showdate === <tracked show's date>` (NOT wall-clock today).
- **D-10:** Using the tracked show's date (not wall-clock today) makes the guard robust to a set running past midnight.
- **D-11:** Down-weighting is surfaced via the **implicit rank drop** only (no new UI). Explicit "played last night" badge deferred to Phase 13.

### Claude's Discretion
- **PRED-02 (era-prior unit mismatch):** internal model fix — correct the unit mismatch so `eraPriorFloor` is reachable. Not a user decision.
- **LIVE-02 (artist scope):** `pollLatest` already filters `artist_id !== 1`. CONFIRM scope holds across the full path; harden/verify rather than redesign.
- Exact date-gap default value (D-03) and precise SyncDot visual treatment (D-08) are planner/UI discretion within constraints.

### Deferred Ideas (OUT OF SCOPE)
- Explicit suppression reason badge / dimmed chip → Phase 13.
- Bottom-sheet animation, readable date format, share-card GizzDex totals, Couch Mode, Gizz Bingo, Guezz League — separate phases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | Night 2+ suggestions/fill-hints never offer a previous show's songs (`latestRows` date-guarded) | §LIVE-01 — new pure core guard `guardLatestRows(rows, trackedShow)`; wire in `ShowView` before `diffLatestAgainstTrail`/`resolvePlaceholders`. |
| LIVE-02 | Live `latest` poll surfaces only King Gizzard rows into suggestions/auto-bind | §LIVE-02 — VERIFIED already satisfied at the single ingress (`pollLatest` `artist_id !== 1`); harden with a regression test + doc invariant. |
| LIVE-03 | Live sync survives additive kglw.net schema changes; drift surfaced on SyncDot, not swallowed | §LIVE-03 — `catchall(z.unknown())` + a separate known-key-set diff for detection; thread a `PollResult` drift flag through `useLatestPoll` → `SyncDot`. |
| PRED-01 | Night 2+ songs already played earlier in the run are down-weighted; rotation fires on real cross-night data | §PRED-01 — wire `recentFinalizedShowSongSets` via a Dexie query + pure run-grouping fn; core `rotationSuppression` unchanged. |
| PRED-02 | Era-prior down-weights long-retired songs (unit mismatch fixed; floor reachable) | §PRED-02 — denominator unit fix in `eraPrior` (per-show career rate, not catalog marginal) + `k` rescale + `showCount` on `MatrixIndex`. |
| PRED-03 | User can reset cross-night rotation state before a new run/weekend | §PRED-01/§PRED-03 — persisted reset marker (`db.meta`) read by the run-grouping fn; auto date-gap grouping is the happy path. |
</phase_requirements>

## Summary

This is a five-bug correctness phase over a pipeline that is, structurally, already almost right. Four of the six requirements are **wiring or unit fixes to code that already exists and works in isolation**, not new subsystems:

- **PRED-01/PRED-03** — the core `rotationSuppression` fn is correct and tested; it is simply **never fed data**. `buildShowContext` accepts a `recentFinalizedShowSongSets` third parameter that `useShowSession.ts` calls with a hardcoded `[]` (`useShowSession.ts:123`). The whole fix is an app-tier Dexie query + a pure run-grouping function + a persisted reset marker.
- **PRED-02** — `eraPrior` compares two quantities in **incommensurable units** (`eraPlayCount/eraWindowShows`, a per-show rate, vs `basePlayRate`, a catalog-wide marginal probability ~100× smaller). The `k=1` smoothing then swamps both, pinning every song near 1.0 and making the `eraPriorFloor` (0.3) unreachable. **CONTEXT.md's specific hypothesis — "eraPlayCount window vs eraWindowShows divisor" — is WRONG** (they match; see §PRED-02). The real mismatch is the *denominator's* unit.
- **LIVE-01** — `diffLatestAgainstTrail` and `resolvePlaceholders` apply **no** date/show guard (`suggest.ts:67`, `:105`); a cached previous-night `latest` leaks yesterday's songs. `bindShowFromLatest` already guards binding correctly (and already uses the show's own date, `ShowView.tsx:202`), so the suggestion path just needs an equivalent, stronger (show_id-based) guard.
- **LIVE-02** — **VERIFIED already satisfied.** There is exactly one ingress of `latest` rows into the app: `pollLatest` (`poll-latest.ts:83`), which applies `parsed.data.artist_id !== 1 → continue`. Every downstream consumer (`diffLatestAgainstTrail`, `resolvePlaceholders`, `bindShowFromLatest`) reads only the already-filtered `latestRows` state (`ShowView.tsx:160-204`). No consumer receives unfiltered rows. This requirement is **harden/verify only** (regression test + documented invariant), not a fix.
- **LIVE-03** — the only requirement needing genuine design. `latestSetlistRow` is a `z.strictObject` (`latest-types.ts:36`) that rejects any novel key; `pollLatest`'s per-row `safeParse` failure logs+skips and its outer `catch {}` swallows everything, and its `Promise<LatestSetlistRow[]>` return **cannot carry a drift signal**. The design must parse leniently (tolerate additive keys) *while still detecting* that a novel key appeared, then thread that flag out.

**Primary recommendation:** Treat this as five independent, small, fixture-testable changes. Keep every decision function pure and DOM-free in `packages/core` (CLAUDE.md strict separation); the app tier only queries Dexie, wires, and renders. Add the run-gap threshold to `packages/core/src/config.ts` (D-03). Each fix gets a fixture-based regression test that would have caught the original bug (see Validation Architecture).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Artist scope filter (LIVE-02) | Core (`pollLatest`) | — | Trust boundary; already the single ingress. Keep it the *only* filter point. |
| Schema-drift tolerance + detection (LIVE-03) | Core (`latestSetlistRow` + `pollLatest`) | App (`useLatestPoll` → `SyncDot`) | Parsing/detection is pure decision logic; only the visual state + copy is app-tier. |
| Tonight date/show guard (LIVE-01) | Core (new `guardLatestRows`) | App (`ShowView` supplies `trackedShow`) | Filtering rule is pure; app owns the `TrackedShow` data + call-site. |
| Rotation suppression scoring (PRED-01) | Core (`rotationSuppression`) | — | Already correct; unchanged. |
| Run-grouping by date gap (PRED-01/02/03) | Core (new pure fn) | App (`useShowSession` Dexie query) | Grouping is decision logic → pure/testable; Dexie read is app-tier I/O. |
| Reset-run persistence (PRED-03) | App (`db.meta` marker) | Core (grouping fn consumes boundary) | Persistence is app-tier; the *rule* (exclude pre-boundary shows) is pure. |
| Era-prior unit fix (PRED-02) | Core (`eraPrior` + `MatrixIndex`) | — | Pure model math; no app involvement. |

## Standard Stack

No new dependencies. This phase uses only what is already installed and shipped:

| Library | Version (installed) | Used For | Notes |
|---------|--------------------|----------|-------|
| zod | 4.4.3 | `latestSetlistRow` lenient-but-detecting parse (LIVE-03) | Already the ingest schema lib. Use `z.object(...).catchall(z.unknown())` + a known-key diff — see §LIVE-03. |
| Dexie | 4.4.4 | Query finalized `trackedShows` + their `trackedEntries` for run-grouping (PRED-01) | Existing `trackedShows.date`/`status` indexes (`db.ts:206`) support the query directly. |
| dexie-react-hooks | 4.4.0 | `useLiveQuery` already drives `useShowSession` | Run-grouping query slots into the existing reactive layer. |
| Vitest | 4.1.10 | Fixture regression tests (core `node` project; app `jsdom` project) | All new logic is pure → core `node` tests. See Validation Architecture. |

**No `npm install` required.** No external package legitimacy audit applies (no new packages).

## Package Legitimacy Audit

Not applicable — this phase installs **no** external packages. All work is edits to existing `packages/core` and `packages/app` source plus new fixture tests.

## Architecture Patterns

### Live-path data flow (current, verified)

```
kglw.net /latest.json
   │  (one GET per ≤60s tick, app-gated)
   ▼
useLatestPoll  (packages/app/src/live/useLatestPoll.ts)   ── owns timing/lifecycle only
   │  calls
   ▼
pollLatest  (packages/core/src/live/poll-latest.ts)       ── THE SINGLE INGRESS
   │  per-row: latestSetlistRow.safeParse → skip-on-fail (console.debug)
   │  per-row: artist_id !== 1 → continue            ← LIVE-02 filter (verified sole point)
   │  returns Promise<LatestSetlistRow[]>            ← LIVE-03: cannot carry a drift flag
   ▼
onRows(rows) → setLatestRows(...)  (ShowView.tsx:160,162)  ── app state, ALREADY artist-scoped
   ├─────────────► diffLatestAgainstTrail(latestRows, entries, …)   suggest.ts:67   ← LIVE-01: NO guard
   ├─────────────► resolvePlaceholders(latestRows, entries)         suggest.ts:105  ← LIVE-01: NO guard
   └─────────────► bindShowFromLatest(latestRows, activeShow, activeShow.date)  bind-show.ts:39  ← guarded (date), OK
```

**Key insight:** because there is a single ingress (`pollLatest`) and a single downstream state (`latestRows`), both LIVE-01 (guard) and LIVE-02 (artist scope) have exactly one place to enforce. LIVE-01's guard is best applied **once** to produce a `guardedRows` value that all three consumers read, rather than duplicating the guard in each.

### Prediction pipeline (current, verified)

```
useShowSession.ts:123  buildShowContext(currentSongId, entries, [])   ← PRED-01: 3rd arg hardcoded []
   ▼
predict → scoreCandidate → base × rotation × alreadyPlayed × eraPrior × (segue override)
                                    │              │
                                    │              └─ eraPrior  predict.ts:280  ← PRED-02: unit mismatch
                                    └─ rotationSuppression  predict.ts:251  ← correct; starved of data
```

### Pattern 1: Pure guard function applied once (LIVE-01)

**What:** A new pure core fn filters `latestRows` to tonight's rows before any consumer sees them.
**When to use:** Every render where `latestRows` feeds suggestions/fill-hints/bind.
**Shape (specify in plan):**
```typescript
// packages/core/src/live/suggest.ts (or a sibling live/guard.ts)
export interface TonightGuardInput {
  showId: number | null;   // TrackedShow.showId
  date: string;            // TrackedShow.date (YYYY-MM-DD) — the show's own date, NOT wall-clock
}
/** D-09/D-10: keep only rows belonging to the tracked show.
 *  Bound → identity match on show_id (tightest). Unbound → match the show's own date. */
export function guardLatestRows(
  rows: LatestSetlistRow[],
  guard: TonightGuardInput,
): LatestSetlistRow[] {
  if (guard.showId !== null) return rows.filter((r) => r.show_id === guard.showId);
  return rows.filter((r) => r.showdate === guard.date);
}
```
Then in `ShowView.tsx`, compute `const guardedRows = guardLatestRows(latestRows, session.active)` once and pass `guardedRows` into `diffLatestAgainstTrail`, `resolvePlaceholders`, and `bindShowFromLatest`. (`session.active` is a `TrackedShow` carrying both `showId` and `date` — available at all three call sites, `ShowView.tsx:198-204`.)

### Pattern 2: Lenient-but-detecting schema (LIVE-03)

**What:** Parse tolerates unknown additive keys (row stays usable) but a separate pass detects that a novel key appeared.
**Why not `.passthrough()`/`.catchall` alone:** that tolerates unknown keys but **loses the detection signal** — the exact anti-pattern CONTEXT.md D-06 warns against.
**Shape:**
```typescript
// latest-types.ts — switch strictObject → object + catchall so unknown keys survive
export const latestSetlistRow = z.object({ /* … same 11 consumed + present keys … */ })
  .catchall(z.unknown());   // additive keys tolerated, row stays usable (D-05/D-07)

// A frozen set of every key the schema currently knows about (the 36 present keys).
export const KNOWN_LATEST_KEYS: ReadonlySet<string> = new Set([...]);

/** Pure: does this raw row carry a key we've never seen? (drift detection, D-06) */
export function detectNovelKeys(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((k) => !KNOWN_LATEST_KEYS.has(k));
}
```
Consumed-field breakage stays fatal-per-row (D-07): the 11 precisely-typed fields keep their `z.number()/z.string()/regex` validators, so a wrong-typed *consumed* field still fails `safeParse` and skips the row. Only *unknown additive* keys change from fatal → tolerated.

### Pattern 3: Result-object return to carry side-band signal (LIVE-03)

**What:** `pollLatest`'s return widens from `Promise<LatestSetlistRow[]>` to a small result object so the drift flag rides alongside the rows without exceptions.
**Shape:**
```typescript
export interface PollResult {
  rows: LatestSetlistRow[];
  schemaDrift: boolean;        // true if any row carried a novel key this poll (D-06)
  novelKeys?: string[];        // for the tap-for-detail copy (D-08); logged ONCE per poll, not per row
}
export async function pollLatest(deps?: PollDeps): Promise<PollResult> { … }
```
`useLatestPoll` then exposes `schemaDrift` to `ShowView`, which passes it to `SyncDot`. **This is a breaking signature change** — every caller/test of `pollLatest` (`useLatestPoll.ts:105`, `poll-latest.test.ts`, `useLatestPoll.test.tsx`, `mockLatest.ts`) must be updated. Alternative (smaller blast radius): keep `Promise<LatestSetlistRow[]>` and pass a `onDrift?: () => void` callback in `PollDeps`. The plan should choose; the result-object is cleaner and keeps the poller pure/synchronous-signalled. Flag as a decision for the planner.

### Pattern 4: Run-grouping by date gap (PRED-01/02/03)

**What:** A pure fn takes finalized shows (date + song set) + the current show's date + an optional reset boundary, and returns the song sets of the current run's prior shows — the `recentShowSongSets` window.
**Shape:**
```typescript
// packages/core/src/live/run-grouping.ts (new)  — pure, DOM-free
export interface FinalizedShowInput { date: string; songIds: number[]; }
/** D-02/D-03/D-04: prior finalized shows belonging to the SAME run as `currentDate`.
 *  A run breaks when consecutive shows are > runGapDays apart. Shows on/after
 *  `resetBoundaryDate` (D-04 manual reset) are excluded. Newest-first or sorted
 *  internally; returns song-id sets ready for ShowContext.recentShowSongSets. */
export function currentRunShowSets(
  finalized: FinalizedShowInput[],
  currentDate: string,
  cfg: { runGapDays: number },
  resetBoundaryDate?: string,
): number[][] { … }
```
The app (`useShowSession`) supplies `finalized` from a Dexie query (see Integration below). Core `rotationSuppression` further slices this to the last `cfg.rotationWindowShows` (`predict.ts:252`) — so run-grouping produces the *candidate* window and the existing config knob still bounds it.

### Anti-Patterns to Avoid
- **Guarding in each consumer separately (LIVE-01):** duplicating the date/show filter in `diffLatestAgainstTrail`, `resolvePlaceholders`, and `bindShowFromLatest` invites drift between them. Filter once → pass `guardedRows`.
- **`.passthrough()`/`.catchall` without a key diff (LIVE-03):** tolerates drift but destroys detection. D-06 requires both.
- **Reading wall-clock `today` for the guard (LIVE-01/D-10):** a set past midnight would reject its own rows. Use `TrackedShow.date`.
- **Recomputing `eraPlayCount` at scoring time (PRED-02):** it is baked into the frozen matrix (`matrix.ts:120`). The fix is arithmetic in `eraPrior`, not a rebuild — but it does need `showCount`, which is on the matrix header, not currently on `MatrixIndex`.
- **A second `artist_id` filter downstream (LIVE-02):** keep the single ingress. Adding redundant filters hides the invariant and risks divergence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unknown-key tolerance | Manual key allow/strip loop | zod `.catchall(z.unknown())` | Battle-tested; keeps consumed-field validation intact. |
| Date-gap arithmetic | Ad-hoc `Date` math scattered in the app | One pure `currentRunShowSets` in core + `runGapDays` in config | Testable, single home for the constant (CLAUDE.md). |
| Reactive Dexie read for finalized shows | New polling/state sync | `useLiveQuery` (already the `useShowSession` pattern) | Finalized-show set updates reactively; no manual invalidation. |

## Runtime State Inventory

This is a code/config correctness phase, not a rename/migration. However, PRED-03's reset control introduces **one new persisted item** — inventory it explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Reset boundary marker (PRED-03/D-04).** New `db.meta` row (e.g. `key: "rotationRunResetDate"` or a session-id boundary). `db.meta` is a generic k/v table (`db.ts:14`, `setMeta`/`getMeta` at `:241`). No Dexie schema version bump needed — `meta` already exists (v1) and is a free-form key space. | Add write helper (set on reset tap) + read in `useShowSession`. Included in export snapshot automatically (`snapshot()` reads all `meta`, `db.ts:497`). |
| Live service config | None — no external service stores Phase-11 state. | None. |
| OS-registered state | None. | None — verified: no Task Scheduler/pm2/launchd involvement in this phase. |
| Secrets/env vars | None. | None. |
| Build artifacts | **Possibly the frozen matrix.** PRED-02 is arithmetic in `eraPrior` reading `showCount` — if the planner instead chooses to bake an all-time-per-show rate onto `MatrixNode`, `data/normalized/transition-matrix.json` must be rebuilt and its `schemaVersion` considered. **Recommended fix avoids this** (reads `matrix.showCount`, already present in the artifact header — `matrix.ts:186`). | None if `showCount` is threaded via `MatrixIndex` (recommended). Rebuild only if node shape changes (not recommended). |

**Note on export/import (SAFE-01, Phase 12):** the reset marker lives in `meta`, which `snapshot()`/`importSnapshot` already round-trip via `bulkPut` (`db.ts:538`). No Phase-11 change to export logic is required, but the planner should confirm the marker survives a backup round-trip in a test.

## Common Pitfalls

### Pitfall 1: The era-prior test masks the production bug (PRED-02)
**What goes wrong:** `predict.test.ts:410` asserts `eraPrior` works using a 3-node fixture with total `playCount` = 120, giving `basePlayRate(HOT) ≈ 0.083`. At that tiny scale the units *accidentally* line up and the test passes. In the real 264-node matrix, `Σ playCount` is ~14,000, so `basePlayRate` is ~100× smaller and the `k=1` smoothing pins every ratio near 1.0 — the floor never fires. **A green test suite hides a dead signal in production.**
**How to avoid:** Add a regression test at **production scale** (a fixture whose `Σ playCount` reflects a realistic catalog, or assert the floor is reachable for a zero-era-play song against the shipped `transition-matrix.json`). See Validation Architecture REQ-PRED-02.
**Warning signs:** `eraPrior` returning values in [0.98, 1.5] instead of spanning [floor, ceil]; no candidate ever hitting `eraPriorFloor`.

### Pitfall 2: Drift detection that fires per-row spams the log (LIVE-03/D-08)
**What goes wrong:** Detecting novel keys inside the per-row loop logs once per row — a 25-row show floods `console.debug` and could re-trigger UI state 25×.
**How to avoid:** Aggregate novel keys across the poll; log once; set the flag once. `detectNovelKeys` is pure; the *dedupe/log-once* discipline lives in `pollLatest`'s loop (collect into a Set, log after the loop).

### Pitfall 3: Guarding with wall-clock date breaks past-midnight sets (LIVE-01/D-10)
**What goes wrong:** Using `todayIso()` (`db.ts:256`) instead of the show's stored `date` rejects the show's own rows after midnight.
**How to avoid:** The guard reads `TrackedShow.date` (the auto-stamped start date). `bindShowFromLatest` already does this correctly (`ShowView.tsx:202` passes `activeShow.date`, not `todayIso()`) — mirror it.

### Pitfall 4: Run-grouping counts the active (in-progress) show as a prior show (PRED-01)
**What goes wrong:** If the Dexie query for "finalized shows" accidentally includes the active show, tonight's own logged songs get suppressed as if from a prior night.
**How to avoid:** Query `status === "finalized"` only (`db.ts:206` `status` index), and/or exclude the active `sessionId`. The active show's in-progress trail is handled separately by `alreadyPlayedFactor` (`predict.ts:264`), not rotation.

### Pitfall 5: A dropped `PollResult` field breaks every poll test at once (LIVE-03)
**What goes wrong:** Widening `pollLatest`'s return silently breaks `poll-latest.test.ts`, `useLatestPoll.test.tsx`, `mockLatest.ts`, and the `onRows` contract in `ShowView`/`useLatestPoll`.
**How to avoid:** Treat the signature change as a small refactor task with an explicit checklist of the four call sites/tests (grep `pollLatest(` and `onRows`). Consider the `onDrift` callback alternative (Pattern 3) if the blast radius is undesirable.

## Code Examples (verified against current source)

### PRED-02 — the exact unit mismatch (predict.ts:280-288)
```typescript
export function eraPrior(B: number, index: MatrixIndex, cfg: ScoringConfig): number {
  const node = index.nodeById.get(B);
  if (!node) return 1;
  const k = cfg.eraPriorSmoothingK;               // = 1 (config.ts:157)
  const eraRate = node.eraPlayCount / cfg.eraWindowShows;  // plays-per-show, ~0..0.5
  const allTimeRate = basePlayRate(B, index);     // playCount(B)/Σ playCount — a MARGINAL, ~0.001..0.02
  const ratio = (eraRate + k) / (allTimeRate + k);// k=1 swamps both → ratio ≈ 1.0 always
  return clamp(ratio, cfg.eraPriorFloor, cfg.eraPriorCeil); // floor 0.3 UNREACHABLE
}
```
`basePlayRate` (`predict.ts:145`) = `node.playCount / Σ_all playCount`. `eraRate` is per-show; `allTimeRate` is a share-of-all-plays. Different dimensions; ~100× scale gap.

### PRED-02 — recommended fix (per-show career rate + rescaled k + showCount on index)
```typescript
// index-build.ts — add showCount (already on the matrix header, matrix.ts:186)
export interface MatrixIndex {
  edgesFrom: Map<number, MatrixEdge[]>;
  nodeById: Map<number, MatrixNode>;
  showCount: number;                       // NEW
}
export function buildMatrixIndex(matrix: TransitionMatrix): MatrixIndex {
  // …existing…
  return { edgesFrom, nodeById, showCount: matrix.showCount };  // NEW
}

// predict.ts — both sides now plays-per-show (dimensionally consistent)
export function eraPrior(B: number, index: MatrixIndex, cfg: ScoringConfig): number {
  const node = index.nodeById.get(B);
  if (!node || index.showCount <= 0) return 1;
  const k = cfg.eraPriorSmoothingK;                          // rescale to per-show units (see below)
  const eraRate = node.eraPlayCount / cfg.eraWindowShows;    // recent plays-per-show
  const allTimeRate = node.playCount / index.showCount;      // career plays-per-show  ← FIX
  const ratio = (eraRate + k) / (allTimeRate + k);
  return clamp(ratio, cfg.eraPriorFloor, cfg.eraPriorCeil);
}
```
**Why this makes the floor reachable:** for a retired song `eraRate = 0`, `ratio = k / (allTimeRate + k)`. With `k` on the per-show scale (e.g. `k ≈ 0.05`) and a common song's `allTimeRate ≈ 0.3`, `ratio ≈ 0.05/0.35 ≈ 0.14 → clamps to 0.3`. The floor now fires. **`eraPriorSmoothingK` MUST be rescaled** from `1` to a per-show value (~0.05–0.1) — `[ASSUMED]`, planner/owner picks, backtestable. Leaving `k=1` re-breaks the fix (it would again swamp per-show rates ≤ ~0.5).

**Alternative fix (marginal-vs-marginal):** make `eraRate = eraPlayCount(B) / Σ_all eraPlayCount` (a within-era marginal; `Σ eraPlayCount` is already computed in `albumEraAffinity`, `predict.ts:172`) so both sides are shares in [0,1], with `k` on the marginal scale (~0.001). Either is dimensionally valid; the per-show version is the smaller change (keeps the existing numerator) and is recommended.

### PRED-01 — the un-wired seam (useShowSession.ts:123 and showContext.ts:29)
```typescript
// useShowSession.ts:123 — 3rd arg hardcoded [], so rotation can never fire cross-night
const ctx = buildShowContext(currentSongId, entries, []);
// showContext.ts:26 — the seam already exists and threads straight to ShowContext
export function buildShowContext(
  currentSongId: number,
  entries: readonly TrackedEntry[],
  recentFinalizedShowSongSets: number[][] = [],   // ← feed this
): ShowContext { … recentShowSongSets: recentFinalizedShowSongSets }
```
Fix (app tier): a `useLiveQuery` reads finalized shows + their entries + the reset marker, calls `currentRunShowSets(...)`, and passes the result as the third arg. Core scoring is untouched.

### PRED-01 — Dexie query shape (available indexes verified, db.ts:206)
```typescript
// finalized shows, newest-first, excluding the active session
const finalizedShows = await db.trackedShows
  .where("status").equals("finalized")   // status index exists (db.ts:206)
  .toArray();                            // then sort by date desc in JS
// each show's song set:
const entries = await db.trackedEntries
  .where("sessionId").equals(show.sessionId)   // sessionId index exists (db.ts:209)
  .toArray();                                   // songIds = entries.filter(e=>e.songId!=null)
```

## State of the Art

Not applicable — no library/framework currency question. The stack is pinned and current per CLAUDE.md. All findings are internal-code facts.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rescaled `eraPriorSmoothingK ≈ 0.05–0.1` (per-show) makes the floor reachable without over-penalizing rare songs | PRED-02 | If too large, floor stays dead; if too small, sparse songs get noisy. Backtestable; owner-tunable. Flag at human-verify gate. |
| A2 | Run-gap default `runGapDays ≈ 2` calendar days correctly groups a residency run while separating a distinct weekend | PRED-01/D-03 | Wrong value mis-groups runs (a rest night splits a run, or two weekends merge). Manual reset (D-04) is the safety valve. |
| A3 | Reset boundary is best stored as a single `db.meta` row (date or boundary session-id) | PRED-03/D-04 | If a session-id boundary is chosen instead of a date, the grouping fn signature differs. Either works; planner picks. |
| A4 | `pollLatest` return should widen to a `PollResult` object (vs an `onDrift` callback) | LIVE-03 | Wider blast radius on tests; the callback alternative is documented as fallback. |
| A5 | The per-show fix (playCount/showCount) is preferred over the marginal-vs-marginal fix | PRED-02 | Both valid; if backtest prefers the marginal form, switch. Low risk — isolated to `eraPrior`. |

## Open Questions (RESOLVED)

All three were resolved and adopted by the Phase 11 plans; only tunable values remain flagged for the human-verify/backtest gate.

1. **What is the correct `runGapDays` default (D-03)?**
   - Known: Aug 2026 residency is 3-night runs; owner said "you decide"; ~2 days tolerates one rest night.
   - Unclear: whether any real run has a 2-night internal gap (would need `runGapDays ≥ 3`).
   - Recommendation: default `2`, single named config constant, surfaced at the human-verify gate; the manual reset (D-04) covers mis-groupings either way.
   - **RESOLVED:** adopted `runGapDays = 2` in `config.ts` (plan 11-03); `[ASSUMED]` value flagged for the backtest/human-verify gate.

2. **Reset marker: date boundary vs session-id boundary (D-04/A3)?**
   - Known: `db.meta` is the natural home; both are one row.
   - Recommendation: a date boundary (`rotationRunResetDate`) — simplest for the pure grouping fn (`resetBoundaryDate?: string`) and human-readable in an export.
   - **RESOLVED:** adopted the date boundary — `rotationRunResetDate` in `db.meta`, read by the pure grouping fn (plans 11-03 core, 11-05 Settings control).

3. **`pollLatest` return: widen to `PollResult` vs `onDrift` callback (LIVE-03/A4)?**
   - Recommendation: `PollResult` object — keeps the poller pure and the signal explicit; accept the four-call-site test update as a bounded refactor task.
   - **RESOLVED:** adopted the `PollResult` object (`{ rows, schemaDrift }`) in plan 11-02; the four call-site updates are bounded tasks in 11-02/11-04.

## Environment Availability

Not applicable — no new external tools/services/runtimes. All work runs under the existing Node ≥24.12 + Vitest toolchain already used by the repo.

## Validation Architecture

This is a correctness phase; every fix MUST ship with a fixture test that would have caught the original bug. `nyquist_validation` is not disabled → this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, `projects` config (core `node` env, app `jsdom` env) — CLAUDE.md |
| Config file | root `vitest.config.ts` (`test.projects: ['packages/*']`) |
| Quick run command | `npx vitest run packages/core/test/model/predict.test.ts` (single file) |
| Full suite command | `npx vitest run` (all projects) |
| Existing core tests | `packages/core/test/model/predict.test.ts`, `packages/core/test/suggest.test.ts`, `packages/core/test/bind-show.test.ts`, `packages/core/test/poll-latest.test.ts` |
| Existing app tests | `packages/app/test/useLatestPoll.test.tsx`, `packages/app/test/adopt.test.tsx`, `packages/app/test/mockLatest.test.ts` |

### Phase Requirements → Test Map
| Req | Behavior to pin | Test type | File (new/edit) |
|-----|-----------------|-----------|-----------------|
| LIVE-01 | Bound show: rows with `show_id !== trackedShow.showId` filtered out. Unbound: rows with `showdate !== trackedShow.date` filtered out. Past-midnight: show's own date rows retained. | unit | `packages/core/test/suggest.test.ts` (or new `guard.test.ts`) — new `guardLatestRows` cases |
| LIVE-02 | A fixture `latest` payload mixing `artist_id: 1` and `artist_id: 4` (Stu Mackenzie, SCHEMA §9) → `pollLatest` returns only the `artist_id: 1` rows; downstream `diffLatestAgainstTrail` never sees a foreign row. | unit | `packages/core/test/poll-latest.test.ts` — add a mixed-artist regression case (verify the invariant, don't just re-test the existing filter) |
| LIVE-03 | (a) A row with an extra unknown key parses and stays usable (D-05/D-07). (b) The same row sets `PollResult.schemaDrift = true` and lists the novel key (D-06). (c) A row with a wrong-typed *consumed* field still skips (D-07 unchanged). (d) Drift logged once, not per-row. | unit | `packages/core/test/poll-latest.test.ts` + a `latest-types` detection test |
| PRED-01 | With `recentShowSongSets` fed from prior-run shows, a song played last night scores strictly lower and ranks below an equivalent un-played song. Run-grouping: a >gap show is excluded. | unit | `packages/core/test/model/predict.test.ts` (rotation already has Test at :380) + new `run-grouping.test.ts` |
| PRED-02 | A zero-`eraPlayCount` (retired) song at **production scale** returns `eraPriorFloor` (or ≤ a value near it), NOT ~1.0. A currently-hot song exceeds 1.0. Replace/augment the fixture-scale Test 10 (:392). | unit | `packages/core/test/model/predict.test.ts` — rewrite Test 10 at realistic scale + add floor-reachability assertion |
| PRED-03 | After a reset boundary is set, `currentRunShowSets` excludes pre-boundary shows → those songs are no longer suppressed. | unit | `packages/core/test/run-grouping.test.ts` (new) |

### Sampling Rate
- **Per task commit:** the single affected core test file (e.g. `npx vitest run packages/core/test/model/predict.test.ts`).
- **Per wave merge:** `npx vitest run` (both projects) — the `pollLatest` signature change ripples into app tests, so run the full suite after LIVE-03.
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/test/run-grouping.test.ts` — new, covers PRED-01/PRED-03 grouping + reset boundary.
- [ ] Rewrite `predict.test.ts` Test 10 (era prior) at production scale — the current fixture-scale test **passes on the buggy code** and must not be trusted as-is (Pitfall 1).
- [ ] Extend `poll-latest.test.ts` with mixed-artist (LIVE-02) + additive-key drift (LIVE-03) cases.
- [ ] A `guardLatestRows` test (LIVE-01) — bound/unbound/past-midnight.
- [ ] Update `poll-latest.test.ts`, `useLatestPoll.test.tsx`, `mockLatest.ts` for the widened `pollLatest` return (if `PollResult` is chosen).
- [ ] Framework install: none — Vitest already configured.

## Security Domain

`security_enforcement` not disabled → included. This phase sits on the kglw.net → core trust boundary (untrusted volunteer-run API + untrusted editor content).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (existing, preserve) |
|---------------|---------|---------------------------------------|
| V5 Input Validation | **yes** | zod `latestSetlistRow` validates every consumed field at the boundary (`latest-types.ts`). LIVE-03 must **loosen unknown-key handling without loosening consumed-field validation** (D-07) — the 11 typed validators stay strict. |
| V5 Injection / untrusted content | **yes** | `songname`/`venuename` are untrusted editor content (SCHEMA §12), carried verbatim, **never rendered in core**. LIVE-03's drift-detail copy (D-08) must show *key names*, never raw editor values, to avoid surfacing untrusted content. |
| V7 Error Handling / logging | **yes** | `pollLatest` never surfaces stack traces (T-05-04); drift log is a single `console.debug` with key names only. Keep the never-throw contract (a crash mid-set is the failure mode this tool exists to avoid, `poll-latest.ts:11`). |
| V2/V3/V4/V6 (auth/session/access/crypto) | no | No accounts, no backend, no secrets in this phase. |

### Known Threat Patterns for the live path
| Pattern | STRIDE | Standard Mitigation (verify preserved) |
|---------|--------|----------------------------------------|
| Foreign-band / wrong-show injection via `latest` (Stu Mackenzie solo set, SCHEMA §9) | Spoofing/Tampering | `artist_id !== 1` filter at the single ingress (LIVE-02) + tonight date/show guard (LIVE-01). Both must hold together. |
| Malicious/malformed additive field crashing the poller | Denial of Service | Never-throw `pollLatest` + lenient parse (LIVE-03); a novel key can never empty suggestions or throw. |
| Untrusted editor string rendered as HTML | Tampering (XSS) | Verbatim carry; React JSX escaping; drift detail shows key *names* only (D-08). Never `dangerouslySetInnerHTML` (SCHEMA §12). |
| Silent filter-ignore returning the entire multi-artist table (SCHEMA §9) | Tampering | Client-side `artist_id` filter is mandatory regardless of endpoint — already enforced; keep it the sole, documented invariant. |

## Per-Requirement Implementation-Readiness Summary

| Req | Root cause (verified) | Fix locus | Tier | Readiness |
|-----|----------------------|-----------|------|-----------|
| **LIVE-01** | `diffLatestAgainstTrail` (`suggest.ts:67`) & `resolvePlaceholders` (`suggest.ts:105`) apply no date/show guard; cached prior-night `latest` leaks. | New pure `guardLatestRows(rows, {showId,date})` in core; call once in `ShowView` before all three consumers. Uses `TrackedShow.date` (not wall-clock, D-10). | Core + thin app wire | **READY.** Data (`session.active.showId`/`.date`) available at call site (`ShowView.tsx:198`). |
| **LIVE-02** | **No bug.** Single ingress `pollLatest` filters `artist_id !== 1` (`poll-latest.ts:83`); no downstream consumer sees unfiltered rows. | Harden only: mixed-artist regression test + documented "single ingress" invariant. | Core (test only) | **READY — verify/harden, not fix.** CONTEXT.md's "may already be satisfied" confirmed TRUE. |
| **LIVE-03** | `latestSetlistRow` is `z.strictObject` (`latest-types.ts:36`) → rejects novel keys; `pollLatest` per-row skip + outer `catch {}` swallow; `Promise<LatestSetlistRow[]>` can't carry a flag. | `z.object().catchall(z.unknown())` + `detectNovelKeys` + widen return to `PollResult{rows,schemaDrift,novelKeys}`; thread through `useLatestPoll` → `ShowView` → new amber `SyncDot` state + tap-detail copy. | Core (parse/detect) + app (SyncDot state) | **READY, most work.** One design choice to lock: `PollResult` object vs `onDrift` callback (A4). Breaking signature → 4 call-site/test updates (Pitfall 5). |
| **PRED-01** | `buildShowContext` 3rd arg hardcoded `[]` at `useShowSession.ts:123`; `rotationSuppression` (`predict.ts:251`) is correct but starved. | App `useLiveQuery` reads finalized `trackedShows` + entries; pure `currentRunShowSets(...)` groups by `runGapDays`; pass as 3rd arg. Core scoring unchanged. | App query + new core pure fn | **READY.** Dexie indexes (`status`, `sessionId`) exist (`db.ts:206-209`). |
| **PRED-02** | `eraPrior` (`predict.ts:284-285`) compares per-show `eraRate` to catalog-marginal `basePlayRate` (incommensurable, ~100×); `k=1` swamps both → floor 0.3 unreachable. **CONTEXT.md's "window vs divisor" hypothesis is WRONG** (window matches divisor; `matrix.ts:95` builds `eraPlayCount` over exactly `eraWindowShows` shows). | `allTimeRate = playCount / index.showCount` (add `showCount` to `MatrixIndex`); rescale `eraPriorSmoothingK` to per-show (~0.05–0.1). No matrix rebuild. | Core (`eraPrior` + `MatrixIndex`) | **READY.** `showCount` is on the matrix header (`matrix.ts:186`). Must rewrite the masking fixture test (Pitfall 1). `k` value is `[ASSUMED]` (A1). |
| **PRED-03** | No reset mechanism exists; rotation state is purely derived. | Persist a reset boundary in `db.meta` (`rotationRunResetDate`); `currentRunShowSets` excludes on/after it; add a manual reset control (app UI). Auto date-gap grouping (D-02) is the happy path. | App (`db.meta` marker + control) + core (grouping honors boundary) | **READY.** `meta` is a free-form k/v table (`db.ts:14`); no schema bump; round-trips in export (`db.ts:497`). |

**Overall:** all six requirements are implementation-ready with no unresolved blockers. The only genuine design decisions for the planner are (A4) `pollLatest` return shape, (A1) the rescaled `eraPriorSmoothingK` value, (A2) the `runGapDays` default, and (A3) date-vs-session-id reset boundary — all bounded, all documented above with recommendations.

## Sources

### Primary (HIGH confidence — verified in-repo this session)
- `packages/core/src/model/predict.ts` (`eraPrior` :280, `rotationSuppression` :251, `basePlayRate` :145, `scoreCandidate` :433) — PRED-01/PRED-02 root causes.
- `packages/core/src/config.ts` (`eraWindowShows` :154, `eraPriorSmoothingK` :157, `eraPriorFloor` :160, `rotationWindowShows` :133) — the constants + where `runGapDays` must live.
- `packages/core/src/model/matrix.ts` (`eraPlayCount` build :95-120, `showCount`/`asOfDate` header :185-187) — disproves CONTEXT.md's window-vs-divisor hypothesis; confirms `showCount` availability.
- `packages/core/src/model/index-build.ts` — `MatrixIndex` lacks `showCount` (the one-line addition PRED-02 needs).
- `packages/core/src/live/suggest.ts` (`diffLatestAgainstTrail` :67, `resolvePlaceholders` :105) — LIVE-01: no guard.
- `packages/core/src/live/bind-show.ts` (`bindShowFromLatest` :39) — existing date-guard pattern to mirror.
- `packages/core/src/live/poll-latest.ts` (artist filter :83, per-row skip :74, outer catch :88, return type :52) — LIVE-02 (verified sole ingress) + LIVE-03 root cause.
- `packages/core/src/ingest/latest-types.ts` (`z.strictObject` :36, key enumeration :53-77) — LIVE-03 strict-schema drift bug.
- `packages/app/src/show/showContext.ts` (`buildShowContext` :26, `recentFinalizedShowSongSets` default :29) + `packages/app/src/show/useShowSession.ts` (`buildShowContext(...,[])` :123) — PRED-01 un-wired seam.
- `packages/app/src/show/ShowView.tsx` (poll wire :160-162, suggestions :180, fillHints :190, auto-bind :199-204) — LIVE-01 call sites + LIVE-02 downstream path.
- `packages/app/src/live/useLatestPoll.ts` (`pollLatest` call :105, `onRows` contract :57) + `packages/app/src/live/SyncDot.tsx` — LIVE-03 threading target.
- `packages/app/src/db/db.ts` (`meta` table :14/:241, `trackedShows` indexes :206, `trackedEntries` :209, `snapshot` :497, `todayIso` :256) — PRED-01/PRED-03 persistence + query substrate.
- `packages/core/test/model/predict.test.ts` (era-prior Test 10 :392-430, rotation test :380) — the masking fixture (Pitfall 1).
- `docs/SCHEMA.md` §9 (multi-artist/silent-filter-ignore :167), §11 (5 omitted keys :186), §12 (untrusted editor content :196) — trust-boundary basis for LIVE-01/02/03.
- `packages/core/src/index.ts` — public barrel (where new exports register: `guardLatestRows`, `currentRunShowSets`, `PollResult`).

### Secondary (MEDIUM confidence)
- `.planning/phases/11-live-sync-prediction-correctness/11-CONTEXT.md` — the 11 locked decisions; verified/corrected against code above.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 11 — requirement definitions + success criteria.

## Metadata

**Confidence breakdown:**
- LIVE-01 (guard): HIGH — no-guard confirmed in source; guard shape + call-site verified.
- LIVE-02 (artist scope): HIGH — single ingress + no unfiltered downstream consumer verified by tracing every call site.
- LIVE-03 (drift): HIGH on root cause; MEDIUM on the return-shape decision (A4, two valid options).
- PRED-01 (rotation wiring): HIGH — hardcoded `[]` confirmed; Dexie indexes verified.
- PRED-02 (era-prior unit): HIGH on the mismatch + why the floor is dead; MEDIUM on the exact rescaled `k` (A1, backtestable).
- PRED-03 (reset): HIGH — `meta` substrate verified; boundary representation is a bounded choice (A3).

**Research date:** 2026-07-19
**Valid until:** stable — findings are internal-code facts, valid until the cited files change. Re-verify if `predict.ts`, `poll-latest.ts`, `latest-types.ts`, or `useShowSession.ts` are edited before planning.
