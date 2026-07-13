# Phase 5: Live Sync & Data Safety - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 22 (14 new source, 5 modified, 3 config/test representative)
**Analogs found:** 20 / 22 (2 pure-domain files have partial analogs only)

## File Classification

### New — Core (pure, zero-DOM)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/core/src/ingest/latest-types.ts` | model (zod schema) | transform / validate | `packages/core/src/ingest/api-types.ts` | exact |
| `packages/core/src/live/poll-latest.ts` | service (fetch) | request-response | `packages/core/src/cli/fetch-corpus.ts` (`fetchJson`) | role-match (invert failure policy) |
| `packages/core/src/live/suggest.ts` | utility (pure diff) | transform | `packages/core/src/ingest/validate.ts` (pure guard style) | partial (pure fn shape only) |
| `packages/core/src/live/bind-show.ts` | utility (pure decision) | transform | `packages/core/src/ingest/validate.ts` (`assertFilterApplied` guard) | partial |
| `packages/core/src/data-safety/export-schema.ts` | model (zod schema) | validate | `packages/core/src/ingest/api-types.ts` | exact |
| `packages/core/src/data-safety/serialize.ts` | utility (pure) | transform | `packages/core/src/cli/fetch-corpus.ts` (`mergeFetchMeta` object-assembly) | partial |
| `packages/core/src/data-safety/merge.ts` | utility (pure) | transform / batch | `packages/core/src/cli/fetch-corpus.ts` (`mergeFetchMeta` union-merge) | partial |

### New — App (DOM / lifecycle)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/app/src/live/useOnlineStatus.ts` | hook | event-driven | `packages/app/src/routing/useHashRoute.ts` (`useSyncExternalStore`) | exact |
| `packages/app/src/live/useLatestPoll.ts` | hook | event-driven / polling | `packages/app/src/wakeLock.ts` + `ShowView.tsx` wake-lock effect | role-match |
| `packages/app/src/live/SuggestionStrip.tsx` | component | request-response | `packages/app/src/show/TrailNodeSheet.tsx` (adopt/rename reuse) | role-match |
| `packages/app/src/live/SyncDot.tsx` | component | event-driven | `packages/app/src/show/WakeLockNotice.tsx` (quiet status component) | role-match |
| `packages/app/src/settings/SettingsView.tsx` | component (view) | request-response | `packages/app/src/show/ShowView.tsx` (view root) | role-match |
| `packages/app/src/settings/exportDownload.ts` | utility (browser API) | file-I/O | `packages/app/src/pwa/persist.ts` (never-throw browser-API idiom) | partial |
| `packages/app/src/settings/importPicker.ts` | utility (browser API) | file-I/O | `packages/app/src/pwa/persist.ts` (never-throw browser-API idiom) | partial |

### Modified — App

| Modified File | Role | Change | Analog Section To Follow |
|---------------|------|--------|--------------------------|
| `packages/app/src/db/db.ts` | model / migration | Add `version(3)` additive migration (`source`, binding cols) + `adoptSuggestion`/`bindShow` helpers | its own `version(2)` block + `logSong`/`renameEntry` helpers |
| `packages/app/src/routing/useHashRoute.ts` | route | Add `"settings"` to `ROUTES` allow-list | the `ROUTES` tuple (self) |
| `packages/app/src/components/AppShell.tsx` (or `BottomTabBar.tsx`) | route / nav | Wire the unwired header Menu/gear button → `navigate("settings")`, or add a 4th tab | `AppShell` header button / `BottomTabBar` `TABS` array |
| `packages/app/src/App.tsx` | route render | Render `SettingsView` when `route === "settings"` | its existing `route === "show"` branch |
| `packages/app/src/config.ts` | config | Add `live` block (poll cadence, suggestion count) + `settings`/`sync` copy | the `show` tunables block + `copy.show` block |
| `packages/app/src/show/ShowView.tsx` | component | Mount `useLatestPoll` + `SuggestionStrip` + `SyncDot`; adopt/bind write-through | its `handleTapOrb` / `handleSearchSelect` write-through handlers |

### Modified — Core

| Modified File | Role | Change | Analog Section |
|---------------|------|--------|----------------|
| `packages/core/src/config.ts` | config | (Optional) `latestEndpoint` path constant if the poller needs a non-`apiBase` route | existing `apiBase`/`userAgent` keys |

### New — Tests (Wave 0, per RESEARCH §Test Map)

| Test File | Env | Analog Test |
|-----------|-----|-------------|
| `packages/core/test/latest-types.test.ts` | node | `packages/core/test/api-types.test.ts` |
| `packages/core/test/poll-latest.test.ts` | node (injected `fetch`) | `packages/core/test/fetch.test.ts` |
| `packages/core/test/suggest.test.ts` | node | `packages/core/test/validate.test.ts` |
| `packages/core/test/bind-show.test.ts` | node | `packages/core/test/validate.test.ts` |
| `packages/core/test/serialize.test.ts` + `merge.test.ts` | node | `packages/core/test/fetch.test.ts` (fixtures) |
| `packages/app/test/useLatestPoll.test.tsx` | jsdom + fake timers | `packages/app/test/wakeLock.test.ts` |
| `packages/app/test/migrationV3.test.ts` | jsdom + fake-indexeddb | `packages/app/test/db.test.ts` |
| `packages/app/test/exportImportRoundtrip.test.ts` | jsdom + fake-indexeddb | `packages/app/test/db.test.ts` |

---

## Pattern Assignments

### `packages/core/src/ingest/latest-types.ts` (model, validate)

**Analog:** `packages/core/src/ingest/api-types.ts`

**CRITICAL (RESEARCH Pitfall 1):** Do NOT reuse `rawSetlistRowCensus` — it is a `z.strictObject` where `css_class` / `isrecommended` / `tracktime` are `.nullable()` **but still required keys**, so parsing a `latest` row (which omits those 5 keys) **throws**. Author a new schema validating only the fields the poller consumes.

**Schema pattern to copy** (api-types.ts lines 16–70, strictObject + typed field style):
```typescript
import { z } from "zod";

export const latestSetlistRow = z.strictObject({
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  song_id: z.number().int(),
  songname: z.string(),
  artist_id: z.number().int(),
  position: z.number().int().positive(),
  setnumber: z.string(),      // loose (mirror api-types.ts:36)
  settype: z.string(),
  venue_id: z.number().int(),
  venuename: z.string(),
  city: z.string(),
});
export type LatestSetlistRow = z.infer<typeof latestSetlistRow>;
```

**Error-context helper to reuse verbatim** (api-types.ts lines 167–176): `formatRowError(zodError, row)` appends `show_id`/`showdate` context — reuse it for parse failures on `latest` rows.

**Blocking dependency:** capture one real `data/samples/latest.sample.json` (single polite fetch) before finalizing this schema (RESEARCH Open Question 1 / Assumption A1). Sample-driven schema locking mirrors how the corpus schema was locked against `data/samples/rr1010.json`.

---

### `packages/core/src/live/poll-latest.ts` (service, request-response)

**Analog:** `packages/core/src/cli/fetch-corpus.ts` — the `fetchJson` function (lines 51–70) and the `FetchDeps` injection seam (lines 27–37).

**Injected-deps seam to copy** (fetch-corpus.ts lines 27–37):
```typescript
export interface FetchDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
}
const defaultDeps: FetchDeps = { fetch: globalThis.fetch, sleep: defaultSleep };
```

**Fetch idiom to copy** — User-Agent + `AbortSignal.timeout` + envelope handling (fetch-corpus.ts lines 51–70):
```typescript
const res = await deps.fetch(`${config.apiBase}${path}`, {
  headers: { "User-Agent": config.userAgent },
  signal: AbortSignal.timeout(config.fetchTimeoutMs),
});
// ... body.error handling; data: [] is a VALID empty result, never an error
```

**INVERT the failure policy (D-06, RESEARCH Pattern 2):** `fetchJson` hard-throws on non-OK / `error:true` — that is a build-time policy. The live poller must be **tolerant**: return `[]` (or `{ ok:false }`) on any soft failure so the app's caller simply retries next interval. Do NOT copy the `throw new Error(...HTTP ${res.status}...)` branch (lines 57–62) unchanged.

**Reuse the artist_id guard** (`packages/core/src/ingest/validate.ts` lines 15–30) — `assertFilterApplied(rows, "latest", { field: "artist_id", expected: 1 })` (DATA-03; the API silently ignores filters). Because the poller is tolerant, wrap the guard so a mismatch discards rows rather than hard-failing.

**Validate rows** with `latestSetlistRow.parse` (NOT `rawSetlistRowCensus.parse`).

---

### `packages/core/src/live/suggest.ts` (utility, transform)

**Analog:** partial — pure-function shape from `packages/core/src/ingest/validate.ts`. No exact analog (first pure diff of live-vs-trail state); use RESEARCH Pattern 3.

**`diffLatestAgainstTrail(latestRows, trailEntries)`** — build a `Set<number>` of already-logged `songId`s (excluding `null`/placeholder), order `latestRows` by `position`, return the first `config.live.SUGGESTION_COUNT` (1–2) un-logged rows as `Suggestion[]`. The editor never contradicts a logged song (D-02) — filter, never flag disagreement.

**`resolvePlaceholders(latestRows, trailEntries)`** — returns `FillHint[]` for trail entries where `isPlaceholder === true` and `latest` has a real song at the matching position (D-04). Consumed by the adopt path via `renameEntry` (see TrailNodeSheet analog below).

**Trail entry shape** it reads from (`db.ts` `TrackedEntry`, lines 79–99): `position`, `songId: number | null`, `isPlaceholder: boolean`. Re-declare the minimal input type in core (do NOT import the app's `db.ts` — core has zero app dependency, mirroring the `SetNumber` re-declaration note in db.ts lines 38–43).

---

### `packages/core/src/live/bind-show.ts` (utility, transform)

**Analog:** `packages/core/src/ingest/validate.ts` `assertFilterApplied` (guard-style pure fn, lines 15–30).

**`bindShowFromLatest(latestRows, trackedShow, todayIso)`** returns `{ showId, venueId, venueName, city } | null` (RESEARCH Pattern 4). Wrong-show guard: return `null` unless `latestRows[0].showdate === todayIso` AND it reads as tonight's show; NEVER overwrite an already-bound `showId` (`trackedShow.showId !== null` → return `null`). The `showId: number | null` reconciliation seam already exists on `TrackedShow` (db.ts lines 69–71) — this fills it.

---

### `packages/core/src/data-safety/export-schema.ts` (model, validate)

**Analog:** `packages/core/src/ingest/api-types.ts` (strictObject + `z.infer` type export).

Define the D-09 envelope as a `z.strictObject` (rejects unexpected keys — prototype-pollution defense, RESEARCH §Security):
```typescript
export const exportEnvelope = z.strictObject({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  meta: z.array(/* MetaRow */),
  attendedShows: z.array(/* ... */),
  trackedShows: z.array(/* ... */),
  trackedEntries: z.array(/* ... */),
});
```
Row shapes mirror the `db.ts` interfaces (`MetaRow`, `AttendedShow`, `TrackedShow`, `TrackedEntry`), including the new `version(3)` `source` + binding fields.

---

### `packages/core/src/data-safety/serialize.ts` + `merge.ts` (utility, transform/batch)

**Analog:** `packages/core/src/cli/fetch-corpus.ts` `mergeFetchMeta` (lines 98–119) — the union-by-key + sorted-object-rebuild idiom is the closest existing merge.

**`serializeExport(snapshot)`** — pure object assembly (RESEARCH Pattern 5, D-09): `{ schemaVersion: config SCHEMA_VERSION, exportedAt: new Date().toISOString(), meta, attendedShows, trackedShows, trackedEntries }`. App hands it Dexie `toArray()` snapshots.

**`parseAndMergeImport(rawJson, localSnapshot)`** — pure, atomic (RESEARCH Pattern 5, Pitfall 5):
1. `JSON.parse` in try/catch → clean reject on syntax error.
2. `exportEnvelope.parse` (zod) → clean reject with message; **never partial-merge** (D-12).
3. Version-migrate `schemaVersion < current` via an ordered list of `(n)→(n+1)` pure fns.
4. Union-merge by stable keys, **never drop local rows** (D-10): `attendedShows` by `show_id`; `trackedShows` by `sessionId`; `trackedEntries` by `(sessionId, position)`.
5. Same-show dedupe (D-11): collapse `trackedShows` sharing a bound `show_id` (or `date` when both unbound) into one attendance, keep the richer setlist.

Return the merged snapshot for the app to `bulkPut` inside one Dexie `rw` transaction. `mergeFetchMeta`'s `{ ...existing, ...newEntries }` + key-sort (lines 111–118) is the shape to generalize.

---

### `packages/app/src/live/useOnlineStatus.ts` (hook, event-driven)

**Analog:** `packages/app/src/routing/useHashRoute.ts` (lines 1–28) — `useSyncExternalStore` over a browser event, EXACT structural match.

**Copy this shape** (useHashRoute.ts lines 21–28), swapping `hashchange` for `online`/`offline`:
```typescript
function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```
**Pitfall 2:** treat `false` as authoritative-offline; `true` is only "permission to try."

---

### `packages/app/src/live/useLatestPoll.ts` (hook, polling)

**Analog:** `packages/app/src/wakeLock.ts` (lifecycle + `visibilitychange` idiom, lines 91–105) + the `ShowView.tsx` wake-lock effect (lines 83–91, mount/cleanup with a ref).

**Self-scheduling single-timer pattern** (RESEARCH Pattern 1) — one `useRef<timeout>`, always `clearTimeout` before scheduling and in cleanup:
```typescript
const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (!active) return;                 // no active show → no polling (SYNC-01)
  let cancelled = false;
  const tick = async () => { /* gate on navigator.onLine + visibilityState; poll; schedule next */ };
  timer.current = setTimeout(tick, config.live.POLL_INTERVAL_MS);
  return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
}, [active?.sessionId, online]);
```

**Gating** (Pitfall 4): `navigator.onLine && document.visibilityState === "visible"`. The `visibilitychange` reacquire idiom is already in `wakeLock.ts` (lines 91–105). **Tolerant catch** (D-06): swallow poll errors, just schedule the next tick. **Adaptive backoff** within the ≤1/60s floor (config `POLL_INTERVAL_MS` / `POLL_MAX_INTERVAL_MS`).

**Effect mount/cleanup ref discipline** mirrors ShowView.tsx lines 83–91.

---

### `packages/app/src/live/SuggestionStrip.tsx` (component, request-response)

**Analog:** `packages/app/src/show/TrailNodeSheet.tsx` — the adopt/rename write-through and untrusted-string rendering rule.

**Adopt write-through** reuses `logSong(sessionId, {..., source: 'editor'})` (ShowView.tsx `handleSearchSelect` lines 152–162 is the template) — classify hit/miss via `classifyOutcome(songId, shownFanSongIds)` (ShowView.tsx line 121), then stamp `source`.

**"???" fill-hint adopt** reuses the `renameEntry(id, songId, songName, outcome)` path exactly as TrailNodeSheet.tsx `handlePick` (lines 54–62):
```typescript
const outcome = entry.shownFanSongIds
  ? classifyOutcome(selection.songId, entry.shownFanSongIds)
  : entry.outcome;
void renameEntry(entry.id, selection.songId, selection.songName, outcome);
```

**Untrusted content (RESEARCH §Security, Pitfall):** `songname`/`venuename` from `latest` are untrusted editor content — render as React text only, NEVER `dangerouslySetInnerHTML` (same rule as TrailNodeSheet.tsx lines 17–18, 121).

**Styling tokens** — copy the strip/button classes from TrailNodeSheet (`min-h-11`, `border-hairline`, `bg-elevated`, `text-text-primary`, `touch-manipulation`, safe-area insets). All copy strings go in `config.copy` (see config analog).

---

### `packages/app/src/live/SyncDot.tsx` (component, event-driven)

**Analog:** `packages/app/src/show/WakeLockNotice.tsx` — a small quiet status component (visible-prop-gated, calm styling).

Reads `useOnlineStatus()` + last-poll outcome, renders a small dot (D-08) — never a loud banner. Offline reassurance copy lives in `config.copy` (Claude's-discretion wording, deferred to `/gsd-ui-phase`). Combine `navigator.onLine` with last-poll result (Pitfall 2), not `onLine` alone.

---

### `packages/app/src/settings/SettingsView.tsx` (component, view)

**Analog:** `packages/app/src/show/ShowView.tsx` (view root under `AppShell`) + `AppShell.tsx` header.

Hosts Export/Import buttons + persist-status readout via `getMeta<PersistStatus>("persistStatus")` (persist.ts `PersistStatus` type, lines 13). Button styling copies the `border-hairline` / `min-h-11` / `touch-manipulation` idiom used across `ShowView`/`TrailNodeSheet`. **Scope-limited** — no destructive "clear all data" (D-14).

---

### `packages/app/src/settings/exportDownload.ts` + `importPicker.ts` (utility, file-I/O)

**Analog:** `packages/app/src/pwa/persist.ts` (lines 21–49) — the feature-detect + try/catch + never-throw browser-API idiom (also mirrored in `wakeLock.ts`).

**Export** — `Blob` + `URL.createObjectURL` + `a.download` (RESEARCH §Don't Hand-Roll; `File System Access API` is unavailable on iOS Safari — do NOT use it). Wrap in the never-throw idiom.

**Import** — `<input type="file" accept="application/json">` + `File.text()` (promise-based; no `FileReader`). Hand the text to core `parseAndMergeImport`; commit only the fully-merged result in one Dexie `rw` transaction (Pitfall 5).

**End-Show auto-download (D-13):** call `exportDownload` from the End Show confirm path — `EndShowDialog.tsx` `handleConfirm` (lines 30–33) is the hook point (add after `endShow(sessionId)`).

---

### `packages/app/src/db/db.ts` (model, migration) — MODIFIED

**Analog:** its own `version(2)` block (lines 120–123) and `logSong`/`renameEntry` helpers.

**Additive `version(3)`** (RESEARCH §Migration, lines 362–375) — never rewrite v1/v2:
```typescript
this.version(3).stores({
  trackedShows: "&sessionId, status, date, showId",           // + showId index for reconciliation
  trackedEntries: "++id, sessionId, [sessionId+position], source",
}).upgrade(async (tx) => {
  await tx.table("trackedEntries").toCollection().modify((e) => {
    if (e.source === undefined) e.source = "manual";           // backfill (RESEARCH §Migration note)
  });
});
```
Add `source: "manual" | "editor"` to `TrackedEntry` and `venueId`/`venueName`/`city` to `TrackedShow` interfaces. Only index a column you query (`showId`; `source` need not be indexed — confirm at plan time).

**New write helpers** follow the `db.transaction("rw", ...)` idiom of `logSong` (lines 192–216) / `renameEntry` (lines 257–269): e.g. `adoptSuggestion` (a `logSong` variant stamping `source`), `bindShow(sessionId, {...})` (a `trackedShows.update` like `markSetBreak` line 231), and `importSnapshot` (bulkPut inside one `rw` transaction).

---

### `packages/app/src/routing/useHashRoute.ts` (route) — MODIFIED

**Analog:** the `ROUTES` tuple itself (line 9). Add `"settings"`:
```typescript
export const ROUTES = ["show", "explore", "dex", "settings"] as const;
```
This is the security allow-list (line 3–8) — extending it is the correct validated way to add a view.

---

### `packages/app/src/components/AppShell.tsx` / `BottomTabBar.tsx` (nav) — MODIFIED

**Analog:** `AppShell.tsx` header Menu button (lines 29–36) is currently wired to `onMenuClick` (opens `AppMenu`). RESEARCH recommends wiring a gear/settings entry to `navigate("settings")` for prominence without crowding the 3-tab bar. Alternatively extend `BottomTabBar.tsx` `TABS` array (lines 4–8) with a 4th `{ route: "settings", label: "Settings", Icon: Settings }`. Claude's discretion (D-14).

---

### `packages/app/src/App.tsx` (route render) — MODIFIED

**Analog:** its `route === "show" ? <ShowView /> : <PlaceholderView .../>` branch (lines 46–50). Add a `route === "settings"` → `<SettingsView />` branch. Settings scrolls (`scroll={route !== "show"}` already handles it).

---

### `packages/app/src/config.ts` (config) — MODIFIED

**Analog:** the `show` tunables block (lines 33–58) + `copy.show` block (lines 103–152).

Add a `live` block (`POLL_INTERVAL_MS: 60_000`, `POLL_MAX_INTERVAL_MS`, `SUGGESTION_COUNT: 2`, `EXPORT_SCHEMA_VERSION: 1`) and `copy.sync` / `copy.settings` strings (offline reassurance, export/import labels). Single-config-file ethos — no scattered literals (CLAUDE.md, config.ts lines 1–11). Copy exact wording deferred to `/gsd-ui-phase`.

---

### `packages/app/src/show/ShowView.tsx` (component) — MODIFIED

**Analog:** its own write-through handlers (`handleTapOrb` lines 120–130, `handleSearchSelect` lines 152–162) and the wake-lock effect (lines 83–91).

Mount `useLatestPoll(session.active, onRows)`, render `<SuggestionStrip>` below the orbit (near the `CometTrail`/`ActionBar` region, lines 209–233) and `<SyncDot>` in the sub-header (near `TallyReadout`, lines 183–184). Adopt/bind are write-throughs — `useLiveQuery` in `useShowSession` re-renders the trail/tally automatically (no `useState` mirror).

---

## Shared Patterns

### Injected-deps seam (core API code)
**Source:** `packages/core/src/cli/fetch-corpus.ts` lines 27–37 (`FetchDeps` + `defaultDeps`)
**Apply to:** `poll-latest.ts` — take `deps: { fetch }` so Node tests inject a mock `fetch` returning canned `latest` envelopes (mirrors `fetch.test.ts` lines 39–47).

### Never-throw browser-API idiom
**Source:** `packages/app/src/pwa/persist.ts` lines 21–49 (feature-detect → try/catch → record status → never throw); also `wakeLock.ts`.
**Apply to:** `exportDownload.ts`, `importPicker.ts`, `useLatestPoll.ts` (tolerant poll), `SyncDot.tsx`.

### `useSyncExternalStore` over browser events
**Source:** `packages/app/src/routing/useHashRoute.ts` lines 21–28
**Apply to:** `useOnlineStatus.ts` (online/offline events).

### zod strictObject validation of untrusted input
**Source:** `packages/core/src/ingest/api-types.ts` lines 18–70 + `formatRowError` lines 167–176
**Apply to:** `latest-types.ts` (API response), `export-schema.ts` (imported file) — two untrusted inputs (RESEARCH §Security V5). `strictObject` rejects unexpected keys (drift + prototype-pollution defense).

### Artist-scope guard (DATA-03)
**Source:** `packages/core/src/ingest/validate.ts` lines 15–30 (`assertFilterApplied`)
**Apply to:** `poll-latest.ts` — enforce `artist_id === 1` (API silently ignores filters). Wrap tolerantly (discard, not throw) for the live path.

### Write-through + `useLiveQuery` reactivity
**Source:** `packages/app/src/show/useShowSession.ts` lines 58–150; write helpers in `db.ts` lines 192–273
**Apply to:** adopt-suggestion, fill-???, bind-show, import — all commit to Dexie; UI re-renders from the DB. NO hand-synced `useState` mirror.

### Additive-only Dexie migration
**Source:** `packages/app/src/db/db.ts` lines 111–124 (v1 untouched, v2 additive)
**Apply to:** `version(3)` — additive columns + backfill only; never rewrite prior versions.

### Bottom-sheet overlay idiom
**Source:** `packages/app/src/show/TrailNodeSheet.tsx` lines 82–160 / `EndShowDialog.tsx` lines 35–72 (`role="dialog"`, `bg-black/50` backdrop, `rounded-t-2xl` sheet, safe-area padding, `stopPropagation`)
**Apply to:** `SuggestionStrip` / `SettingsView` overlays if a sheet form is chosen.

### Single-config-file constants + copy
**Source:** `packages/app/src/config.ts` (whole file) / `packages/core/src/config.ts` lines 1–11
**Apply to:** all new poll cadence, suggestion count, schema version, and copy strings.

### Injected-fetch node test + fake-indexeddb integration test
**Source:** `packages/core/test/fetch.test.ts` lines 1–68 (mock `fetch`/`sleep`, envelope helpers) and `packages/app/test/db.test.ts` lines 1–32 (Dexie round-trip; `fake-indexeddb/auto` in `packages/app/test/setup.ts`)
**Apply to:** all Wave-0 test files (RESEARCH §Test Map).

---

## No Analog Found

No file is entirely without a reference — but two pure-domain files have only **partial** (shape-only) analogs; the planner should lean on RESEARCH patterns for their core logic:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/src/live/suggest.ts` | utility | transform | First pure live-vs-trail diff; no existing dedupe-against-session-state fn. Use RESEARCH Pattern 3; pure-fn shape from `validate.ts`. |
| `packages/core/src/data-safety/merge.ts` | utility | batch | First union-merge of personal-data snapshots. Closest is `fetch-corpus.ts` `mergeFetchMeta` (object-key union); merge/dedupe semantics come from RESEARCH Pattern 5 + Pitfall 6. |

---

## Metadata

**Analog search scope:** `packages/core/src/{cli,ingest,config}`, `packages/app/src/{db,routing,pwa,show,components,config}`, `packages/{core,app}/test`
**Files scanned:** 17 read in full/targeted + directory globs of `show/`, `core/test/`, `app/test/`, `data/samples/`
**Pattern extraction date:** 2026-07-13
</content>
</invoke>
