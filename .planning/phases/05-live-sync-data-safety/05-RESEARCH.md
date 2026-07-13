# Phase 5: Live Sync & Data Safety - Research

**Researched:** 2026-07-11
**Domain:** Live API polling lifecycle (PWA/React), offline resilience, versioned JSON export/import with merge semantics, additive IndexedDB migration
**Confidence:** HIGH (this phase is almost entirely composed of already-vendored libraries + already-established codebase patterns; the genuinely new surface is lifecycle glue and merge logic, both verifiable against existing code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live Sync — Suggestions (SYNC-02)**
- **D-01:** Editor songs from `latest` surface as a **dismissible strip below the orbit** — tap to adopt (logs it as yours), swipe/X to dismiss. NOT ghost orbs inside the orbit (mis-tap risk in a dark venue, contra D-13), NOT a hidden badge-only affordance.
- **D-02:** The strip shows only the **next 1–2 un-logged** editor songs, **deduped by song ID** against the current trail. The editor **never contradicts** songs you've already logged — purest reading of SYNC-02's manual-primary "second set of eyes." No "editor disagrees with your entry" flagging.
- **D-03:** Adopting a suggestion runs the **same hit/miss fan classification** as any log (in the shown fan → hit; otherwise → miss, per Phase 4 D-06/D-08) **and** stamps a **`source: 'manual' | 'editor'`** provenance field on the entry. Requires an additive Dexie **version(3)** migration adding `source` to `trackedEntries`.
- **D-04:** Editor sync also offers to **resolve "???" placeholders**: when `latest` reveals a song at a position where you logged "???", surface a dismissible suggestion to fill it in — **never auto-applied** — reusing the D-14/D-15 rename path.

**Live Sync — Polling & Binding (SYNC-01, SYNC-03)**
- **D-05:** The poller's **pure fetch/parse/dedupe logic lives in `packages/core`** (zero-DOM; reuses the zod row schemas + `assertFilterApplied` artist_id guard). The **app** owns the 60s cadence, active-show gating, and offline pause/resume.
- **D-06:** Poll the **`latest` endpoint only**, **≤ once per 60s, only while a show is active** — never the full `setlists` endpoint from client devices (SYNC-01). Descriptive **User-Agent**. **Tolerant failure policy:** a failed poll is **silent — just retry next interval** (UNLIKE the corpus fetcher's hard-fail-no-retry). Optionally **slow the cadence** when nothing changes for a long stretch (within the ≤1/60s ceiling).
- **D-07:** **Auto-bind** the tracked show to the real kglw.net **`show_id` + venue** by **date-matching `latest`**, silently attaching it to the provisional record. **Wrong-show guard:** bind only when `latest`'s date equals today and it reads as tonight's show; any mismatch → **stay provisional, never overwrite**. Binding is reversible via the export/import round-trip.
- **D-08:** **Offline (SYNC-03):** the app is **fully functional offline**; on signal drop the quiet sync indicator flips to an "offline" state plus a **brief calm reassurance**. Polling **resumes silently** when signal returns. Sync status is a **quiet indicator (small dot)**, never a loud banner.

**Data Safety — Export/Import (PWA-04)**
- **D-09:** Export is a **single versioned JSON**: `{ schemaVersion, exportedAt, meta, attendedShows, trackedShows, trackedEntries }`.
- **D-10:** **Import merges (union)** by stable keys (`show_id` / `date` / `sessionId`) and **never drops existing local data**. Phase 5 scope is **your own lose-a-phone round-trip**; friend-specific conflict UI / dex-diff is deferred to Phase 6 (SHAR-01).
- **D-11:** **Same-show dedupe:** shows with the same bound `show_id` (or same `date` when unbound) count as **one attendance** even across different `sessionIds` (phone + iPad).
- **D-12:** **Import validation:** **zod-validate** the file; **reject** a corrupt/unrecognized file with a clear message rather than partial-merging; **version-migrate** older `schemaVersion` exports forward.
- **D-13:** **Backup nudge:** **auto-download the JSON at End Show**; a **one-time warning** if `navigator.storage.persist()` was denied; a **prominent Settings export/import button** always available.
- **D-14:** **Placement:** add a **Settings surface** (new tab or gear-icon hash route, extending the existing `BottomTabBar` / `useHashRoute` pattern) hosting export/import + persist-storage status. **Scope-limited to export/import + storage status** — no destructive "clear all data" in Phase 5.

### Claude's Discretion
- Exact suggestion-strip copy/layout, sync-dot colors/placement, offline-reassurance wording, and adaptive-backoff timing thresholds — belong to planning / `/gsd-ui-phase`.
- Dexie **version(3)** migration wiring specifics (additive: `trackedEntries.source`; `trackedShows` `show_id`/venue binding columns).
- Whether the Settings surface is a bottom-tab vs a gear-route.
- Merge-conflict detail when two files disagree on the same show's entries (pick the richer set) — provided attendance stays deduped (D-11) and no local data is dropped (D-10).
- Poll cadence adaptivity curve (fixed-60 vs slow-when-idle) within the ≤1/60s ceiling.

### Deferred Ideas (OUT OF SCOPE)
- Friend-file merge UX (conflict preview, dex-diff, shareable card) — Phase 6 (SHAR-01/SHAR-02).
- Retroactive attendance marking against the full archive — Phase 6 (DEX-02).
- Post-show recap + rarity score consuming `source`-tagged entries — Phase 6 (SHOW-14/STAT-02).
- Destructive "clear all data" / reset in Settings — deferred (data-loss footgun).
- Suppress the update toast during an active tracked show — carried from Phase 3/4 deferred notes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | During an active show, poll `latest` at most once/60s — never the full `setlists` endpoint from clients | Polling lifecycle (§Architecture Pattern 1) + reuse of `fetchJson` idiom with a NEW tolerant-failure poller in core (§Standard Stack, §Pattern 2); `assertFilterApplied` artist_id guard preserved (DATA-03) |
| SYNC-02 | Editor songs offered as suggestions only (manual primary); dedupe by song ID; no auto-merge | Pure `diffLatestAgainstTrail` core function (§Pattern 3); adopt writes through `logSong(..., source:'editor')` reusing Phase-4 classification |
| SYNC-03 | Fully functional offline once loaded; polling resumes silently when signal returns | `navigator.onLine` + online/offline events + visibility-driven pause/resume (§Pattern 1, §Pitfall 2); vite-plugin-pwa already precaches the shell |
| PWA-04 | All personal data exports/imports as JSON, surfaced prominently | Versioned export schema + union-merge (§Pattern 5), zod validation gate (§Pattern 5), anchor-download + file-picker import (§Don't Hand-Roll), Settings route (§Pattern 6) |
</phase_requirements>

## Summary

Phase 5 introduces no new dependencies. Every capability is buildable from the already-vendored stack — Dexie 4.4.4 (with `dexie-react-hooks` 4.4.0), zod 4.4.3, React 19.2.7, and browser-native APIs (`fetch`, `navigator.onLine`, the anchor-download + `<input type=file>` idioms, `File.text()`/`FileReader`). The dominant risk is not library selection; it is **lifecycle correctness** (timers that leak, double-firing polls, offline detection that lies) and **merge correctness** (never dropping local data, never double-counting attendance). Both are testable with the existing Vitest `projects` setup (`node` for core, `jsdom` + `fake-indexeddb` for app).

The single most planning-critical technical finding: **the `latest.json` endpoint returns a smaller key subset than the corpus `setlists` rows** — it is missing `css_class`, `isrecommended`, `tracktime`, `timezone`, and `showtime` (docs/SCHEMA.md §11). Because `rawSetlistRowCensus` (packages/core/src/ingest/api-types.ts) is a `z.strictObject` where `css_class`, `isrecommended`, and `tracktime` are `.nullable()` **but still required keys** (`nullable` allows the value `null`, it does NOT make the key optional), calling `rawSetlistRowCensus.parse()` on a `latest` row **will throw** on those three missing keys. The poller therefore needs a **new, `latest`-specific zod schema** in core — NOT a reuse of `rawSetlistRowCensus`/`rawSetlistRowLocked`. This schema should validate only the fields the poller actually consumes (`show_id`, `showdate`, `song_id`, `songname`, `artist_id`, `position`, `setnumber`, `venue_id`, `venuename`, `city`, `settype`) and can be `strictObject` or a `.pick()`+`.partial()` derivation, but it must not require the 5 absent keys.

**Primary recommendation:** Add a `pollLatest()` + `diffLatestAgainstTrail()` + `bindShowFromLatest()` trio of **pure, dependency-injected functions in `packages/core`** (mirroring `fetch-corpus.ts`'s `{ fetch, sleep }` seam), each fed by a new `latestSetlistRow` zod schema. The **app** owns a single `useLatestPoll` hook that manages one interval, gates on active-show + `navigator.onLine` + document visibility, and applies the tolerant-retry policy. Export/import lives in a pure core `serializeExport()`/`parseAndMergeImport()` pair (zod-validated, version-migrating) driven by a thin Settings route that does the DOM download/upload. Ship `version(3)` as a purely additive Dexie migration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch `latest` + validate rows | Core (pure) | — | Zero-DOM fetch/parse; reuses zod schemas + `assertFilterApplied` (D-05). Injected `{ fetch }` for Node tests. |
| Poll cadence / start-stop / offline pause | App (React hook) | — | Timers, `navigator.onLine`, `visibilitychange`, unmount cleanup are inherently DOM/lifecycle (D-05). |
| Dedupe editor rows vs. trail → suggestions | Core (pure) | — | Pure array diff by `song_id`; deterministic, unit-testable in Node (D-02/D-05). |
| Adopt a suggestion (write-through) | App | Core (classification) | Writes `logSong(..., source:'editor')`; hit/miss classification reuses Phase-4 core (`shownFanSongIds` membership) (D-03). |
| Auto-bind `show_id`/venue by date | Core (decision) | App (persist) | Pure "should-bind + what-to-bind" decision in core (wrong-show guard); app writes the `trackedShows` update (D-07). |
| Offline indicator UI | App | — | Reads `navigator.onLine` + poll state; renders the quiet dot (D-08). |
| Serialize export payload | Core (pure) | App (download) | Pure object→JSON assembly from DB snapshots; app triggers the anchor download (D-09/D-13). |
| Parse + validate + merge import | Core (pure) | App (file read + write) | zod-validate, version-migrate, union-merge — all pure; app reads the File and commits the merged result (D-10/D-11/D-12). |
| Dexie `version(3)` migration | App (persistence) | — | Additive schema lives with `db.ts` (D-03/D-07). |
| Settings route | App | — | Extends `useHashRoute` + `BottomTabBar` (D-14). |

## Standard Stack

### Core (already vendored — no installs)
| Library | Version (verified in lockfile) | Purpose | Why Standard |
|---------|--------|---------|--------------|
| zod | 4.4.3 | `latest` row schema + export-file schema validation | Already the project's ingestion + validation layer (`api-types.ts`). Import validation (D-12) is exactly V5 input-validation territory. |
| dexie | 4.4.4 | `version(3)` additive migration; export reads / import writes | Additive `.version(n).stores({...})` is the established migration idiom (`db.ts` v1→v2). |
| dexie-react-hooks | 4.4.0 | `useLiveQuery` reactive re-render after adopt/import | Adopting a suggestion or importing a file is just a DB write; `useShowSession`'s existing live queries re-derive the trail/tally with zero hand-synced state. |
| react | 19.2.7 | `useLatestPoll` / `useOnlineStatus` hooks; `useSyncExternalStore` for online state | `useSyncExternalStore` is the correct primitive for subscribing to `navigator.onLine` (already used in `useHashRoute`). |

### Browser-native APIs (no library)
| API | Purpose | Notes |
|-----|---------|-------|
| `fetch` + `AbortSignal.timeout(ms)` | The `latest` GET | Already the corpus-fetch idiom (`fetchJson`). Reuse the User-Agent + timeout, drop the hard-fail. |
| `navigator.onLine` + `online`/`offline` events | Offline detection (SYNC-03) | Known to be unreliable in one direction (see §Pitfall 2). Treat `false` as authoritative-offline, `true` as maybe-online. |
| `document.visibilityState` + `visibilitychange` | Pause polling when backgrounded (battery + iOS PWA freeze) | Same idiom already in `wakeLock.ts`'s reacquire listener. |
| Anchor download (`URL.createObjectURL(blob)` + `a.download`) | Export file save + End-Show auto-download (D-13) | Standard no-library JSON download. `File System Access API` is NOT available on iOS Safari — do not use it. |
| `<input type="file" accept="application/json">` + `File.text()` | Import file picker (D-13) | `File.text()` returns a promise resolving the file contents; no `FileReader` boilerplate needed on modern Safari/Chrome. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A hand-rolled `setInterval` poll | `setTimeout`-chained self-scheduling loop | **Prefer the self-scheduling `setTimeout` chain** (schedule the next poll only after the current one settles). A fixed `setInterval` can stack overlapping requests if a fetch runs long and enables the adaptive-backoff curve (D-06) trivially by varying the next delay. |
| `navigator.onLine` alone | A "heartbeat" HEAD request to detect real connectivity | Out of scope + violates API etiquette (extra requests to a volunteer site). `navigator.onLine === false` is a reliable *offline* signal; the tolerant-retry policy (D-06) already absorbs false-*online*. |
| `File System Access API` (`showSaveFilePicker`) | Anchor-download | FSA is unsupported on iOS Safari (the primary target). Anchor-download works everywhere. |

**Installation:** None. `git diff packages/*/package.json` should show **no dependency changes** for this phase. `fake-indexeddb` 6.2.5 is already a root devDependency and already wired in `packages/app/test/setup.ts` (`import "fake-indexeddb/auto"`).

## Package Legitimacy Audit

**No external packages are installed in this phase.** All functionality is built from already-vendored dependencies (verified against `packages/app/package.json`, `packages/core/package.json`, and root `package.json`) and browser-native APIs. The Package Legitimacy Gate is therefore satisfied vacuously — there is nothing new to slopcheck.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — phase adds no dependencies) | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   ACTIVE SHOW ONLY       │  App tier (packages/app — DOM / lifecycle)   │
   (useShowSession.active)│                                              │
        │                 │  useLatestPoll hook                          │
        ▼                 │   ├─ gate: active-show? navigator.onLine?    │
   ┌──────────┐           │   │        document.visible?                 │
   │ start /  │──────────▶│   ├─ self-scheduling setTimeout loop (≥60s)  │
   │ stop /   │           │   ├─ online/offline + visibilitychange subs  │
   │ pause    │           │   └─ on tick ──────────┐                     │
   └──────────┘           └────────────────────────┼─────────────────────┘
                                                    │ inject { fetch }
                                                    ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  Core tier (packages/core — pure, zero-DOM)                       │
   │                                                                   │
   │  pollLatest({fetch})                                              │
   │    GET /latest.json  ──▶  latestSetlistRow[] (NEW zod schema)     │
   │        │                     │                                    │
   │        │                     ├─▶ assertFilterApplied(artist_id=1) │
   │        │                     │   (DATA-03 guard, reused)          │
   │        ▼                     ▼                                    │
   │  diffLatestAgainstTrail(latestRows, trailEntries)                │
   │    dedupe by song_id ──▶ next 1–2 un-logged  ──▶ Suggestion[]    │
   │                          + "???"-position matches ──▶ FillHint[] │
   │                                                                   │
   │  bindShowFromLatest(latestRows, trackedShow, today)              │
   │    wrong-show guard (date==today) ──▶ { show_id, venue } | null  │
   └───────────────────────────┬───────────────────────────────────────┘
                               │ returns plain data
                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  App tier — write-through (Dexie)                                 │
   │   adopt   ──▶ logSong(sessionId, {..., source:'editor'})          │
   │   fill ??? ──▶ renameEntry(id, songId, name, outcome)            │
   │   bind    ──▶ trackedShows.update(sessionId,{showId,venue...})   │
   │        │                                                          │
   │        ▼  useLiveQuery re-fires ──▶ trail / tally / strip rerender│
   └──────────────────────────────────────────────────────────────────┘

   ── DATA SAFETY (independent of the poll loop) ──────────────────────
   Settings route (#/settings via useHashRoute)
     Export ─▶ serializeExport(dbSnapshot) [core, pure]
              ─▶ Blob + anchor download   [app]
     Import ─▶ <input type=file> .text() [app]
              ─▶ parseAndMergeImport(json, dbSnapshot) [core, pure:
                   zod-validate ─▶ version-migrate ─▶ union-merge ─▶ dedupe]
              ─▶ bulkPut merged rows       [app]
   End Show ─▶ auto serializeExport + anchor download (D-13)
```

### Recommended Structure (new files)
```
packages/core/src/
├── ingest/
│   └── latest-types.ts      # NEW: latestSetlistRow zod schema (the 5-missing-keys fix)
├── live/                     # NEW: pure live-sync domain
│   ├── poll-latest.ts        # pollLatest({fetch}) — tolerant fetch + validate + artist_id guard
│   ├── suggest.ts            # diffLatestAgainstTrail() + resolvePlaceholders()
│   └── bind-show.ts          # bindShowFromLatest() — wrong-show guard
└── data-safety/              # NEW: pure export/import
    ├── export-schema.ts      # zod schema for { schemaVersion, exportedAt, meta, ... }
    ├── serialize.ts          # serializeExport(snapshot)
    └── merge.ts              # parseAndMergeImport() — validate + migrate + union-merge + dedupe

packages/app/src/
├── live/
│   ├── useOnlineStatus.ts    # useSyncExternalStore over navigator.onLine
│   ├── useLatestPoll.ts      # the one timer; gating + tolerant retry + adopt/bind write-through
│   ├── SuggestionStrip.tsx   # D-01 dismissible strip
│   └── SyncDot.tsx           # D-08 quiet indicator
├── settings/
│   ├── SettingsView.tsx      # export/import buttons + persist status (D-14)
│   ├── exportDownload.ts     # Blob + anchor (D-13)
│   └── importPicker.ts       # <input type=file> + File.text()
└── db/db.ts                  # EXTEND: version(3) additive migration + source field + helpers
```

### Pattern 1: The single self-scheduling poll loop (SYNC-01, SYNC-03)
**What:** One `useLatestPoll` hook owns exactly one pending timer. It schedules the *next* poll only after the current one settles (success or silent failure), never `setInterval`. Gates every tick on three conditions: an active show exists, `navigator.onLine`, and `document.visibilityState === "visible"`.
**When to use:** Mounted inside the Show view while `useShowSession().active` is defined.
**Key rules:**
- Guard against duplicate timers: store the timeout id in a `useRef`, always `clearTimeout` before scheduling and in the cleanup function.
- The minimum delay is a config constant (`POLL_INTERVAL_MS: 60_000`); adaptive backoff multiplies it when N consecutive polls returned no new rows, capped at some `POLL_MAX_INTERVAL_MS` — never below 60s (the ≤1/60s ceiling is a hard floor, SYNC-01).
- Tolerant failure (D-06): wrap the `pollLatest` call in try/catch; on any error, do nothing but schedule the next tick. No toast, no console spam beyond a single debug log.
- Cleanup on unmount AND on End Show: clearing the timer stops polling (SYNC-01: "only while a show is active").

```typescript
// Sketch — app tier, packages/app/src/live/useLatestPoll.ts
// (self-scheduling, single-timer, gated). Not verified against a running build.
function useLatestPoll(active: TrackedShow | undefined, onRows: (rows: LatestRow[]) => void) {
  const online = useOnlineStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleStreak = useRef(0);

  useEffect(() => {
    if (!active) return; // no active show → no polling (SYNC-01)
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const canPoll = navigator.onLine && document.visibilityState === "visible";
      if (canPoll) {
        try {
          const rows = await pollLatest({ fetch });   // core, tolerant
          onRows(rows);
          idleStreak.current = rows.length ? 0 : idleStreak.current + 1;
        } catch {
          /* D-06 tolerant: swallow, retry next interval */
        }
      }
      const delay = Math.min(
        config.live.POLL_INTERVAL_MS * (1 + idleStreak.current), // adaptive
        config.live.POLL_MAX_INTERVAL_MS,
      );
      timer.current = setTimeout(tick, delay);
    };

    timer.current = setTimeout(tick, config.live.POLL_INTERVAL_MS);
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [active?.sessionId, online]); // re-arm on show change / connectivity flip
}
```

### Pattern 2: Tolerant `pollLatest` in core (mirror `fetchJson`, invert the failure policy)
**What:** A core function structurally identical to `fetchJson` (User-Agent header, `AbortSignal.timeout`, envelope `error`/`data:[]` handling) but that **returns** on failure instead of throwing hard, and validates rows against the new `latestSetlistRow` schema + `assertFilterApplied({ field: "artist_id", expected: 1 })`.
**When to use:** Called by the app's poll loop with an injected `fetch`.
**Critical:** Do NOT reuse `fetchJson` unchanged — its `throw` on non-OK / `error:true` is the *build-time* hard-fail policy (D-06 explicitly contrasts this). The live poller's caller (Pattern 1) applies the tolerant retry, so `pollLatest` can either return `[]` on a soft failure or throw-for-the-caller-to-swallow; returning `{ ok, rows }` or `LatestRow[]` (empty on failure) keeps the app's catch simple. `data: []` remains a valid empty result (a show with no rows yet), never an error.

### Pattern 3: Pure dedupe → suggestions (SYNC-02, D-02)
**What:** `diffLatestAgainstTrail(latestRows, trailEntries)` — a pure function. Build a `Set<number>` of already-logged `songId`s from the trail (excluding `null`/placeholder song ids). Order `latestRows` by `position`. Return the first 1–2 rows whose `song_id` is not in the set. Returns plain `Suggestion[]` (`{ songId, songName, position, setnumber }`).
**Key rule (D-02):** The editor never contradicts a logged song — the diff only *adds* un-logged songs; it never flags disagreement on positions you've already filled. A song you already logged is simply filtered out.
**Placeholder resolution (D-04):** A companion `resolvePlaceholders(latestRows, trailEntries)` returns `FillHint[]` for trail entries that are `isPlaceholder === true` where `latest` has a real song at the matching position — surfaced as a separate dismissible suggestion, never auto-applied, adopted via the existing `renameEntry` path.

### Pattern 4: Auto-bind with wrong-show guard (D-07)
**What:** `bindShowFromLatest(latestRows, trackedShow, todayIso)` returns `{ showId, venueId, venueName, city } | null`. Returns `null` (stay provisional) unless the `latest` rows' `showdate === todayIso` AND they read as tonight's show. Never overwrites an already-bound `showId`.
**When to use:** After each successful poll, if `trackedShow.showId === null`. The app writes the returned binding via `trackedShows.update(sessionId, {...})`. Reversible because a re-import can restore the prior (unbound) state (D-07) — nothing is destroyed, only the additive binding columns are set.

### Pattern 5: Versioned export + union-merge import (PWA-04, D-09..D-12)
**What (export, D-09):** `serializeExport(snapshot)` returns `{ schemaVersion: 1, exportedAt: ISO, meta, attendedShows, trackedShows, trackedEntries }`. Pure — the app hands it a snapshot read from Dexie (`db.meta.toArray()` etc.).
**What (import, D-10/D-11/D-12):** `parseAndMergeImport(rawJson, localSnapshot)`:
1. `JSON.parse` inside try/catch → clean reject on syntax error (D-12).
2. zod-validate against the export schema → clean reject with a specific message on shape mismatch (D-12). **Do not partial-merge a failed file.**
3. Version-migrate: if `schemaVersion < current`, run forward-migration transforms (D-12). Design the migration chain as an ordered list of `(n)→(n+1)` pure functions so future exports upgrade cleanly.
4. Union-merge by stable keys, **never dropping local rows** (D-10): `attendedShows` by `show_id`; `trackedShows` by `sessionId`; `trackedEntries` by `(sessionId, position)` or the entry's natural identity. Incoming rows that don't collide are added; collisions keep the richer set (Claude's-discretion tiebreak) but never delete a local-only row.
5. Same-show dedupe (D-11): after merge, collapse `trackedShows` that share a bound `show_id` (or share `date` when both unbound) into one attendance for dex purposes — keep the richer setlist, so phone+iPad imports don't double-count.
**Return:** the merged snapshot for the app to `bulkPut`. All of steps 1–5 are pure and Node-testable.

### Pattern 6: Settings route via existing hash routing (D-14)
**What:** Add `"settings"` to the `ROUTES` tuple in `useHashRoute.ts` (it is a security allow-list — extending it is the correct, validated way to add a view). Add a Settings entry to `BottomTabBar` (or a gear button in `AppShell`'s header that `navigate("settings")`s). `SettingsView` hosts Export/Import buttons + the persist-status readout (reads `getMeta("persistStatus")`).
**Note:** `AppShell` already renders a header "Menu" button (`onMenuClick`) that is currently unwired — a natural gear/settings entry point if a 4th bottom tab feels heavy.

### Anti-Patterns to Avoid
- **`setInterval` for polling:** overlapping requests when a fetch runs long; harder to back off. Use the self-scheduling `setTimeout` chain.
- **Reusing `rawSetlistRowCensus.parse` on `latest` rows:** throws on the 5 missing keys (see §Common Pitfalls). Use the new `latestSetlistRow` schema.
- **Reusing `fetchJson` unchanged for the live poll:** its hard-fail-no-retry is a build-time policy; the live poll must be tolerant (D-06).
- **Trusting `navigator.onLine === true`:** it can be a false positive; only `false` is authoritative (§Pitfall 2).
- **Mutating `version(1)`/`version(2)` schemas:** additive-only migration rule (D-03, established in `db.ts`).
- **`dangerouslySetInnerHTML` on any imported/`latest` string field:** `shownotes`/`venuename` are untrusted editor content (SCHEMA §12). React's default escaping is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive re-render after adopt/import | Manual `useState` mirror of the trail | `useLiveQuery` (already in `useShowSession`) | DB is the single source of truth (SHOW-11); a write re-fires the query. |
| Row validation for `latest` | Hand-written field checks | A zod `latestSetlistRow` schema | zod is already the ingestion validator; import validation (D-12) needs it too. |
| IndexedDB migration | Manual object-store versioning via raw IDB | Dexie `.version(3).stores({...})` (additive) | Dexie handles the upgrade transaction; raw IDB is the footgun CLAUDE.md forbids. |
| File download | A library | `Blob` + `URL.createObjectURL` + `a.download` | ~6 lines, zero deps, works on iOS. |
| File read | `FileReader` event dance | `File.text()` (returns a Promise) | Modern, promise-based, no boilerplate. |
| Online detection | A polling heartbeat to a server | `navigator.onLine` + events | Heartbeats violate API etiquette; the tolerant-retry loop absorbs false-online. |
| Artist-scope enforcement | New guard | `assertFilterApplied` (reuse) | DATA-03 requires the poller to enforce `artist_id===1`; the guard already exists and handles the silent-filter-ignore trap. |

**Key insight:** This phase's complexity is in *correctness under adverse lifecycle* (offline flaps, backgrounded PWA, force-quit mid-poll) and *never losing data on merge* — not in any algorithm that warrants a library. Keep the surface small and the pure functions exhaustively unit-tested.

## Runtime State Inventory

This is not a rename/refactor phase, but it *introduces* new runtime/stored state that Phase 6 will consume. Recorded here so the migration is designed additive-friendly.

| Category | Items | Action Required |
|----------|-------|------------------|
| Stored data (new) | `trackedEntries.source: 'manual'\|'editor'`; `trackedShows.showId`/`venueId`/`venueName`/`city` binding columns | Dexie `version(3)` additive migration; backfill `source: 'manual'` for existing rows (Dexie upgrade callback) |
| Stored data (new) | `meta` keys: e.g. `lastExportAt`, `endShowAutoExportDone`, `persistWarningShown` (backup-nudge bookkeeping, D-13) | Written via existing `setMeta`; no schema change (meta is `&key`) |
| Live service config | None — no external service config is stored (no accounts, no backend) | None — verified: the only network call is the public `latest` GET |
| OS-registered state | None | None — verified: no Task Scheduler / launchd / service worker registration changes beyond the existing precache |
| Secrets/env vars | None | None — verified: kglw.net API is unauthenticated (`config.apiBase`, no key) |
| Build artifacts | Service worker precache manifest (vite-plugin-pwa) regenerates on build | None extra — export/import is runtime data, not a precached asset |

**Migration backfill note:** existing `version(2)` `trackedEntries` rows have no `source`. A Dexie `.version(3).upgrade()` callback should set `source = 'manual'` on all existing entries so the Phase-6 recap's manual-vs-editor decomposition is never `undefined`.

## Common Pitfalls

### Pitfall 1: `latest.json` is missing 5 keys — reusing the corpus schema throws (PLANNING-CRITICAL)
**What goes wrong:** `latest.json` rows omit `css_class`, `isrecommended`, `tracktime`, `timezone`, and `showtime` (docs/SCHEMA.md §11). `rawSetlistRowCensus` (api-types.ts) is a `z.strictObject`; of the missing keys, `css_class` (`z.string().nullable()`), `isrecommended` (`z.number().nullable()`), and `tracktime` (`z.string().nullable()`) are **required keys** — `.nullable()` permits the value `null` but does NOT make the key optional. `showtime` and `timezone` are `z.unknown()` (tolerant of absence). So `rawSetlistRowCensus.parse(latestRow)` **throws** on the three nullable-but-required keys.
**Why it happens:** Intuition says "latest rows are setlist rows, reuse the schema." The key-subset difference is documented but easy to miss.
**How to avoid:** Author a **new `latestSetlistRow` zod schema** in `packages/core/src/ingest/latest-types.ts`. Validate only the fields the poller consumes (`show_id`, `showdate`, `song_id`, `songname`, `artist_id`, `position`, `setnumber`, `settype`, `venue_id`, `venuename`, `city`). Prefer `z.strictObject` on the observed `latest` shape (drift detection) OR derive via `rawSetlistRowCensus.pick({...})` for the shared fields — but do NOT require the 5 absent keys.
**Warning signs:** A zod parse error naming `css_class`/`isrecommended`/`tracktime` "Required" the first time the poller runs against real data.
**Confidence:** HIGH — verified directly against api-types.ts (lines 68–70: `css_class: z.string().nullable()`, `isrecommended: z.number().nullable()`; line 40: `tracktime: z.string().nullable()`) and SCHEMA §11.

### Pitfall 2: `navigator.onLine` is a one-directional truth
**What goes wrong:** `navigator.onLine === true` does not guarantee real connectivity (it can be true on a captive-portal or dead-Wi-Fi network); `false` is reliable (the device knows it has no interface). Treating `true` as "definitely reachable" causes confident polls that silently fail.
**Why it happens:** The API name implies a boolean truth it doesn't provide.
**How to avoid:** Treat `false` as authoritative-offline (pause polling, flip the sync dot). Treat `true` as *permission to try* — the tolerant-retry policy (D-06) absorbs the false-positive: a poll that fails just retries next interval. The sync dot should reflect the *last poll outcome* combined with `navigator.onLine`, not `navigator.onLine` alone.
**Warning signs:** Sync dot shows "online" while every poll fails behind a captive portal.
**Confidence:** HIGH — long-documented browser behavior; consistent across MDN and vendor docs.

### Pitfall 3: Timer leaks and double-polls across re-renders
**What goes wrong:** A poll effect that re-runs on every render (or whose deps churn) can create multiple overlapping timers, each firing its own `latest` request — silently violating the ≤1/60s etiquette ceiling.
**How to avoid:** Single `useRef<timeout>`, always `clearTimeout` before scheduling and in the effect cleanup. Keep the effect's dependency array minimal and stable (`active?.sessionId`, `online`). Self-scheduling `setTimeout` (Pattern 1) means at most one pending timer by construction.
**Warning signs:** More than one request per 60s in the network panel; multiple "poll tick" debug logs per interval.
**Confidence:** HIGH — standard React effect pitfall.

### Pitfall 4: iOS Safari freezes timers when the PWA is backgrounded
**What goes wrong:** When the installed PWA is backgrounded (user checks a text mid-show), iOS suspends timers and may discard state. A poll scheduled for "60s from now" may not fire until foreground, and the app may relaunch fresh.
**How to avoid:** Gate polling on `document.visibilityState === "visible"` (Pattern 1) so you don't fight the OS; reacquire on `visibilitychange` back to visible (same idiom as `wakeLock.ts`). The write-through model (SHOW-11) already means relaunch restores the trail from Dexie — the poll loop simply re-arms when the active show re-mounts.
**Warning signs:** Suggestions stop updating after backgrounding until the app is foregrounded (this is acceptable/expected, not a bug — just don't *assume* background polling works).
**Confidence:** HIGH — consistent with the documented iOS PWA freeze behavior already handled for wake lock and SHOW-11.

### Pitfall 5: Import that partial-merges a bad file corrupts the local dex
**What goes wrong:** Streaming/partial application of an import before full validation can leave the DB half-merged if the file is truncated or malformed.
**How to avoid (D-12):** Validate-then-merge as one atomic sequence — `JSON.parse` → zod-validate → migrate → merge entirely in memory (pure `parseAndMergeImport`), and only `bulkPut` the fully-merged result inside a single Dexie `rw` transaction. Reject before touching the DB on any validation failure.
**Warning signs:** A rejected import that nonetheless changed local data.
**Confidence:** HIGH — direct consequence of D-10/D-12.

### Pitfall 6: Same-show double-count on multi-device import (D-11)
**What goes wrong:** Phone and iPad each tracked the same night under different `sessionId`s. A naive union-merge keeps both `trackedShows` rows → the dex counts that night twice.
**How to avoid:** After the union-merge, collapse tracked shows sharing a bound `show_id` (or the same `date` when both are unbound) into a single attendance, keeping the richer setlist. This is a post-merge dedupe pass, tested with a fixture pair.
**Warning signs:** Attendance count jumps after importing a second device's file for a night already present.
**Confidence:** HIGH — explicit in D-11.

## Code Examples

### Reference: the existing tolerant browser-API idiom to mirror (persist.ts)
The poller and all new browser-API touchpoints should follow `packages/app/src/pwa/persist.ts` and `packages/app/src/wakeLock.ts`: feature-detect, wrap every call in try/catch, **never throw**, record/return a status. This is the house style for adverse-lifecycle code.

### Reference: the injected-deps seam to mirror (fetch-corpus.ts)
`pollLatest` should take `deps: { fetch: typeof globalThis.fetch }` (and optionally `sleep`) exactly like `FetchDeps` in `fetch-corpus.ts`, so Node tests inject a mock `fetch` returning canned `latest` envelopes — no network, deterministic.

### Reference: additive migration shape to extend (db.ts)
```typescript
// packages/app/src/db/db.ts — EXTEND, do not rewrite v1/v2.
// version(3): additive columns + backfill. (Sketch — verify indexes at plan time.)
this.version(3).stores({
  // add binding fields as indexes only if queried; `source` need not be indexed.
  trackedShows: "&sessionId, status, date, showId",
  trackedEntries: "++id, sessionId, [sessionId+position], source",
}).upgrade(async (tx) => {
  await tx.table("trackedEntries").toCollection().modify((e) => {
    if (e.source === undefined) e.source = "manual"; // backfill
  });
});
```
Note: only add an index for a column you actually query on (`showId` for date/id reconciliation; `source` likely does not need an index — Phase 6 filters in memory). Confirm at plan time.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `FileReader` + `onload` callbacks | `Blob.text()` / `File.text()` promises | Simpler import; already safe on all Phase-5 targets |
| `setInterval` polling | Self-scheduling `setTimeout` chain | No overlap; trivial adaptive backoff |
| Manual IDB migrations | Dexie versioned `.stores()` + `.upgrade()` | Established in this repo already |

**Deprecated/outdated:** none relevant — the vendored stack (verified 2026-07-08 in CLAUDE.md) is current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `latest.json` rows carry `song_id`, `position`, `showdate`, `venue_id`/`venuename`/`city`, `setnumber`, `settype` (the fields the poller/binder need), just not the 5 documented-missing keys | Pitfall 1, Patterns 3–4 | If `latest` omits *more* than the 5 documented keys (e.g. no `position`), dedupe-by-position and binding need a different key. **Mitigation:** capture one real `latest.json` sample early in the phase (a single polite manual fetch) and lock the schema against it — do NOT design the whole poller before confirming the shape. |
| A2 | `latest.json` returns rows for the single most-recent show (SCHEMA §9 says it "has returned a Stu Mackenzie solo set as the most recent show") | Pattern 4 binding | If `latest` can return the wrong band's show, the `artist_id===1` guard + wrong-show/date guard (D-07) already handle it (stay provisional). Low risk given the guards. |
| A3 | Adaptive backoff (slow-when-idle) is desirable; a fixed 60s is acceptable if simpler | Pattern 1 | None — D-06 makes adaptivity explicitly optional / Claude's-discretion. Ship fixed-60 if time-constrained. |
| A4 | `File.text()` and anchor-download work on the installed iOS PWA target | Standard Stack | If a target iOS version balks at anchor `download` inside a standalone PWA, fall back to opening the JSON in a new tab / share sheet. **Mitigation:** on-device check during the phase's device gate. |

**These `[ASSUMED]` items — especially A1 — should be confirmed with a single real `latest.json` sample before the poller schema is finalized.** Everything else in this research is verified against committed code or documented schema.

## Open Questions

1. **Exact `latest.json` field set.**
   - What we know: SCHEMA §11 documents 5 keys that are *absent* vs. corpus rows; §9 confirms side-project shows can appear.
   - What's unclear: the full positive key list and whether `position`/`setnumber` are always present.
   - Recommendation: Plan a first task that captures one committed `data/samples/latest.sample.json` via a single manual polite fetch, then author `latestSetlistRow` against it (mirrors how the corpus schema was locked against real samples).

2. **Settings surface: 4th bottom tab vs. header gear (D-14, Claude's discretion).**
   - What we know: `BottomTabBar` has 3 tabs; `AppShell` has an unwired header "Menu" button.
   - Recommendation: Prefer wiring the existing header Menu/gear button to `navigate("settings")` — adds prominence without crowding the 3-tab bar or the one-thumb reach zone. Defer final call to `/gsd-ui-phase`.

3. **Merge tiebreak when two files disagree on the same show's entries (Claude's discretion, D-10).**
   - Recommendation: "richer set wins" = keep the tracked show with more `trackedEntries` for that `show_id`/`date`; never delete local-only entries. Encode as a pure, tested rule.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node ≥ 24.12 (native TS exec) | Core CLI/tests | ✓ (project baseline) | per CLAUDE.md | tsx |
| kglw.net `latest.json` endpoint | Live poll (SYNC-01) | ✓ (public, unauthenticated) | API v2 | Offline path is a first-class state (SYNC-03) — absence is handled, not blocking |
| `fake-indexeddb` | App migration + import tests | ✓ | 6.2.5 (root devDep, wired in test/setup.ts) | — |
| Browser `navigator.storage.persist` | Backup nudge (D-13) | ✓ (already used in persist.ts) | — | best-effort status already handled |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the `latest` endpoint's unavailability is a designed-for state (offline), not a blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`projects`: core=`node`, app=`jsdom`) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `pnpm vitest run <file>` (or `npx vitest run <file>`) |
| Full suite command | `pnpm vitest run` |
| IndexedDB in tests | `fake-indexeddb/auto` (already imported in `packages/app/test/setup.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | `pollLatest` sends User-Agent, validates `latest` rows, enforces `artist_id===1`, returns `[]` (not throw) on failure | unit (node, injected `fetch`) | `vitest run packages/core/test/poll-latest.test.ts` | ❌ Wave 0 |
| SYNC-01 | New `latestSetlistRow` schema accepts a real `latest` row missing the 5 keys; rejects unknown keys | unit (node) | `vitest run packages/core/test/latest-types.test.ts` | ❌ Wave 0 |
| SYNC-01 | Poll loop schedules ≤ 1/60s, single timer, clears on unmount | unit (jsdom, fake timers) | `vitest run packages/app/test/useLatestPoll.test.tsx` | ❌ Wave 0 |
| SYNC-02 | `diffLatestAgainstTrail` dedupes by `song_id`, returns only next 1–2 un-logged, never contradicts logged songs | unit (node) | `vitest run packages/core/test/suggest.test.ts` | ❌ Wave 0 |
| SYNC-02 | Adopt writes `logSong(..., source:'editor')` and reclassifies hit/miss against `shownFanSongIds` | integration (jsdom+fake-idb) | `vitest run packages/app/test/adopt.test.tsx` | ❌ Wave 0 |
| SYNC-02 | `resolvePlaceholders` surfaces a fill hint only where trail entry `isPlaceholder` and `latest` has a song at that position | unit (node) | `vitest run packages/core/test/suggest.test.ts` | ❌ Wave 0 |
| SYNC-03 | Loop pauses when `navigator.onLine===false` / hidden; resumes on online + visible | unit (jsdom) | `vitest run packages/app/test/useLatestPoll.test.tsx` | ❌ Wave 0 |
| SYNC-03 | `bindShowFromLatest` returns null unless `showdate===today` (wrong-show guard); never overwrites bound `showId` | unit (node) | `vitest run packages/core/test/bind-show.test.ts` | ❌ Wave 0 |
| PWA-04 | `serializeExport` produces the D-09 shape with `schemaVersion` | unit (node) | `vitest run packages/core/test/serialize.test.ts` | ❌ Wave 0 |
| PWA-04 | `parseAndMergeImport` union-merges, never drops local rows, dedupes same-show across sessionIds (D-11) | unit (node) | `vitest run packages/core/test/merge.test.ts` | ❌ Wave 0 |
| PWA-04 | Import rejects malformed/corrupt JSON with a clear message, no DB mutation (D-12) | unit (node) + integration | `vitest run packages/core/test/merge.test.ts` | ❌ Wave 0 |
| PWA-04 | Export→import round-trip through Dexie preserves all data (lose-a-phone) | integration (jsdom+fake-idb) | `vitest run packages/app/test/exportImportRoundtrip.test.ts` | ❌ Wave 0 |
| PWA-04 | `version(3)` migration is additive; existing entries backfill `source:'manual'`; v1/v2 data survives | integration (fake-idb) | `vitest run packages/app/test/migrationV3.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new test file(s) for that task (e.g. `vitest run packages/core/test/merge.test.ts`).
- **Per wave merge:** `pnpm vitest run` (full suite — core + app).
- **Phase gate:** full suite green before `/gsd-verify-work`, plus the on-device gate (iOS installed PWA: real `latest` poll, offline flap, End-Show auto-download, import round-trip).

### Wave 0 Gaps
- [ ] `packages/core/test/latest-types.test.ts` — new `latest` schema (SYNC-01)
- [ ] `packages/core/test/poll-latest.test.ts` — tolerant poller with injected `fetch` (SYNC-01)
- [ ] `packages/core/test/suggest.test.ts` — dedupe + placeholder resolution (SYNC-02)
- [ ] `packages/core/test/bind-show.test.ts` — wrong-show guard (SYNC-01/D-07)
- [ ] `packages/core/test/serialize.test.ts` + `merge.test.ts` — export/import (PWA-04)
- [ ] `packages/app/test/useLatestPoll.test.tsx` — timer/lifecycle/offline gating (needs Vitest fake timers)
- [ ] `packages/app/test/migrationV3.test.ts` — additive migration + backfill (fake-indexeddb)
- [ ] `packages/app/test/exportImportRoundtrip.test.ts` — full round-trip through Dexie
- [ ] A committed `data/samples/latest.sample.json` fixture from one real polite fetch (unblocks the schema — see Open Question 1)
- [ ] Config additions (`config.live.POLL_INTERVAL_MS`, `POLL_MAX_INTERVAL_MS`, `SUGGESTION_COUNT`, export `SCHEMA_VERSION`) + copy strings in `packages/app/src/config.ts`

*Framework install: none needed — Vitest + fake-indexeddb already present.*

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no backend (project constraint). |
| V3 Session Management | no | No server sessions. |
| V4 Access Control | no | Single-user local tool. |
| V5 Input Validation | **yes** | **Two untrusted inputs:** (1) the `latest` API response — validate with the new `latestSetlistRow` zod schema + `assertFilterApplied(artist_id===1)`; (2) the imported JSON file — zod-validate the whole export envelope, reject-don't-partial-merge (D-12). |
| V6 Cryptography | no | No secrets; unauthenticated public API. |
| V7 Error Handling / Logging | yes | Tolerant poll failures are swallowed silently (D-06); never leak stack traces to UI. Import errors surface a clean user message, not raw exceptions. |
| V14 Config | yes | Single-config-file constants (poll cadence, schema version) — no scattered literals (CLAUDE.md). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/corrupt import file corrupts local dex | Tampering | zod-validate + version-migrate + in-memory merge, atomic `bulkPut`; reject before any DB write (D-12, Pitfall 5) |
| Untrusted editor content (`shownotes`/`venuename` from `latest`) rendered as HTML | Tampering / XSS | React default JSX escaping; NEVER `dangerouslySetInnerHTML` on these fields (SCHEMA §12) |
| Silent filter-ignore feeds another band's rows into the trail | Tampering | `assertFilterApplied({field:"artist_id",expected:1})` (reused, DATA-03) |
| Over-polling a volunteer-run site | (etiquette / DoS-adjacent) | ≤1/60s hard floor, active-show-only gate, single-timer construction, adaptive backoff (SYNC-01/D-06) |
| Import file path/prototype pollution via crafted keys | Tampering | zod `strictObject` on the export envelope rejects unexpected keys; merge by an explicit key allow-list, never `Object.assign` of arbitrary keys |

## Sources

### Primary (HIGH confidence)
- `packages/core/src/ingest/api-types.ts` — `rawSetlistRowCensus` strictObject; `css_class`/`isrecommended`/`tracktime` are `.nullable()` required keys (the Pitfall-1 finding).
- `packages/core/src/cli/fetch-corpus.ts` — `fetchJson` idiom + `FetchDeps` injection seam + hard-fail policy to invert.
- `packages/core/src/ingest/validate.ts` — `assertFilterApplied` (DATA-03 reuse).
- `packages/app/src/db/db.ts` — v1→v2 additive migration pattern; `logSong`/`renameEntry`/write helpers; `TrackedShow.showId` reconciliation seam.
- `packages/app/src/show/useShowSession.ts` — `useLiveQuery` reactive session (adopt/import re-render seam).
- `packages/app/src/pwa/persist.ts` + `packages/app/src/wakeLock.ts` — the never-throw browser-API idiom + `visibilitychange` lifecycle pattern.
- `packages/app/src/routing/useHashRoute.ts` + `components/BottomTabBar.tsx` + `AppShell.tsx` — Settings-route extension point (ROUTES allow-list; unwired header Menu button).
- `docs/SCHEMA.md` §9, §11, §12 — `latest.json` missing-keys, side-project rows, silent-filter-ignore, untrusted-content note.
- `vitest.config.ts` + `packages/app/test/setup.ts` + `packages/app/test/db.test.ts` — test projects + `fake-indexeddb/auto` wiring + Dexie round-trip test shape.
- `packages/{core,app}/package.json` + root `package.json` — verified versions (zod 4.4.3, dexie 4.4.4, dexie-react-hooks 4.4.0, react 19.2.7, fake-indexeddb 6.2.5); confirms **no new deps needed**.

### Secondary (MEDIUM confidence)
- CLAUDE.md recommended-stack table (versions verified 2026-07-08 via `npm view`) — corroborates the vendored versions.

### Tertiary (LOW confidence)
- None — this phase required no external web research; all findings are grounded in committed code or documented schema.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all versions verified in lockfile/package.json.
- Architecture: HIGH — every pattern maps onto an existing codebase idiom (injected-deps core fn, `useLiveQuery`, additive migration, never-throw browser API, hash-route allow-list).
- Pitfalls: HIGH — the load-bearing Pitfall 1 (`latest` schema) is verified against exact source lines; offline/timer/iOS pitfalls are well-established and already handled analogously in this repo.
- The one genuine unknown (A1: exact `latest.json` field set) is flagged as an Open Question with a concrete first-task mitigation.

**Research date:** 2026-07-11
**Valid until:** ~2026-08-11 (stable stack; re-verify only if the vendored versions change)

---

## RESEARCH COMPLETE

**Phase:** 5 - Live Sync & Data Safety
**Confidence:** HIGH

### Key Findings
- **PLANNING-CRITICAL:** `latest.json` is missing 5 keys (`css_class`, `isrecommended`, `tracktime`, `timezone`, `showtime`); `rawSetlistRowCensus` is a `strictObject` where `css_class`/`isrecommended`/`tracktime` are `.nullable()` **but required**, so parsing a `latest` row with it **throws**. A new `latestSetlistRow` zod schema is required — do NOT reuse the corpus schema.
- **No new dependencies.** The entire phase is buildable from vendored libs (zod 4.4.3, dexie 4.4.4, dexie-react-hooks 4.4.0, react 19.2.7) + browser-native APIs. Package Legitimacy Gate satisfied vacuously.
- The `latest` poller should mirror `fetch-corpus.ts`'s injected-`{fetch}` seam but **invert the failure policy** (tolerant silent-retry, D-06) — a single self-scheduling `setTimeout` loop in an app hook, gated on active-show + `navigator.onLine` + visibility.
- Offline detection: `navigator.onLine === false` is authoritative; `true` is only "permission to try" (tolerant retry absorbs false-online).
- Export/import is a pure core `serialize`/`parseAndMergeImport` pair (zod-validate → version-migrate → union-merge → same-show dedupe), never dropping local rows (D-10) and never partial-merging a bad file (D-12); DOM download/upload stays in the app.
- `version(3)` is additive: `trackedEntries.source` (+ backfill `'manual'`) and `trackedShows` binding columns; testable with the already-wired `fake-indexeddb`.

### File Created
`.planning/phases/05-live-sync-data-safety/05-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new deps; versions verified in lockfile/package.json |
| Architecture | HIGH | Every pattern maps onto an existing repo idiom |
| Pitfalls | HIGH | Load-bearing schema pitfall verified against exact source lines |

### Open Questions
- Exact positive field set of `latest.json` (A1) — mitigate by capturing one committed `data/samples/latest.sample.json` in the phase's first task before finalizing the schema.
- Settings surface: 4th bottom tab vs. wiring the existing header Menu/gear button (Claude's discretion — recommend the header gear).
- Merge tiebreak when two files disagree on a show's entries (recommend "richer set wins", never delete local).

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
