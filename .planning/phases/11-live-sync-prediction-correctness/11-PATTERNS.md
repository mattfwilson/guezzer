# Phase 11: Live-Sync & Prediction Correctness - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 13 (6 core src, 4 app src, 3 test)
**Analogs found:** 13 / 13 (every new/modified file has a strong in-repo analog — this is a correctness phase over shipped code)

All analogs are internal to this repo. No external/reference patterns needed — every fix mirrors an existing, tested idiom in `packages/core` or `packages/app`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/live/suggest.ts` (add `guardLatestRows`) | utility (pure decision) | transform / request-response | `packages/core/src/live/bind-show.ts` `bindShowFromLatest` | exact (same role: date/show-guarded row filter over `LatestSetlistRow[]`) |
| `packages/core/src/ingest/latest-types.ts` (lenient parse + `KNOWN_LATEST_KEYS` + `detectNovelKeys`) | model/schema | transform / validation | itself (existing `latestSetlistRow` strictObject) + `packages/core/src/live/suggest.ts` (pure-fn idiom) | exact (in-place loosen + sibling pure detector) |
| `packages/core/src/live/poll-latest.ts` (widen return → `PollResult`, per-poll drift aggregation) | service (I/O boundary) | request-response / streaming poll | itself (existing `pollLatest` never-throw loop) | exact (same fn, widened return) |
| `packages/core/src/live/run-grouping.ts` **(NEW)** `currentRunShowSets` | utility (pure decision) | transform / batch | `packages/core/src/live/suggest.ts` `diffLatestAgainstTrail` | exact (new pure DOM-free fn, minimal re-declared input shape) |
| `packages/core/src/model/predict.ts` (fix `eraPrior`) | model (scoring math) | transform | itself (existing `eraPrior` :280) + `basePlayRate` :145 | exact (arithmetic-only change) |
| `packages/core/src/model/index-build.ts` (add `showCount` to `MatrixIndex`) | model | transform | itself (existing `buildMatrixIndex`) | exact (one-field additive) |
| `packages/core/src/config.ts` (add `runGapDays`; rescale `eraPriorSmoothingK`) | config | n/a | existing `rotationWindowShows`/`eraPriorSmoothingK` constants :133-157 | exact |
| `packages/core/src/index.ts` (register new exports) | config (barrel) | n/a | existing `suggest.ts`/`bind-show.ts` export blocks :121-134 | exact |
| `packages/app/src/show/showContext.ts` (thread `recentFinalizedShowSongSets`) | provider (context assembly) | transform | itself (seam already exists :29) | exact — seam already built |
| `packages/app/src/show/useShowSession.ts` (Dexie query for finalized shows + run-grouping) | hook | CRUD (Dexie read) / event-driven | itself (existing `useLiveQuery` blocks :62-77) | exact (add a 3rd/4th live query) |
| `packages/app/src/live/useLatestPoll.ts` (accept + expose `schemaDrift`) | hook | streaming poll | itself (existing poll lifecycle) | exact (widen `onRows` contract) |
| `packages/app/src/live/SyncDot.tsx` (amber drift state) | component | request-response | itself (existing online/offline dot) | exact (add a 3rd visual state) |
| App reset control (D-04) → `db.meta` write helper | store (persistence) | CRUD | `packages/app/src/db/db.ts` `setMeta`/`getMeta` :241-247 | exact |
| `packages/core/test/**` (new + edited fixtures) | test | n/a | `packages/core/test/poll-latest.test.ts`, `predict.test.ts` Test 10 :392 | exact |

## Pattern Assignments

### `packages/core/src/live/suggest.ts` — add `guardLatestRows` (LIVE-01, utility, transform)

**Analog:** `packages/core/src/live/bind-show.ts` `bindShowFromLatest` — the existing date-guard that the suggestion path must mirror (and strengthen to `show_id`).

**Minimal-input-shape idiom** (bind-show.ts:21-24) — re-declare the app's `TrackedShow` projection locally, never import from app:
```typescript
/** Minimal projection of the app's `TrackedShow` (db.ts) the binder needs. */
export interface TrackedShowInput {
  showId: number | null;
}
```
Mirror this for the guard (RESEARCH §Pattern 1):
```typescript
export interface TonightGuardInput {
  showId: number | null;   // TrackedShow.showId
  date: string;            // TrackedShow.date (YYYY-MM-DD) — the show's OWN date, NOT wall-clock
}
```

**Guard pattern** (bind-show.ts:39-49) — the exact date-match discipline to strengthen:
```typescript
export function bindShowFromLatest(
  latestRows: LatestSetlistRow[],
  trackedShow: TrackedShowInput,
  todayIso: string,
): ShowBinding | null {
  if (latestRows.length === 0) return null;
  if (trackedShow.showId !== null) return null;
  const head = latestRows[0];
  if (head.showdate !== todayIso) return null;   // ← the guard to mirror
  ...
}
```
`guardLatestRows` strengthens this to an identity match when bound, falling back to the show's own date when unbound (RESEARCH shape, D-09/D-10):
```typescript
export function guardLatestRows(rows: LatestSetlistRow[], guard: TonightGuardInput): LatestSetlistRow[] {
  if (guard.showId !== null) return rows.filter((r) => r.show_id === guard.showId);
  return rows.filter((r) => r.showdate === guard.date);   // show's date, never wall-clock (D-10)
}
```

**Filter-loop idiom already in this file** (suggest.ts:80-93) — `diffLatestAgainstTrail` sorts/filters `latestRows` the same way; keep `guardLatestRows` structurally consistent (sort not needed, pure filter).

**Anti-pattern (RESEARCH):** do NOT guard inside each of the three consumers (`diffLatestAgainstTrail` suggest.ts:67, `resolvePlaceholders` suggest.ts:105, `bindShowFromLatest`). Filter once in `ShowView`, pass one `guardedRows`.

---

### `packages/core/src/ingest/latest-types.ts` — lenient-but-detecting schema (LIVE-03, model/schema)

**Analog:** the file itself. Current `z.strictObject` (:36) rejects novel keys — the drift bug.

**Current strict schema** (latest-types.ts:36) — the 11 precisely-typed consumed fields (:37-48) MUST keep their exact validators (D-07); only the container mode changes:
```typescript
export const latestSetlistRow = z.strictObject({
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  song_id: z.number().int(),
  songname: z.string(), // untrusted editor content — carry verbatim, never render (SCHEMA §12)
  ...
});
```

**Fix (RESEARCH §Pattern 2):** `z.strictObject(...)` → `z.object(...).catchall(z.unknown())` so additive keys survive (row stays usable, D-05/D-07), then add a frozen known-key set + a pure detector alongside — the same "sibling pure fn in the schema module" placement the file already uses (`formatRowError` re-export :87):
```typescript
export const latestSetlistRow = z.object({ /* same 11 consumed + present keys */ }).catchall(z.unknown());

export const KNOWN_LATEST_KEYS: ReadonlySet<string> = new Set([ /* the ~36 enumerated keys */ ]);

/** Pure: does this raw row carry a key we've never seen? (drift detection, D-06) */
export function detectNovelKeys(raw: Record<string, unknown>): string[] {
  return Object.keys(raw).filter((k) => !KNOWN_LATEST_KEYS.has(k));
}
```
The header comment (:14-23) already documents WHY every present key is enumerated — update it: enumeration now feeds `KNOWN_LATEST_KEYS` for detection rather than `strictObject` rejection.

**Anti-pattern (RESEARCH):** `.catchall`/`.passthrough` WITHOUT the key diff — tolerates drift but destroys the detection signal D-06 requires. Both are mandatory.

**Security (V5, RESEARCH §Security):** the 11 consumed validators stay strict — a wrong-typed *consumed* field still fails `safeParse` and skips the row (D-07). `detectNovelKeys` returns key *names* only, never values (untrusted editor content, SCHEMA §12).

---

### `packages/core/src/live/poll-latest.ts` — widen to `PollResult`, aggregate drift once (LIVE-03, service)

**Analog:** the file itself — the never-throw tolerant loop.

**Current per-row loop + return** (poll-latest.ts:71-92) — the structure to widen:
```typescript
const validated: LatestSetlistRow[] = [];
for (const raw of rawRows) {
  const parsed = latestSetlistRow.safeParse(raw);
  if (!parsed.success) {
    console.debug(`pollLatest: skipping malformed latest row — ${formatRowError(parsed.error, raw)}`);
    continue;
  }
  if (parsed.data.artist_id !== 1) continue;   // LIVE-02 sole ingress — KEEP as only filter point
  validated.push(parsed.data);
}
return validated;      // ← Promise<LatestSetlistRow[]> cannot carry a drift flag
```

**Fix (RESEARCH §Pattern 3):** widen the return to a result object; aggregate novel keys across the whole poll (log ONCE after the loop, not per-row — Pitfall 2):
```typescript
export interface PollResult {
  rows: LatestSetlistRow[];
  schemaDrift: boolean;      // true if any row carried a novel key this poll (D-06)
  novelKeys?: string[];      // tap-for-detail copy (D-08); logged ONCE per poll
}
export async function pollLatest(deps: PollDeps = defaultDeps): Promise<PollResult> { ... }
```
Inside the loop, collect `detectNovelKeys(raw)` into a `Set<string>`; emit a single `console.debug` after the loop; return `{ rows: validated, schemaDrift: novel.size > 0, novelKeys: [...novel] }`.

**Preserve the never-throw contract** (poll-latest.ts:88-92, ASVS V7) — the outer `catch {}` still returns a valid `PollResult` (e.g. `{ rows: [], schemaDrift: false }`), never a stack trace. A crash mid-set is the failure mode this tool exists to avoid (:11).

**Breaking-signature checklist (Pitfall 5)** — every caller/test of `pollLatest(` must update:
- `packages/app/src/live/useLatestPoll.ts:105` (`const rows = await pollLatest(...)`)
- `packages/core/test/poll-latest.test.ts` (asserts on the array return, :36-38 etc.)
- `packages/app/test/useLatestPoll.test.tsx`
- `packages/app/src/live/mockLatest.ts` (if it stubs the shape)
- barrel `packages/core/src/index.ts:121` — add `type PollResult`

---

### `packages/core/src/live/run-grouping.ts` **(NEW)** — `currentRunShowSets` (PRED-01/02/03, utility)

**Analog:** `packages/core/src/live/suggest.ts` `diffLatestAgainstTrail` (:67-95) — a new pure, DOM-free decision fn with a minimal re-declared input shape and a plain filter/collect loop.

**Header idiom to copy** (suggest.ts:1-28) — the "pure decision, zero DOM, re-declare the app's shape locally to keep core app-free" doc block, and:
```typescript
export interface TrailEntryInput {   // suggest.ts:24 — the local-projection idiom
  position: number;
  songId: number | null;
  isPlaceholder: boolean;
}
```
Mirror for run-grouping (RESEARCH §Pattern 4):
```typescript
// packages/core/src/live/run-grouping.ts — pure, DOM-free
export interface FinalizedShowInput { date: string; songIds: number[]; }

/** D-02/D-03/D-04: prior finalized shows in the SAME run as `currentDate`.
 *  A run breaks when consecutive shows are > cfg.runGapDays apart. Shows on/after
 *  `resetBoundaryDate` (manual reset, D-04) are excluded. Returns song-id sets
 *  ready for ShowContext.recentShowSongSets. */
export function currentRunShowSets(
  finalized: FinalizedShowInput[],
  currentDate: string,
  cfg: { runGapDays: number },
  resetBoundaryDate?: string,
): number[][] { ... }
```

**Config-threading idiom** — like `rotationSuppression` (predict.ts:251) takes `cfg` and reads a named constant; run-grouping takes `{ runGapDays }` from `config.ts`, never a literal (CLAUDE.md).

**Downstream contract:** `rotationSuppression` (predict.ts:252) already slices to `cfg.rotationWindowShows` — so `currentRunShowSets` produces the *candidate* window; the existing knob bounds it. No change to `rotationSuppression`.

**Anti-pattern (RESEARCH Pitfall 4):** exclude the active in-progress show from `finalized` (that trail is handled by `alreadyPlayedFactor` predict.ts:264, not rotation).

**Barrel:** register `currentRunShowSets` + `FinalizedShowInput` in `index.ts` beside the suggest exports (:123-129).

---

### `packages/core/src/model/predict.ts` — fix `eraPrior` (PRED-02, model math)

**Analog:** the function itself (:280) + `basePlayRate` (:145).

**Current bug** (predict.ts:280-288) — per-show `eraRate` vs catalog-marginal `allTimeRate` (incommensurable, ~100× gap; `k=1` swamps both, floor 0.3 unreachable):
```typescript
export function eraPrior(B: number, index: MatrixIndex, cfg: ScoringConfig): number {
  const node = index.nodeById.get(B);
  if (!node) return 1;
  const k = cfg.eraPriorSmoothingK;                        // = 1 (config.ts:157)
  const eraRate = node.eraPlayCount / cfg.eraWindowShows;  // plays-per-show
  const allTimeRate = basePlayRate(B, index);              // MARGINAL share — WRONG UNIT
  const ratio = (eraRate + k) / (allTimeRate + k);
  return clamp(ratio, cfg.eraPriorFloor, cfg.eraPriorCeil);
}
```

**Fix (RESEARCH §PRED-02, recommended per-show form)** — both sides plays-per-show; `k` rescaled to per-show:
```typescript
export function eraPrior(B: number, index: MatrixIndex, cfg: ScoringConfig): number {
  const node = index.nodeById.get(B);
  if (!node || index.showCount <= 0) return 1;
  const k = cfg.eraPriorSmoothingK;                        // rescale 1 → ~0.05–0.1 (A1)
  const eraRate = node.eraPlayCount / cfg.eraWindowShows;  // recent plays-per-show
  const allTimeRate = node.playCount / index.showCount;    // career plays-per-show ← FIX
  const ratio = (eraRate + k) / (allTimeRate + k);
  return clamp(ratio, cfg.eraPriorFloor, cfg.eraPriorCeil);
}
```
Note the `clamp` helper (predict.ts:236) is unchanged. **`eraPriorSmoothingK` MUST be rescaled** (config.ts:157) or the fix re-breaks (A1).

**Anti-pattern (RESEARCH):** do NOT recompute `eraPlayCount` at scoring time — it's baked into the frozen matrix (matrix.ts). The fix is arithmetic + threading `showCount`; no matrix rebuild.

---

### `packages/core/src/model/index-build.ts` — add `showCount` to `MatrixIndex` (PRED-02, model)

**Analog:** the file itself — a one-field additive change.

**Current** (index-build.ts:10-32):
```typescript
export interface MatrixIndex {
  edgesFrom: Map<number, MatrixEdge[]>;
  nodeById: Map<number, MatrixNode>;
}
export function buildMatrixIndex(matrix: TransitionMatrix): MatrixIndex {
  ...
  return { edgesFrom, nodeById };
}
```
**Fix:** add `showCount: number;` to the interface and `showCount: matrix.showCount` to the return. `showCount` already exists on the matrix header (matrix.ts:186 `showCount: shows.length`) — no rebuild, no schema bump.

**Test impact:** `predict.test.ts` Test 10 (:400-407) hand-builds a `MatrixIndex` literal WITHOUT `showCount` — that literal must gain `showCount` (and the era-prior test must be rewritten at production scale anyway — see below).

---

### `packages/core/src/config.ts` — `runGapDays` + rescale `eraPriorSmoothingK` (PRED-01/02/03, config)

**Analog:** the existing `[ASSUMED]`-annotated constant block (:132-163).

**Existing constant idiom to copy** (config.ts:132-136):
```typescript
/** [ASSUMED] M3/A4 (02-RESEARCH.md), MODL-06: number of most-recent shows ... */
rotationWindowShows: 3,
/** [ASSUMED] M3/A4 (02-RESEARCH.md), MODL-06: per-show multiplicative penalty ... */
rotationPenaltyPerShow: 0.5,
```
Add `runGapDays` in the same annotated style (D-03, default ~2, A2). Retune `eraPriorSmoothingK` (:157) from `1` to ~0.05–0.1 with an updated comment noting the per-show rescale (A1). Single named values — no scattered literals (CLAUDE.md).

---

### `packages/app/src/show/showContext.ts` + `useShowSession.ts` — wire cross-night window (PRED-01/03, provider + hook)

**Analog:** both files themselves — the seam is already built.

**`buildShowContext` seam** (showContext.ts:26-37) — the 3rd param already threads to `recentShowSongSets`; nothing to change here, just stop passing `[]`:
```typescript
export function buildShowContext(
  currentSongId: number,
  entries: readonly TrackedEntry[],
  recentFinalizedShowSongSets: number[][] = [],   // ← feed this
): ShowContext {
  return { currentSongId, trail: ..., recentShowSongSets: recentFinalizedShowSongSets };
}
```

**The un-wired call site** (useShowSession.ts:123):
```typescript
const ctx = buildShowContext(currentSongId, entries, []);   // ← 3rd arg hardcoded []
```

**`useLiveQuery` idiom to copy** (useShowSession.ts:62-77) — add finalized-shows + reset-marker live queries in the exact same reactive style:
```typescript
const active = useLiveQuery(() =>
  db.trackedShows.where("status").equals("active").first(),
);
const entries = useLiveQuery(
  () => active
    ? db.trackedEntries.where("sessionId").equals(active.sessionId).sortBy("position")
    : Promise.resolve<TrackedEntry[]>([]),
  [active?.sessionId],
) ?? [];
```
New query (RESEARCH §PRED-01, indexes verified db.ts:206-209):
```typescript
const finalizedShows = useLiveQuery(() =>
  db.trackedShows.where("status").equals("finalized").toArray(),   // status index exists
);
// per show: db.trackedEntries.where("sessionId").equals(show.sessionId).toArray()
// then songIds = entries.filter(e => e.songId != null)
// resetBoundary = await getMeta<string>("rotationRunResetDate")
```
Feed `currentRunShowSets(finalized, active.date, config.runGapDays, resetBoundary)` as the 3rd arg to `buildShowContext` (:123). Core scoring untouched.

**Note the gating discipline** (useShowSession.ts:90-119) — predictions only run past the `currentSongId !== null` guard; keep the new query outside/before that guard (it's independent of the current song).

---

### `packages/app/src/live/useLatestPoll.ts` — expose `schemaDrift` (LIVE-03, hook)

**Analog:** the file itself — the poll lifecycle.

**Current consumption** (useLatestPoll.ts:57-59, 105-107) — the `onRows` contract to widen:
```typescript
export function useLatestPoll(
  active: { sessionId: string } | undefined,
  onRows: (rows: LatestSetlistRow[]) => void,   // ← widen or add a drift channel
): void { ... }
...
const rows = await pollLatest({ fetch: mockLatestFetch ?? boundFetch });
if (cancelled) return;
onRowsRef.current(rows);   // ← now receives PollResult.rows; surface .schemaDrift too
```
**Fix:** destructure the `PollResult`; pass `result.rows` to `onRows` and surface `result.schemaDrift`/`novelKeys` (e.g. a second callback or a widened `onRows(result)`). Keep the `onRowsRef` stable-identity idiom (:65-69) and the tolerant `catch {}` (:110-112) intact.

---

### `packages/app/src/live/SyncDot.tsx` — amber drift state (LIVE-03/D-08, component)

**Analog:** the file itself — a two-state status glyph to extend to three.

**Current two-state render** (SyncDot.tsx:22-46):
```typescript
interface SyncDotProps {
  online: boolean;   // filled green when true, hollow ring when false
}
const ONLINE_GREEN = "#22C55E"; // hit-green
const MUTED = "#A1A1AA";        // text-muted offline ring
export function SyncDot({ online }: SyncDotProps) {
  ...
  <span role="status" aria-label={online ? "Sync: online" : "Sync: offline"}
    style={{ backgroundColor: online ? ONLINE_GREEN : "transparent",
             boxShadow: online ? undefined : `inset 0 0 0 1px ${MUTED}` }} />
}
```
**Fix (D-08):** add a `schemaDrift?: boolean` prop and a THIRD amber state ("syncing — API shape changed", tap for detail). Follow the existing discipline: a distinct color constant with a WCAG ≥3:1 justification comment (the file documents this rule :16-17), a distinct `aria-label`, non-blocking (never a modal/banner). The existing header explicitly forbids miss-red/accent-gold for online/offline — amber is a NEW, distinct token; document it the same way the `ONLINE_GREEN` override is documented (:9-18).

---

### App reset control + `db.meta` marker (PRED-03/D-04, store)

**Analog:** `packages/app/src/db/db.ts` `setMeta`/`getMeta` (:241-247) — the generic k/v helpers, and the `MetaRow` free-form table (:14-18).

**Existing helpers to reuse verbatim** (db.ts:241-247):
```typescript
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
```
Reset writes `setMeta("rotationRunResetDate", <boundary date>)` (A3 recommends a date boundary over a session-id). No Dexie schema bump — `meta` exists since v1. The marker round-trips in export automatically (`snapshot()` reads all `meta`, db.ts:497 per RESEARCH). Add a test confirming the marker survives a backup round-trip.

---

## Shared Patterns

### Strict core/UI separation (applies to ALL core files)
**Source:** `packages/core/src/live/suggest.ts:1-28`, `bind-show.ts:21-24`
**Apply to:** `guardLatestRows`, `currentRunShowSets`, `detectNovelKeys`, `eraPrior`
Every decision/transform fn is pure and DOM-free; the app's `TrackedShow`/`TrackedEntry` shapes are RE-DECLARED locally as minimal input interfaces (`TrailEntryInput`, `TrackedShowInput`), never imported from `packages/app`. Core `tsconfig` has no DOM lib — a `window`/React import is a build error.
```typescript
/** Minimal projection of the app's `TrackedShow` (db.ts) the binder needs. */
export interface TrackedShowInput { showId: number | null; }
```

### All model constants in config.ts (no scattered literals)
**Source:** `packages/core/src/config.ts:132-163`
**Apply to:** `runGapDays`, retuned `eraPriorSmoothingK`, any date-gap arithmetic
Every tunable is a single named `config` value with an `[ASSUMED] <ref>, <REQ-ID>:` comment (CLAUDE.md). Functions take `cfg` and read the named constant — see `rotationSuppression(B, ctx, cfg)` predict.ts:251.

### Never-throw at the kglw.net trust boundary (ASVS V7)
**Source:** `packages/core/src/live/poll-latest.ts:52-92`
**Apply to:** `pollLatest` (widened), `latestSetlistRow` parse, `detectNovelKeys`
Any soft failure yields a valid empty result, never a throw/stack trace; a single `console.debug` at most. The widened `PollResult` return must preserve this — the outer `catch {}` returns `{ rows: [], schemaDrift: false }`.

### Consumed-field validation stays strict; only unknown keys loosen (ASVS V5)
**Source:** `packages/core/src/ingest/latest-types.ts:37-48`
**Apply to:** the LIVE-03 schema change
The 11 typed validators (`z.number().int()`, `z.string().regex(...)`) are unchanged (D-07); only the container mode (`strictObject` → `object().catchall`) changes. Drift detail surfaces key *names* only, never untrusted editor values (`songname`/`venuename`, SCHEMA §12).

### Reactive Dexie read via useLiveQuery (no hand-synced state)
**Source:** `packages/app/src/show/useShowSession.ts:62-80`
**Apply to:** the finalized-shows + reset-marker reads (PRED-01/03)
Dexie is the single source of truth; `useLiveQuery` re-derives everything reactively — no manual invalidation, no `useState` mirror.

### Fixture-based core test idiom
**Source:** `packages/core/test/poll-latest.test.ts:11-25`, `predict.test.ts:392-430`
**Apply to:** every new/edited test
`makeRow(overrides)` builds off a committed real sample (`latest.sample.json`); `vi.fn` mock fetch; hand-built `MatrixIndex` literals for pure-fn tests (no I/O). Each fix ships a regression test that would have caught the original bug.

## No Analog Found

None. Every file has a strong in-repo analog — this phase modifies or directly parallels shipped, tested code.

The two NEW artifacts both have exact idiom analogs:
- `packages/core/src/live/run-grouping.ts` → mirrors `suggest.ts` (pure decision fn + local input shape).
- `packages/core/test/run-grouping.test.ts` → mirrors `poll-latest.test.ts` / `predict.test.ts` fixture idiom.

## Metadata

**Analog search scope:** `packages/core/src/{live,ingest,model}`, `packages/core/src/config.ts`, `packages/core/src/index.ts`, `packages/app/src/{show,live,db}`, `packages/core/test`
**Files scanned:** 13 read in full/targeted + barrel/db grep
**Pattern extraction date:** 2026-07-19
