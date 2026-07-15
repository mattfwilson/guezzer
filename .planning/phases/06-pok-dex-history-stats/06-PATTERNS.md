# Phase 6: Pokédex, History & Stats - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 36 new/modified files (grouped into 14 pattern assignments)
**Analogs found:** 33 / 36 (3 files have no in-repo analog — see §No Analog Found)

Every new capability in this phase has a proven in-repo idiom. The codebase is unusually consistent: pure core fns mirroring `model/matrix.ts`, CLIs mirroring `cli/build-model.ts`, tolerant fetches mirroring `live/poll-latest.ts`, views mirroring `SettingsView`/`SearchSheet`, and Dexie writes mirroring `db.ts` helpers. Copy patterns, don't invent.

## File Classification

### New core files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/core/src/dex/derive-dex.ts` | pure derivation | batch/transform | `packages/core/src/model/matrix.ts` | exact |
| `packages/core/src/dex/rarity.ts` | pure derivation | transform | `packages/core/src/model/matrix.ts` + `config.ts` constants idiom | exact |
| `packages/core/src/dex/recap.ts` | pure derivation | transform | `packages/core/src/model/matrix.ts` (accumulation) + `data-safety/serialize.ts` (snapshot input shape) | role-match |
| `packages/core/src/dex/albums.ts` | pure derivation (build-time consumed) | batch/transform | `packages/core/src/model/matrix.ts` | exact |
| `packages/core/src/dex/archive-types.ts` | zod schema + types | validation | `packages/core/src/data-safety/export-schema.ts` | exact |
| `packages/core/src/dex/search-archive.ts` | fuse.js wrapper | request-response (pure fn) | `packages/core/src/search/search-catalog.ts` | exact |
| `packages/core/src/dex/compare.ts` | pure diff (read-only) | transform | `packages/core/src/data-safety/merge.ts` (keying/dedupe machinery, INVERTED: never merges) | role-match |
| `packages/core/src/dex/recent-shows.ts` | tolerant online fetch | request-response | `packages/core/src/live/poll-latest.ts` + `ingest/validate.ts` + `cli/fetch-corpus.ts` (endpoint shape) | exact |
| `packages/core/src/cli/build-archive.ts` | CLI (build-time artifact) | file-I/O | `packages/core/src/cli/build-model.ts` | exact |
| `packages/core/src/cli/build-albums.ts` | CLI (build-time artifact) | file-I/O | `packages/core/src/cli/build-model.ts` | exact |

### Modified core files

| Modified File | Change | Pattern Source | Match Quality |
|---------------|--------|----------------|---------------|
| `packages/core/src/data-safety/export-schema.ts` | envelope v2: `owner` + `archiveShows` rows | its own existing strictObject rows | self |
| `packages/core/src/data-safety/merge.ts` | `MIGRATIONS[1]` (v1→v2) | its own wired-but-empty MIGRATIONS chain (lines 43, 98-108) | self |
| `packages/core/src/data-safety/serialize.ts` | carry v2 fields | its own verbatim-passthrough idiom | self |
| `packages/core/src/config.ts` | rarity thresholds, archive/albums artifact paths | its own `search:` sub-object idiom (lines 172-187) | self |
| `packages/core/src/index.ts` | export dex module surface | its own per-phase barrel blocks | self |

### New app files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/app/src/dex/DexView.tsx` | view (route root) | request-response (reactive read) | `packages/app/src/settings/SettingsView.tsx` (scrolling view) + `ShowView.tsx` (view-state switching) | role-match |
| `packages/app/src/dex/useDexStats.ts` (or similar hook) | reactive derivation hook | event-driven (liveQuery) | `packages/app/src/show/useShowSession.ts` | exact |
| `packages/app/src/dex/archive.ts` + `dexAlbums.ts` loaders | bundled-artifact loader | file-I/O (JSON module) | `packages/app/src/show/matrix.ts` + `matrix-artifact.d.ts` + `vite.config.ts` alias | exact |
| `packages/app/src/dex/AlbumGrid.tsx`, `AlbumDetail.tsx`, `SongRow.tsx`, `TierBadge.tsx`, `DexHeader.tsx` | presentational components | request-response | `SettingsView.tsx` sections + `PredictionOrb.tsx` (dumb component contract) | role-match |
| `packages/app/src/dex/ShowsList.tsx` | list view segment | request-response | `SearchSheet.tsx` result rows (lines 116-127) | role-match |
| `packages/app/src/dex/ArchiveBrowser.tsx` | search/browse overlay | request-response | `packages/app/src/show/SearchSheet.tsx` | exact |
| `packages/app/src/dex/RecapView.tsx` | overlay/view-state view | request-response | `EndShowDialog.tsx` (sheet idiom) + ShowView view-state (Pattern 6) | role-match |
| `packages/app/src/dex/CompareView.tsx` | view (in-memory data, zero writes) | transform display | `SettingsView.tsx` import-result rendering (lines 99-123) | role-match |
| `packages/app/src/dex/shareCard.ts` | canvas draw + share/download | file-I/O | `packages/app/src/settings/exportDownload.ts` (never-throw + anchor fallback) | role-match |
| `packages/app/src/show/FabMenu.tsx` | component (replaces ActionBar) | event-driven (callbacks) | `packages/app/src/show/ActionBar.tsx` (supersedes; keep callback props + `.action-bar` CSS scope) | exact |
| `packages/app/scripts/fetch-covers.ts` | build-time paced fetcher | file-I/O + network | `packages/core/src/cli/fetch-corpus.ts` (pacing/UA/fail-loud) + `cli/build-model.ts` (isMain) | exact |

### Modified app files

| Modified File | Change | Pattern Source | Match Quality |
|---------------|--------|----------------|---------------|
| `packages/app/src/db/db.ts` | `version(4)` `archiveShows` table + retro mark/unmark helpers | its own `version(3)` (lines 180-200) + `startShow` txn idiom (lines 235-263) | self |
| `packages/app/src/settings/importPicker.ts` | compare-vs-merge fork on `envelope.owner` | its own `pickAndImport` (fork BEFORE `importSnapshot`, line 50) | self |
| `packages/app/src/settings/SettingsView.tsx` | owner-name field (meta row) | its own `useLiveQuery(getMeta)` idiom (lines 36-39) | self |
| `packages/app/src/components/InstallBanner.tsx` + `pwa/install/useInstallState.ts` | once-per-version gating (D-22) | `EndShowDialog.tsx` `PERSIST_WARNING_SHOWN` meta-flag idiom (lines 38-69) | exact |
| `packages/app/src/show/PredictionOrb.tsx` | orb label fit (D-21) | its own truncate span (lines 75-77) replaced by a pure `fitOrbLabel` helper + config constants (per `orbitLayout.ts` pure-helper idiom) | self |
| `packages/app/src/show/ShowView.tsx` | recap view-state + FAB swap | its own state pattern (`endOpen`, lines 70-75) — recap state MUST render before the `!session.active` early return (line 163) | self |
| `packages/app/src/show/EndShowDialog.tsx` | trigger recap on confirm | its own `handleConfirm` (lines 77-81) | self |
| `packages/app/src/App.tsx` | mount DexView at `#/dex` | its own route switch (lines 47-53) | self |
| `packages/app/src/config.ts` | `SCHEMA_VERSION: 2`, dex/fab/orb constants, all Phase-6 copy | its own `show:`/`live:`/`copy:` sub-object structure | self |
| `packages/app/vite.config.ts` | `@archive`/`@dexAlbums` aliases (+`sharp` devDep, cover assets) | its own `@matrix` alias (lines 28-39) | self |

### Tests

| New Test | Analog | Match Quality |
|----------|--------|---------------|
| `packages/core/test/dex/*.test.ts` (derive-dex, rarity, albums, recap, search-archive, share-stats, archive-artifact) | `packages/core/test/search-catalog.test.ts` (fixture-with-known-output) + `test/merge.test.ts` (snapshot factory fns) | exact |
| `packages/core/test/dex/recent-shows.test.ts` | `packages/core/test/poll-latest.test.ts` / `test/fetch.test.ts` (injected `deps.fetch`) | exact |
| `packages/app/test/retroMark.test.ts`, `importFork.test.ts` | `packages/app/test/db.test.ts` (fake-indexeddb roundtrip) | exact |
| `packages/app/test/fabMenu.test.tsx` (replaces `actionBar.test.tsx`) | `packages/app/test/actionBar.test.tsx` (handler-spy wiring) | exact |
| `packages/app/test/shareCard.test.tsx`, `installBannerVersion.test.tsx`, `showsList.test.tsx`, `orbLabelFit.test.ts` | `actionBar.test.tsx` render idiom + `db.test.ts` meta idiom | role-match |

## Pattern Assignments

### 1. `packages/core/src/dex/derive-dex.ts`, `rarity.ts`, `recap.ts`, `albums.ts` (pure derivation, batch/transform)

**Analog:** `packages/core/src/model/matrix.ts` — the canonical "pure module, one top-level fn, Map-keyed accumulation, explicit sort comparators, zero I/O" shape (its own header, lines 1-7, says exactly this).

**Module header + imports pattern** (`matrix.ts` lines 1-18):
```typescript
/**
 * D-07/D-08/D-09/D-10: pure derivation of the frozen `TransitionMatrix`
 * artifact from an already-normalized corpus. Zero I/O — performs no
 * network/disk access, reads only what the caller passes in. Mirrors
 * `ingest/census.ts`'s "pure module, one top-level fn, Map-keyed
 * accumulation, explicit sort comparators" shape.
 */
import { config } from "../config.ts";
import type { ... } from "../domain/types.ts";
```

**Signature pattern — config injected with default, options object** (`matrix.ts` lines 75-80):
```typescript
export function buildMatrix(
  corpus: NormalizedCorpus,
  asOf: AsOfBound,
  cfg: typeof config = config,
  options: BuildMatrixOptions = {},
): TransitionMatrix {
```
`deriveDex(snapshot, archive, albums, cfg = config)` should follow this exactly. Per RESEARCH Pattern 1, the snapshot parameter is the SAME `ExportSnapshot` shape from `serialize.ts` (lines 28-33) — that's what makes the compare view run `deriveDex` twice (yours + friend's) with zero DB reads.

**Map-keyed accumulation + explicit sort** (`matrix.ts` lines 98-121, 156-166):
```typescript
const nodes = new Map<number, NodeAccumulator>();
for (const show of shows) {
  for (const performance of performances) {
    if (performance.isPlaceholder || sentinelIds.includes(performance.songId)) continue;
    let node = nodes.get(performance.songId);
    if (!node) { node = { songId: ..., playCount: 0, ... }; nodes.set(performance.songId, node); }
    node.playCount += 1;
  }
}
const matrixNodes: MatrixNode[] = [...nodes.values()]
  .map((node): MatrixNode => ({ ... }))
  .sort((a, b) => a.songId - b.songId);
```
Note the sentinel exclusion (`cfg.sentinelSongIds`, line 81/108) — dex derivation must apply the same exclusion everywhere (RESEARCH Pitfall 4).

**Deduped attendance identity** — reuse `merge.ts`'s `attendanceGroupKey` idiom (line 46-48) for tracked∪retro dedupe (RESEARCH Pattern 2 / Pitfall 6):
```typescript
/** Stable grouping key for same-show dedupe (D-11): bound → by show_id, unbound → by date. */
function attendanceGroupKey(show: ExportEnvelope["trackedShows"][number]): string {
  return show.showId != null ? `id:${show.showId}` : `date:${show.date}`;
}
```

**Rarity thresholds in config** — mirror `core/config.ts`'s `search:` sub-object idiom (lines 172-187): a `dex:` (or `rarity:`) block of `[ASSUMED]`-annotated tunables (quantile boundaries, `RARITY_MIN_PLAYS`), each with a doc comment naming its research source, never hardcoded in `rarity.ts`.

---

### 2. `packages/core/src/dex/archive-types.ts` (zod schema for the archive artifact + archiveShows rows)

**Analog:** `packages/core/src/data-safety/export-schema.ts`

**strictObject row schema pattern** (lines 26-38):
```typescript
import { z } from "zod";

/** Attendance stub keyed by the stable 10-digit `show_id` (mirrors db.ts `AttendedShow`). */
export const attendedShowRow = z.strictObject({
  show_id: z.number().int(),
  showDate: z.string(),
});
```

**Type inference as single source of truth** (line 93):
```typescript
export type ExportEnvelope = z.infer<typeof exportEnvelope>;
```

**Critical contract to copy** (export-schema.ts header, lines 17-25): enum-pinned string unions (`z.enum(["1","2","e"])` etc.) MUST stay assignable to db.ts's `Table<...>` row types — the archive `sets[].n: "1"|"2"|"e"` field and the new `archiveShows` row shape are pinned across the core/app boundary the same way, and `tsc --noEmit` is the gate. RESEARCH Pattern 4 mandates schema + serialize + merge + db.ts + exportDownload/importPicker move in ONE plan.

The bundled `archive.json`/`dex-albums.json` artifacts also carry `schemaVersion: 1` headers mirroring `TransitionMatrix` (matrix.ts lines 182-191).

---

### 3. `packages/core/src/dex/search-archive.ts` (fuse.js wrapper)

**Analog:** `packages/core/src/search/search-catalog.ts` — copy nearly wholesale.

**Build-once, query-many searcher factory** (lines 49-68):
```typescript
export function makeCatalogSearcher(
  catalog: CatalogEntry[],
): (query: string) => SearchResult[] {
  const fuse = new Fuse(catalog, {
    keys: ["songName"],
    threshold: config.search.threshold,
    distance: config.search.distance,
    ignoreLocation: true,
    includeScore: true,
  });

  return (query: string): SearchResult[] =>
    query.trim() === ""
      ? []
      : fuse.search(query).map((result) => ({ ... }));
}
```
For shows: `keys: ["date", "venue", "city"]`, empty query short-circuits to `[]` (never a whole-archive dump — same rationale, line 45-47). Year-browse is a plain filter/sort, not fuse. Tunables go in `config.search`-style sub-object.

---

### 4. `packages/core/src/dex/recent-shows.ts` (online fallback fetch)

**Analog:** `packages/core/src/live/poll-latest.ts` (failure policy) + `ingest/validate.ts` (filter assert) + `cli/fetch-corpus.ts` (endpoint shape).

**Injected-deps + tolerant-never-throw pattern** (`poll-latest.ts` lines 33-43, 52-93):
```typescript
export interface PollDeps {
  fetch: typeof globalThis.fetch;
}
const defaultDeps: PollDeps = { fetch: globalThis.fetch };

export async function pollLatest(deps: PollDeps = defaultDeps): Promise<LatestSetlistRow[]> {
  try {
    const res = await deps.fetch(`${config.apiBase}${config.latestPath}`, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    });
    if (!res.ok) return [];                    // soft failure — never throw
    const body = (await res.json()) as ApiEnvelope;
    if (body.error) return [];
    const rawRows = Array.isArray(body.data) ? body.data : [];
    const validated: LatestSetlistRow[] = [];
    for (const raw of rawRows) {
      const parsed = latestSetlistRow.safeParse(raw);
      if (!parsed.success) { console.debug(`...skipping malformed row...`); continue; }
      if (parsed.data.artist_id !== 1) continue;  // T-05-02 artist scope
      validated.push(parsed.data);
    }
    return validated;
  } catch {
    return [];   // network reject, timeout, JSON blowup — all soft
  }
}
```

**Endpoint + filter assert** (`fetch-corpus.ts` lines 149-155):
```typescript
const endpoint = `setlists/showyear/${year}`;
const rawRows = await fetchJson(`/${endpoint}.json`, deps);
// ...validate rows...
assertFilterApplied(validated, endpoint, { field: "showyear", expected: year });
```
`assertFilterApplied` is `ingest/validate.ts` lines 15-30 — reuse, don't reimplement. CAUTION (RESEARCH Pitfall 9): the `User-Agent` header is inert in browsers — copy the header line for consistency but the real client-side etiquette is behavioral (user-initiated, one GET per session, soft-fail-never-retry per `pollLatest`). Note D-09 requires zod row validation via the existing ingest schemas (`ingest/api-types.ts` / `latest-types.ts` idiom).

---

### 5. `packages/core/src/dex/compare.ts` (friend-file diff — read-only)

**Analog:** `packages/core/src/data-safety/merge.ts` — same keying machinery, INVERTED output (diff lists, never a merged snapshot).

Reuse the identity keys (merge.ts lines 46-53): `attendanceGroupKey` for shows, `songId` for sightings (NEVER song name — matrix has duplicate names "Bit"×3, "Jam"×2, "Ghost"×2 per RESEARCH). The recommended shape per RESEARCH Pattern 1: run `deriveDex` on both snapshots and diff the outputs — `compareDexes(mine, theirs) → { onlyMine, onlyTheirs, shared, ... }`. Pure, zero writes by construction.

---

### 6. `packages/core/src/cli/build-archive.ts` + `build-albums.ts` (build-time artifact CLIs)

**Analog:** `packages/core/src/cli/build-model.ts` — copy structure exactly (its own header says it mirrors `normalize-corpus.ts`; this is the third copy).

**Thin wrapper + exported run fn** (lines 70-100):
```typescript
export async function runBuildModel(
  options: Partial<BuildModelCliOptions> = {},
): Promise<BuildModelCliResult> {
  const opts: BuildModelCliOptions = { ...defaultOptions(), ...options };
  const corpus = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
  // ... call the PURE fn (buildMatrix) ...
  await mkdir(dirname(opts.outPath), { recursive: true });
  // Stable 2-space formatting + trailing newline — makes `git diff` the review mechanism.
  await writeFile(opts.outPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
  return { matrix };
}
```

**Deterministic provenance** (lines 85-93): reuse the input's own `generatedAt` rather than wall-clock — two runs against the same committed input emit byte-identical artifacts.

**isMain guard + summary** (lines 143-155):
```typescript
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runBuildModel(options);
    console.log(formatBuildModelSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
```
Paths come from `core/config.ts` (`corpusArtifactPath`/`matrixArtifactPath` idiom, lines 71/99) — add `archiveArtifactPath`/`dexAlbumsArtifactPath` there. Per D-15/A5, `build-albums` should print the tier histogram / mapping counts in its summary (the `formatBuildModelSummary` slot). RESEARCH recommends `build-albums` also carry a drift-guard test asserting every allowlist `album_url` exists in albums.json.

---

### 7. Envelope v2: `export-schema.ts` + `merge.ts` + `serialize.ts` + `db.ts` + `exportDownload.ts` + `importPicker.ts` (ONE plan — pinned types)

**Analog:** the files' own existing structure; the migration chain was built for exactly this.

**MIGRATIONS slot** (`merge.ts` line 43 + loop lines 98-108):
```typescript
const MIGRATIONS: Array<(e: ExportEnvelope) => ExportEnvelope> = [];
// v2 change (RESEARCH-verified shape):
// const MIGRATIONS = [ ..., (e) => ({ ...e, owner: null, archiveShows: [] }) ];  // v1→v2 at index... 
```
Note the chain is indexed by SOURCE version: `MIGRATIONS[n]` upgrades version n → n+1, and index 0 is unused (no v0) — RESEARCH's example uses `[1]` as the v1→v2 slot with a placeholder at `[0]`. The newer-version rejection (lines 90-96) already protects old apps from v2 files.

**New schema fields** — mirror existing row style (`export-schema.ts` lines 46-56): `owner: z.string().max(N).nullable()` (length clamp per ASVS V5) on the envelope; `archiveShowRow` as a new strictObject; both added to `exportEnvelope` (lines 83-90). Bump `packages/app/src/config.ts` `dataSafety.SCHEMA_VERSION` 1 → 2 (line 87).

**serialize** — extend verbatim-passthrough (`serialize.ts` lines 43-55); `archiveShows` passes through like `attendedShows`, `owner` is read from the meta table by the app caller (`exportDownload.ts` lines 37-53 assembles the snapshot).

---

### 8. `packages/app/src/db/db.ts` — `version(4)` + retro mark/unmark helpers

**Analog:** its own version history and write helpers.

**Additive version(4)** — mirror version(2) (lines 167-170); no `.upgrade` needed (new table only, RESEARCH Pattern 3):
```typescript
// Version 3 for reference (lines 180-200) — additive stores + upgrade backfill.
this.version(3)
  .stores({
    trackedShows: "&sessionId, status, date, showId",
    trackedEntries: "++id, sessionId, [sessionId+position], source",
  })
  .upgrade(async (tx) => { ... });

// Phase 6 (per RESEARCH):
this.version(4).stores({
  archiveShows: "&show_id",   // online-fallback setlist cache ONLY
});
```

**Retro-mark write helper** — mirror `startShow`'s transaction idiom (lines 235-263): a `db.transaction("rw", ...)` module-level async fn. The fallback-mark path writes `attendedShows` + the `archiveShows` cache row in ONE transaction (Pitfall 5). Corpus-era marks write only the EXISTING `attendedShows` table (`&show_id, showDate` — unchanged since v1, verified written by nothing today). Unmark mirrors `deleteEntry` (lines 333-335) — a plain delete; all counts recompute via derivation.

**Snapshot/import extension** — `DbSnapshot` (lines 141-146) and `importSnapshot` (lines 434-450) gain `archiveShows` via `bulkPut` (stable `&show_id` primary key → the `meta`/`attendedShows` upsert branch, NOT the clear-and-rewrite branch).

---

### 9. `packages/app/src/settings/importPicker.ts` — compare fork (D-17)

**Analog:** its own `pickAndImport` (lines 36-58). The structural guarantee: fork AFTER zod validation, BEFORE `parseAndMergeImport`/`importSnapshot` — the compare path never calls the two functions that write.

**Current commit seam** (lines 46-51):
```typescript
// Rejected file: return the core error verbatim, touch NOTHING (Pitfall 5).
if (!result.ok) return result;

// Valid file: commit the fully-merged snapshot in one rw transaction.
await importSnapshot(result.merged);
return result;
```
The fork: validate the envelope first (core-side `exportEnvelope.safeParse` or a small core helper), compare `envelope.owner` against the local `meta.ownerName` (via `getMeta`, db.ts lines 210-212); friend's file → return the PARSED envelope to the caller for CompareView and return before any merge. Mine → existing path unchanged. `openBackupFilePicker` (lines 65-78) is reused as-is.

---

### 10. `packages/app/src/dex/DexView.tsx` + hook + presentational components

**View analog:** `packages/app/src/settings/SettingsView.tsx` — scrolling `max-w-md` column, config-copy-only strings, lucide icons, `min-h-11` controls (lines 56-72). Segment switching (Albums | Shows) is component state, NOT a route — `ROUTES` is a fixed allow-list security control (`useHashRoute.ts` lines 4-10); RESEARCH Pattern 6 forbids new hash routes.

**Reactive-hook analog:** `packages/app/src/show/useShowSession.ts` — the "Dexie is the single source of truth, no useState mirror" idiom:
```typescript
// (a) reactive table read (lines 60-62)
const active = useLiveQuery(() =>
  db.trackedShows.where("status").equals("active").first(),
);
// (c) derived value — never hand-synced (line 78)
const tally = useMemo(() => deriveTally(entries), [entries]);
```
`useDexStats` reads `attendedShows` + `trackedShows` + `trackedEntries` + `archiveShows` via `useLiveQuery`, then `useMemo`-derives `deriveDex(...)` — mark/unmark recomputes automatically (D-12 "unmark is free").

**Mount point** (`App.tsx` lines 47-53) — replace the `PlaceholderView` branch:
```tsx
{route === "show" ? (
  <ShowView />
) : route === "settings" ? (
  <SettingsView />
) : (
  <PlaceholderView route={route} />   // ← "dex" branch becomes <DexView />
)}
```
DexView scrolls, so `scroll={route !== "show"}` (line 45) stays correct as-is.

**Presentational contract:** `PredictionOrb.tsx` is the dumb-component reference — props-in/callbacks-out, no data wiring (lines 25-34), sibling-buttons-never-nested for multi-control rows (lines 48-51 comment), untrusted strings (venue/song names) rendered as React text only.

---

### 11. `packages/app/src/dex/ArchiveBrowser.tsx` (retro-mark search/browse)

**Analog:** `packages/app/src/show/SearchSheet.tsx` — copy the shape.

**Memoized core searcher** (lines 53-57):
```typescript
const searcher = useMemo(() => {
  const result = loadMatrix();
  const nodes = result.ok ? result.matrix.nodes : [];
  return makeCatalogSearcher(toCatalog(nodes));
}, []);
```
Swap in `makeArchiveSearcher(archive.shows)` from core `search-archive.ts` over the bundled archive loader.

**Full-screen overlay + input + result rows** (lines 81-127): `role="dialog" aria-modal`, `text-base` input (≥16px, no iOS form-zoom), `min-h-11` tappable rows rendering strings as React text. Already-attended rows render as marked (Pitfall 6 — check both attendance sources). The "Search kglw.net for newer shows" fallback trigger is online-gated (`useOnlineStatus` from `live/useOnlineStatus.ts`, as used in ShowView line 84) and caches rows in memory for the session.

---

### 12. `packages/app/src/dex/RecapView.tsx` + ShowView/EndShowDialog seam (SHOW-14)

**Overlay analog:** `EndShowDialog.tsx` bottom-sheet (lines 84-95): fixed inset-0 backdrop + `rounded-t-2xl` sheet + `env(safe-area-inset-bottom)` padding + backdrop-click close with `stopPropagation` on the sheet.

**Trigger seam** (`EndShowDialog.tsx` lines 77-81):
```typescript
const handleConfirm = () => {
  void endShow(sessionId);
  void exportBackup(); // D-13 auto-backup — never-throws, fire-and-forget
  onClose();
};
```
Add an `onEnded(sessionId)` callback prop here; ShowView sets `recapSessionId` state from it. CRITICAL (RESEARCH Pattern 6): ShowView's `if (!session.active) return <PreShowLauncher />` early return (line 163) fires the instant the show finalizes — the recap render must be checked BEFORE that early return or the recap is swallowed. Recap for retro-marked shows: plain setlist view (no `trackedEntries` exist for them — RESEARCH Open Question 3).

Recap stat assembly is core (`recap.ts`, assignment 1); RecapView only renders `RecapStats`.

---

### 13. `packages/app/src/dex/shareCard.ts` (canvas PNG + Web Share)

**Analog:** `packages/app/src/settings/exportDownload.ts` — the never-throw + anchor-download idiom.

**Anchor download fallback** (lines 55-76):
```typescript
const url = URL.createObjectURL(blob);
try {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `guezzer-backup-${backupDateStamp()}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
} finally {
  URL.revokeObjectURL(url);
}
```

**Never-throw contract** (lines 35-76 shape): whole fn wrapped in try/catch returning `{ ok: boolean }`; drawing failure surfaces the UI-SPEC calm copy, never an exception.

New behavior with no analog (see §No Analog Found): pre-build the `File` when the preview opens, share-tap calls `navigator.canShare({files})` → `navigator.share` synchronously (Pitfall 7 transient activation); jsdom has no canvas, so the draw fn takes `(ctx, data)` and stat assembly stays in core `buildShareStats` (Pitfall 8).

---

### 14. `packages/app/src/show/FabMenu.tsx`, orb label fit, InstallBanner gating (folded polish)

**FabMenu — supersedes `ActionBar.tsx`.** Keep the exact callback-prop contract (lines 24-35: `onSearch/onUnknown/onSetBreak/onEncore/onUndo`) so ShowView's wiring (ShowView lines 355-361) barely changes. Preserve:
- The gesture-suppression class scope — `styles.css` lines 27-34 bind `.orbit-stage, .action-bar` to `touch-action: manipulation; overscroll-behavior: none; user-select: none; -webkit-touch-callout: none`. Give the FAB + open menu the same class (or add a `.fab-menu` selector to that rule).
- `min-h-11 min-w-11` floors + `env(safe-area-inset-bottom)` (ActionBar lines 57-61).
- Never-accent buttons (gold reserved for Start Show / focus ring).
- The FAB is `position: fixed` (unlike the in-flow ActionBar) — compute bottom offset from safe-area + BottomTabBar height + `config.ui.SUGGESTION_STRIP_HEIGHT` (app config line 79), and register overlay height via `useBottomOverlayHeightRegistration` (the `InstallBanner.tsx` line 24 idiom) if it can overlap scrollable content. Re-check the AppShell `scroll=false` seam once ActionBar's in-flow rows are removed (Pitfall 10). Open menu needs a scrim so orbit taps can't fire through; `actionBar.test.tsx` is replaced, not patched.

**Orb label fit (D-21)** — replace `PredictionOrb.tsx`'s truncate span (lines 75-77):
```tsx
<span className="max-w-full truncate text-[14px] font-semibold leading-tight">
  {candidate.songName}
</span>
```
with a wrap/scale strategy driven by a pure `fitOrbLabel(name, diameterPx, cfg)` helper — the pure-testable-helper idiom of `orbitLayout.ts`/`confidence.ts` (both unit-tested in `packages/app/test/orbitLayout.test.ts`/`confidence.test.ts`). Constants (min font px, max lines, ellipsis boundary) join `config.show` (app config lines 33-58).

**InstallBanner once-per-version (D-22)** — copy `EndShowDialog.tsx`'s meta-flag gate (lines 38-69):
```typescript
/** Meta flag key gating the one-time persist-denied warning (D-13). */
const PERSIST_WARNING_SHOWN = "persistWarningShown";
// in a guarded effect:
const alreadyShown = await getMeta<boolean>(PERSIST_WARNING_SHOWN);
if (alreadyShown) return;
// ...decide...
setShowPersistWarning(true);
await setMeta(PERSIST_WARNING_SHOWN, true);
```
Key the flag on `` `${__APP_VERSION__}+${__GIT_SHA__}` `` (globals from `vite.config.ts` lines 23-27, declared in `vite-env.d.ts`): show only when `getMeta("installBannerSeenVersion") !== buildStamp`. This deliberately supersedes `useInstallState.ts`'s session-only `dismissed` (lines 38-40 — its comment explicitly documents the Phase-3 decision being replaced; note the supersession in the plan so it isn't "restored").

---

### Bundled-artifact loaders: `archive.json` / `dex-albums.json` (Pattern 7)

**Analog:** `packages/app/src/show/matrix.ts` + `matrix-artifact.d.ts` + `vite.config.ts` alias — copy all three pieces per artifact.

**Vite alias** (`vite.config.ts` lines 28-39):
```typescript
resolve: {
  alias: {
    "@matrix": fileURLToPath(
      new URL("../../data/normalized/transition-matrix.json", import.meta.url),
    ),
  },
},
```

**Ambient declaration** (`matrix-artifact.d.ts` lines 8-12):
```typescript
declare module "@matrix" {
  import type { TransitionMatrix } from "@guezzer/core";
  const matrix: TransitionMatrix;
  export default matrix;
}
```

**Guarded, memoized loader** (`matrix.ts` lines 20-49):
```typescript
const EXPECTED_SCHEMA_VERSION = 1;
export type MatrixLoadResult =
  | { ok: true; matrix: TransitionMatrix }
  | { ok: false; error: string };
let cachedResult: MatrixLoadResult | null = null;

export function loadMatrix(): MatrixLoadResult {
  if (cachedResult) return cachedResult;
  const matrix = matrixArtifact as TransitionMatrix | null | undefined;
  if (!matrix || matrix.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    cachedResult = { ok: false, error: `Unsupported ... schemaVersion ...` };
    return cachedResult;
  }
  cachedResult = { ok: true, matrix };
  return cachedResult;
}
```
JSON-module import rides the JS bundle → precached by the existing Workbox `**/*.js` glob, NO `json` glob edit needed (vite.config.ts comment lines 46-48). Failure renders a calm handled state, never a crash.

---

### `packages/app/scripts/fetch-covers.ts` (one-time cover pipeline)

**Analog:** `packages/core/src/cli/fetch-corpus.ts` — the polite-fetch idiom (this is Node, where the UA header IS real).

**fetchJson etiquette** (lines 51-70): descriptive `User-Agent: config.userAgent` (core config line 29 — includes owner contact per MusicBrainz rules), `AbortSignal.timeout(config.fetchTimeoutMs)`, hard-fail with the endpoint named, NO automatic re-request.

**Strictly sequential pacing** (lines 138-150):
```typescript
let hasMadeARequest = false;
const paceNextRequest = async (): Promise<void> => {
  if (hasMadeARequest) {
    await deps.sleep(config.fetchDelayMs);
  }
  hasMadeARequest = true;
};
```
(MusicBrainz wants ~1 req/s; core's 2000ms `fetchDelayMs` is comfortably polite.) Pipeline per RESEARCH: MB release-group search → CAA `front-250` → `sharp(...).resize(160,160).webp({quality:70})` → `packages/app/src/assets/covers/{slug}.webp` + a provenance `covers-manifest.json` (the `fetch-meta.json` idiom, fetch-corpus.ts lines 99-119). Fail loudly if an output exceeds the size budget (the `maxRowsPerYearSanity` hard-fail style, lines 157-163). Manual re-run only — never CI. `sharp@0.35.3` is a devDependency install task.

---

### Tests

**Core fixture idiom** — `packages/core/test/search-catalog.test.ts` (lines 15-25): a small factory fn producing typed fixture rows with inert values, then assertions with known expected outputs:
```typescript
function node(songId: number, songName: string): MatrixNode {
  return { songId, songName, playCount: 0, eraPlayCount: 0, tuningFamily: "standard" };
}
```

**Snapshot factories** — `packages/core/test/merge.test.ts` (lines 8-50): `emptySnapshot()`, `show(over = {})`, `entry(over = {})` override-spread factories. Copy for dex fixtures (synthetic archive/albums/snapshot with known sighting counts, tier boundaries, dedupe cases). Envelope-v2 tests EXTEND `merge.test.ts`/`serialize.test.ts` (round-trip, `MIGRATIONS` v1→v2, newer-version rejection).

**App DB tests** — `packages/app/test/db.test.ts`: fake-indexeddb (wired in `test/setup.ts`), `beforeEach` table clears, direct helper round-trips. Retro mark/unmark + import-fork zero-writes tests follow this.

**Component wiring tests** — `packages/app/test/actionBar.test.tsx` (lines 13-23): render with `vi.fn()` handler bag, query by `config.copy` strings via `getByRole("button", { name: ... })`, `afterEach(cleanup)`. `fabMenu.test.tsx` replaces this file wholesale (collapsed default, scrim, auto-collapse-then-act, all five actions fire).

**Commands** (from vitest `projects` config): per-task `npx vitest run --project @guezzer/core` or `--project @guezzer/app`; full `npm test`; phase gate adds `npx tsc --noEmit` (envelope type-pinning contract).

## Shared Patterns

### Config-only strings and constants
**Source:** `packages/app/src/config.ts` (structure) + `packages/core/src/config.ts` (annotation style)
**Apply to:** every new file
No component hardcodes a copy string or numeric tunable. Phase 6 adds: `config.copy.dex` / `config.copy.recap` / `config.copy.compare` / `config.copy.share` blocks (mirroring `copy.show`, lines 133-182); `config.dex`/`config.fab` tunable blocks (mirroring `config.show`, lines 33-58); core-side rarity thresholds with `[ASSUMED]` doc comments (mirroring `decayHalfLifeDays`, core config lines 107-115). Copy verbatim from 06-UI-SPEC's copywriting contract.

### Never-throw at the browser boundary (ASVS V7)
**Source:** `exportDownload.ts` lines 35-76, `importPicker.ts` lines 36-58, `poll-latest.ts` lines 52-93
**Apply to:** shareCard, recent-shows fetch, cover-loading fallbacks, archive loader
Wrap every browser/network call; surface `{ ok: false }` or a sentinel + calm config copy, never an exception into React.

### Trust boundary = zod strictObject, whole-file rejection (ASVS V5)
**Source:** `export-schema.ts` (strictObject rows) + `merge.ts` steps 1-2 (lines 66-96)
**Apply to:** friend-file compare path, archive/albums artifact schemas, live archive-search rows
Untrusted strings (owner name, venue/song names) render as escaped React text only, length-clamped in schema — never `dangerouslySetInnerHTML` (existing T-04-05/T-05-16 rule, see SettingsView header lines 9-12).

### Dexie is the single source of truth (no useState mirrors)
**Source:** `useShowSession.ts` (header lines 1-16, liveQuery lines 58-86)
**Apply to:** DexView stats, ShowsList, ArchiveBrowser marked-state, recap "before" counts
`useLiveQuery` for table reads + `useMemo` for pure derivation; a mark/unmark write-through re-renders everything.

### Bottom-sheet / overlay idiom
**Source:** `EndShowDialog.tsx` lines 84-95 (bottom sheet) and `SearchSheet.tsx` lines 81-112 (full-screen sheet)
**Apply to:** RecapView, ArchiveBrowser, share-card preview, FAB menu scrim
`role="dialog" aria-modal="true"`, backdrop-click close + `stopPropagation`, `env(safe-area-inset-*)`, `min-h-11` controls, `touch-manipulation`.

### 44px floor + dark-theme tokens
**Source:** 03-UI-SPEC inherited tokens as used across `ActionBar`/`SettingsView`/`SearchSheet` (`min-h-11 min-w-11`, `border-hairline`, `bg-elevated`, `text-text-primary`/`text-text-muted`, accent reserved)
**Apply to:** every new component. Extend, don't re-derive.

## No Analog Found

Files/behaviors with no close match in the codebase (planner should use RESEARCH.md §Code Examples instead):

| File / Behavior | Role | Data Flow | Reason | RESEARCH fallback |
|-----------------|------|-----------|--------|-------------------|
| Canvas 2D draw of the share card (`shareCard.ts` draw fn) | canvas rendering | transform | No canvas code exists anywhere in the repo | §Code Examples "Share flow that survives iOS transient activation"; draw fn takes `(ctx, data)` for mock-ctx testing (Pitfall 8) |
| `navigator.share` / `canShare({files})` flow | Web Share API | event-driven | No share-sheet usage exists | Same RESEARCH example — pre-build the `File` before the tap (Pitfall 7); `exportDownload.ts` anchor idiom is the fallback branch |
| Album-cover `<img>` grid with initials placeholder | image assets | static | No image assets are rendered today (icons are lucide components) | 06-UI-SPEC placeholder spec; bundled WebP thumbs via the standard Vite asset import |

## Metadata

**Analog search scope:** `packages/core/src/**`, `packages/app/src/**`, `packages/core/test/**`, `packages/app/test/**`, `packages/app/vite.config.ts`, `packages/app/src/styles.css`
**Files scanned:** 126 TS/TSX files enumerated; 25 read in full, 3 read targeted
**Pattern extraction date:** 2026-07-14
**Note for planner:** `06-UI-SPEC.md` exists in the phase directory and governs visual/copy decisions — pattern excerpts here cover code structure, not visual design. The envelope-v2 cluster (assignment 7) is a single-plan atomic change per RESEARCH Pattern 4.
