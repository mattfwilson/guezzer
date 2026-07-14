# Phase 6: Pokédex, History & Stats - Research

**Researched:** 2026-07-14
**Domain:** Derived-collection stats over existing corpus/Dexie substrate; build-time asset pipelines (album covers, archive index); canvas share card; Web Share API; Show-Mode UI polish
**Confidence:** HIGH (nearly all findings verified directly against the repo's data files and code; external claims verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pokédex Layout & Organization (DEX-03/04, STAT-03/04)**
- **D-01:** The Dex tab is a **card grid aggregated by ALBUM**, each card showing the **album cover** and a **caught/total tally**. Tapping an album opens its **song list** with seen/unseen highlighting (derived checkmarks). NOT a flat 264-song grid or list.
- **D-02:** Default sort: **alphabetical by album name**.
- **D-03:** **Album covers are fetched once at build time and bundled** as small thumbnails (offline-first; no runtime fetching). Source is Claude's discretion (kglw.net album pages, MusicBrainz/Cover Art Archive, or similar).
- **D-04:** **Song→album mapping: canonical studio album** (islive=0, earliest release date from `data/raw/albums.json`, filtered to artist_id=1). Live-album-only/unreleased songs → a **Miscellaneous** bucket; covers of other artists → a **Covers** bucket. Every catchable song appears somewhere; the album grid should represent the **full studio discography**.
- **D-05:** Seen/unseen state in the album view is **display-only, derived from attendance** — never a manual toggle (locked DEX-03).
- **D-06:** Never-seen songs render **dimmed/silhouetted in the same view**.
- **D-07:** **Stats placement:** overall completion %, rarest catch, and show count in a **header above the album grid**; per-song stats (sighting count, personal gap, last-seen, debut badge) in the **album song-list rows**.
- **D-08:** **Debut-candidate framing (STAT-04) badges everywhere** — dex entries AND the Show Mode orb why-detail.

**Retroactive Attendance Marking (DEX-02)**
- **D-09:** Archive search runs **corpus-first (bundled 738 shows, fully offline)** with an **online kglw.net search fallback for very recent shows**. Live lookups must follow the established API etiquette (polite, filtered, validated).
- **D-10:** Finding shows: **browse by year (newest first) + text search** over date/venue/city.
- **D-11:** Marking a show **auto-credits its full corpus setlist as sightings** — one tap per show, pure derivation. No per-song confirm step.
- **D-12:** **One-tap unmark** (confirm acceptable) with all derived counts recomputing from remaining attendance.

**Post-Show Recap & History (SHOW-14, STAT-02, HIST-01)**
- **D-13:** The recap **auto-appears after End Show** and remains reachable from show history.
- **D-14:** Recap contents: **hit/miss tally + %**, **manual-vs-editor decomposition** (Phase 5 `source` tags), **rarity score + rarest catch of the night**, **new catches ("+N new")**, and the final setlist with set structure.
- **D-15:** **Rarity is a game-style tier system — Common / Uncommon / Rare / Legendary — derived from actual play data**. Thresholds data-driven (quantiles over the corpus), constants in the single config file. Claude may enrich with additional honest, data-backed metrics. Underlying honest numbers (gap, play count, last played — STAT-01) stay available in song detail.
- **D-16:** **Show history lives in the Dex tab** (a Shows section/segment alongside Albums) — newest-first, tap → full setlist / recap. No new bottom-bar tab.

**Dex Sharing (SHAR-01/02)**
- **D-17:** **A friend's imported file opens a compare view and NEVER merges**. Your own backup restore keeps the Phase 5 merge path. The export envelope gains an **owner name/id**. A friend's file must never silently inflate your attendance.
- **D-18:** Summary card is a **canvas-rendered PNG image**: completion %, rarest catch, show count, **rarity-tier breakdown**, **total songs caught (87/264)**, and **latest/best show**.
- **D-19:** Sharing via **Web Share API (`navigator.share`) with image-download fallback** where unsupported.

**Folded UI-Polish Pass (Show Mode / shell)**
- **D-20:** **FAB menu — everything collapses.** All five Show-Mode actions (Search, ???, Set break, Encore, Undo) into a single collapsed-by-default FAB anchored bottom-right. Owner accepts the extra tap on ???/Undo. Must respect ≥44px floor, `env(safe-area-inset-bottom)` + BottomTabBar inset accounting, gesture-suppression scope, and re-check the non-scrolling AppShell seam.
- **D-21:** **Orb song-name text fix**: song names readable in full — dynamic fit/wrap; keep SHOW-02 tap-target floors; constants in config.
- **D-22:** **InstallBanner shows at most once per app version** — persist a seen/dismissed flag keyed on a stable build version (meta-table idiom like `PERSIST_WARNING_SHOWN`).

### Claude's Discretion
- Album-cover source and build-time pipeline (D-03) — including image sizing/format and attribution needs.
- Where the app gets the show→songIds archive index: shipping a compact build-time derivation of the corpus vs importing `corpus.json` — pick the smallest artifact that serves DEX-02/DEX-03 offline.
- Exact rarity-tier thresholds and any bonus recap metrics (D-15) — data-driven, config-file constants, honest framing.
- Dex derivation module design in `packages/core` (pure, fixture-tested — EVAL-05 explicitly covers dex derivation).
- Dexie migration shape (additive `version(4)` if needed) following the additive-only rule.
- Compare-view layout and diff detail; recap visual design; year-browse UX specifics (06-UI-SPEC governs).
- Live-API recent-show search specifics (endpoint choice, validation) — must reuse core ingestion schemas + `assertFilterApplied`.

### Deferred Ideas (OUT OF SCOPE)
- **Constellation dex overlay** (dimmed silhouettes / badges on the graph) — Phase 7 (DEX-05).
- **Real-time friend sync / shared leaderboards** — v2 (SOCL-V2-01); the compare view is the v1 answer.
- **Destructive "clear all data" in Settings** — still deferred.
- **Suppress the update toast during an active tracked show** — carried, unclaimed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOW-14 | Post-show recap view: hit/miss tally, final setlist with set structure, show rarity score | §Recap integration seam (EndShowDialog → recap state in ShowView); tally/source/setNumber all already on `trackedEntries` (verified in db.ts); rarity from §Rarity tiers |
| STAT-01 | Song detail shows gap, play count, last-played date | §Archive artifact — gap/playCount/lastPlayed are derivable only from the show-ordered archive, NOT from matrix nodes (verified: `MatrixNode` has `playCount` but no last-played/gap); WhyDetail is the Show-Mode surface to extend |
| STAT-02 | Recap includes show rarity score (average gap of the night's songs) | §Rarity tiers — per-song gap from archive; average over the night's non-placeholder entries; config-resident |
| STAT-03 | Pokédex shows personal gap ("N of your shows since you last saw it") | §Dex derivation — user's attendance timeline (attendedShows ∪ trackedShows, deduped) ordered by date |
| STAT-04 | Zero-live-history songs framed as "debut candidates", never fake percentages | §Album mapping — album-track lists include songs NOT in the 264-song matrix catalog; those are the debut candidates by construction |
| DEX-02 | Retroactively mark attended shows from full archive, searchable by date/venue, keyed by stable show ID | §Attendance substrate — the existing v1 `attendedShows` table (`&show_id, showDate`) is written nowhere today (verified by grep) and is the exact retro-mark substrate; §Archive artifact for offline browse/search; §Online fallback for post-corpus shows |
| DEX-03 | Sighting counts derived from attended shows — never hand-tallied | §Dex derivation — pure core fn over (attendance rows + archive setlists + tracked entries) |
| DEX-04 | Completion %, per-song sighting counts, rarest catch, never-seen list | §Dex derivation + §Rarity tiers; denominator = 264 matrix catalog (verified nodeCount) |
| HIST-01 | Past tracked shows viewable as complete setlists with set structure | `trackedEntries.setNumber` already snapshots set structure (verified); retro-marked shows render from archive `sets` |
| SHAR-01 | Dex exports/imports as JSON for friend exchange | §Envelope v2 — owner field + `MIGRATIONS` chain already wired for version bumps (verified in merge.ts); compare path = zero DB writes |
| SHAR-02 | Shareable summary card (completion %, rarest catch, show count) | §Share card — canvas draw + `navigator.canShare({files})` + download fallback (exportDownload idiom exists) |
</phase_requirements>

## Summary

Phase 6 is almost entirely **derivation over structures that already exist**. The Dexie substrate (`attendedShows`, `trackedShows`, `trackedEntries` with `source`/`setNumber`/`outcome`), the export envelope with a wired-but-empty migration chain, the zod ingestion schemas with `assertFilterApplied`, fuse.js search, `useLiveQuery` reactivity, and the meta-flag idiom are all in place and verified. **No new runtime dependency is needed.** The one new package is `sharp` (devDependency, build-time image processing for cover thumbnails) — slopcheck-verified `[OK]`.

The two genuinely new build-time artifacts are (1) a **compact archive index** derived from `corpus.json` (measured: ~141 KB raw vs 4.86 MB for the full corpus — bundling raw corpus.json is out of the question) and (2) an **album-mapping artifact + bundled cover thumbnails**. Research uncovered a critical data landmine here: **the locked D-04 heuristic (`islive=0`, earliest release date) is empirically insufficient on its own** — verified against `data/raw/albums.json`: recent official live albums ("Live in Athens '25", 50 tracks) carry `islive: 0`, singles predate the LPs that carry their songs ("Hey There / Ants & Bats" 2010 vs "12 Bar Bruise" 2012), album titles are not unique keys ("Fishing For Fishies" appears twice; "Phantom Island " has a trailing-space duplicate), and `releasedate` carries dirty "(N)" suffixes. The mapping must therefore be: **config-resident card-album allowlist keyed by `album_url`** + earliest-dated card album containing the song's slug + Covers/Miscellaneous buckets, with a drift-guard test.

The riskiest integration seams are: the **export envelope v2** (owner name + persisted online-fallback setlists must ship together with the Dexie `version(4)` table, or data is silently lost on backup round-trip), the **friend-compare fork** (must never touch the DB — the merge path is one function call away), and the **Web Share transient-activation pitfall** (generate the PNG file *before* the share tap, or iOS throws `NotAllowedError`).

**Primary recommendation:** Build everything stats-shaped as pure core functions over a single new `deriveDex(snapshot, archive, albums, config)` entry point — it serves the dex header, album rows, recap, compare view (run it twice: yours + friend's), and share card from one fixture-tested pipeline.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Archive index derivation (corpus → compact JSON) | Build-time (core CLI) | — | One-time derivation, committed artifact; corpus/matrix pattern |
| Album mapping derivation (albums.json → cards/buckets) | Build-time (core CLI) | Core (pure fns, fixture-tested) | Raw albums.json is 2,750 dirty rows; never ship raw |
| Cover fetch + thumbnail pipeline | Build-time (standalone script) | — | Network + sharp; manual re-run only, never CI |
| Dex derivation (sightings, completion, gaps, tiers, rarest) | Core (pure TS) | App renders via `useLiveQuery` | EVAL-05 names dex derivation; strict core/UI separation |
| Rarity tiers + show rarity score | Core (pure TS) | — | Data-driven quantiles; config in `packages/core/src/config.ts` |
| Archive browse/search (dates/venues) | Core (pure fn, fuse.js) | App view | `searchCatalog` idiom |
| Retro mark/unmark writes | App (db.ts write helpers) | — | Dexie writes are app-tier by established pattern |
| Online recent-show search | Core (fetch fn w/ injected deps) | App triggers on user tap | `pollLatest`/`fetchJson` idiom; zod + `assertFilterApplied` |
| Recap assembly (tally, source split, new catches) | Core (pure TS) | App view + EndShow hook | Consumes `trackedEntries` snapshot |
| Export envelope v2 + compare-vs-merge fork | Core (schema/merge) | App (importPicker fork) | Trust boundary lives in core; DB commit in app |
| Share-card stat assembly | Core (pure TS) | — | Same derived stats as dex header |
| Share-card canvas drawing + share/download | App (DOM) | — | Canvas/`navigator.share` are browser APIs |
| FAB menu, orb label fit, InstallBanner gating | App (components) | Core: none | Pure UI; label-fit sizing fn should still be a pure testable helper |

## Standard Stack

### Core

No new runtime dependencies. Phase 6 is built entirely on the existing verified stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie / dexie-react-hooks | 4.4.4 / 4.4.0 | `version(4)` additive migration; `useLiveQuery` reactive dex counts | Already installed; established pattern (STATE.md) [VERIFIED: package.json] |
| zod | 4.4.3 | Envelope v2 schema; live archive-search row validation | Already installed; `strictObject` trust-boundary idiom exists [VERIFIED: package.json] |
| fuse.js | 7.4.2 | Archive text search over 738 shows (date/venue/city) | Already installed; `searchCatalog` wrapper idiom to mirror [VERIFIED: package.json] |
| lucide-react | 1.23.0 | All Phase 6 icons (per 06-UI-SPEC icon list) | Already installed [VERIFIED: package.json] |
| Browser Canvas 2D + Web Share API | native | Share card render + share | No library needed; see Don't Hand-Roll [CITED: developer.mozilla.org/en-US/docs/Web/API/Navigator/share] |

### Supporting (dev/build-time only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | 0.35.3 | Cover thumbnail resize/WebP encode in the one-time fetch script | devDependency only; published 2026-07-01, repo github.com/lovell/sharp [VERIFIED: npm registry + slopcheck OK] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sharp | `squoosh`/CLI tools | squoosh CLI is unmaintained; sharp is the ecosystem standard for Node image processing |
| Hand-drawn canvas card | `html2canvas` / `dom-to-image` | Heavy, notoriously flaky with fonts/filters on Safari; the card is one fixed 1080×1350 layout — direct `fillText`/`drawImage` is simpler and deterministic |
| Bundled JSON-module archive import | `?url` asset + runtime fetch + `json` in `workbox.globPatterns` | Only if the JS bundle grows uncomfortably; CLAUDE.md documents this exact variant. At ~141 KB raw (~35–40 KB gzipped) the JSON-module import matching the matrix idiom is simpler and guarantees offline-complete-on-first-load |
| MusicBrainz/CAA covers | Scraping kglw.net album pages | albums.json has NO image-URL field (verified) — kglw.net covers require HTML scraping, which the project's out-of-scope table forbids on principle; CAA is a real JSON/binary API with ready-made 250px thumbnails |

**Installation:**
```bash
npm install --save-dev --workspace packages/app sharp
```

**Version verification (performed 2026-07-14):**
```bash
npm view sharp version   # → 0.35.3, modified 2026-07-01, repo github.com/lovell/sharp
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| sharp | npm | ~12 yrs (latest 0.35.3 published 2026-07-01) | very high (ecosystem-standard) | github.com/lovell/sharp | [OK] | Approved (devDependency only) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 ran successfully (verdict `[OK]` for sharp); its post-scan npm-install passthrough crashed but made **zero repo changes** (verified via `git status` + lockfile grep — no sharp entries added). The plan's install task should add sharp explicitly.

## Architecture Patterns

### System Architecture Diagram

```
BUILD TIME (Node, one-time / manual re-run)
  data/normalized/corpus.json (4.86 MB, 738 shows) ──┐
                                                      ├─► core CLI: build-archive ──► data/normalized/archive.json (~141 KB)
  data/raw/albums.json + songs.json ──────────────────┤        (shows: id/date/venue/sets→songIds + songId→name map)
                                                      └─► core CLI: build-albums ──► data/normalized/dex-albums.json
                                                               (card albums by allowlist + Covers/Misc buckets)
  MusicBrainz WS/2 (1 req/s, UA) ─► CAA front-250 ─► sharp ─► packages/app/src/assets/covers/{slug}.webp + covers-manifest.json

RUNTIME (browser, fully offline once loaded)
  archive.json ─┐  (JSON-module import, same idiom as @matrix)
  dex-albums.json ─┤
  matrix.json ─────┤
                   ▼
        ┌─ packages/core (pure) ─────────────────────────────────────────┐
        │ deriveDex(snapshot, archive, albums, config) → DexStats        │
        │   • per-song sightings / lastSeen / personalGap                │
        │   • completion %, rarest catch, never-seen, per-album tallies  │
        │ rarityTiers(archive, config) → songId → tier + corpus gap      │
        │ deriveRecap(show, entries, dexBefore, rarity) → RecapStats     │
        │ searchArchive(query|year) → ShowHit[]   (fuse.js)              │
        │ fetchRecentShows(deps) → validated rows (zod + filter assert)  │
        │ compareDexes(mine, theirs) → diff lists                        │
        │ buildShareStats(dexStats) → ShareCardData                      │
        └───────────────┬──────────────────────────────────────────────┘
                        ▼
  Dexie (attendedShows ∪ trackedShows/trackedEntries ∪ NEW archiveShows cache)
                        │ useLiveQuery
                        ▼
  DexView (#/dex): header → Albums|Shows segments → AlbumDetail / ShowsList
  ArchiveBrowser: corpus-first search + year browse ──(online only)──► fetchRecentShows
  RecapView: auto after EndShowDialog confirm; reachable from Shows segment
  CompareView: importPicker fork on envelope.owner → ZERO DB writes
  ShareCard: core stats → canvas draw → toBlob → navigator.share | anchor download
```

### Recommended Project Structure

```
packages/core/src/
├── dex/                    # NEW — all pure derivation (EVAL-05 target)
│   ├── derive-dex.ts       # sightings, completion, gaps, never-seen, per-album tallies
│   ├── rarity.ts           # quantile tiers + corpus gap + show rarity score
│   ├── recap.ts            # tally/source split/new catches/setlist assembly
│   ├── albums.ts           # song→album mapping derivation (build-time consumed)
│   ├── archive-types.ts    # zod schema + TS types for archive.json artifact
│   ├── search-archive.ts   # fuse.js wrapper (searchCatalog idiom)
│   ├── compare.ts          # friend-file diff (never merges)
│   └── recent-shows.ts     # online fallback fetch (pollLatest tolerance idiom)
├── cli/
│   ├── build-archive.ts    # corpus.json → archive.json
│   └── build-albums.ts     # albums.json/songs.json → dex-albums.json
├── data-safety/            # EXTEND: envelope v2 (owner, archiveShows), MIGRATIONS[1]
packages/app/
├── scripts/fetch-covers.ts # MB→CAA→sharp pipeline (manual, never CI)
├── src/assets/covers/      # committed WebP thumbnails + covers-manifest.json
├── src/dex/                # DexView, DexHeader, AlbumGrid, AlbumDetail, SongRow,
│   │                       # TierBadge, ShowsList, ArchiveBrowser, RecapView,
│   │                       # CompareView, shareCard.ts (canvas draw + share/download)
├── src/show/FabMenu.tsx    # replaces ActionBar (D-20)
```

### Pattern 1: One derivation entry point, run against any snapshot
**What:** `deriveDex` takes a *snapshot* (the same `ExportSnapshot` shape merge.ts already uses), not the live DB. The app feeds it the local tables via `useLiveQuery`; the compare view feeds it the friend's parsed envelope.
**When to use:** Everywhere dex stats appear (header, rows, recap "+N new", share card, both compare columns).
**Why:** One fixture-tested pipeline; the friend-compare path gets full stats for free with zero DB reads/writes; unmark is automatically "free" (D-12) because nothing is stored.

### Pattern 2: Attendance identity = union of two tables, deduped
**What:** A user's attended shows = `trackedShows` (live-tracked, provisional) ∪ `attendedShows` (retro-marked, keyed by canonical `show_id`). Dedupe: a trackedShow with `showId != null` matching an `attendedShows.show_id` is the SAME night (one attendance); an unbound trackedShow matches by `date` (accept the multi-show-day ambiguity, see Pitfall 6). Sightings union across both sources for a deduped night (tracked entries + corpus setlist) — being there is being there.
**Why:** `attendedShows` has existed since Dexie v1, is written by nothing today (verified by grep — only export/import touch it), is already in the export envelope, and already union-merges by `show_id` in merge.ts. Retro marking needs **no migration** for corpus-era shows.

### Pattern 3: Additive Dexie version(4) — one new table only
**What:** `archiveShows` cache table (`&show_id`) storing `{show_id, date, venueName, city, sets: [{setNumber, songs: [{songId, songName}]}]}` — written ONLY when the user marks a show found via the online fallback (a show newer than the bundled archive's `latestShowDate`, currently `2025-12-13` — verified). Corpus-era retro marks never write it (the bundled archive already has their setlists).
**Why:** Without persisting the fetched setlist, an online-fallback mark would credit zero sightings after reload/offline, and the backup file would silently lose those catches. Follows the additive-only migration rule (no `.upgrade` needed — new table only).

### Pattern 4: Envelope v2 with the already-wired migration chain
**What:** Bump `config.dataSafety.SCHEMA_VERSION` to 2. `exportEnvelope` v2 adds `owner: z.string().max(N).nullable()` and `archiveShows: z.array(archiveShowRow)`. Add `MIGRATIONS[1] = (e) => ({...e, owner: null, archiveShows: []})` so v1 files import cleanly. merge.ts's newer-version rejection already protects old apps from v2 files.
**Why:** merge.ts's `MIGRATIONS` array and version loop were built for exactly this (verified — empty array, identity case tested).
**Critical:** schema + `serializeExport` + merge + `DbSnapshot`/`importSnapshot` + exportDownload/importPicker must move in ONE plan — the row types are pinned across the core/app boundary and `tsc --noEmit` fails on any partial change (documented contract in export-schema.ts header).

### Pattern 5: Compare fork at the importPicker seam
**What:** In `pickAndImport` (or a new sibling fn), after zod validation: if `envelope.owner` is null → prompt "Whose dex is this?"; if it names someone other than the local `meta.ownerName` → route the PARSED envelope to CompareView and **return before any merge/commit**; only the "mine" path calls `parseAndMergeImport` + `importSnapshot`.
**Why:** The zero-DB-writes guarantee (D-17) is structural: the compare path never calls the two functions that write.

### Pattern 6: Recap as internal view state, not a route
**What:** `ROUTES` stays `["show","explore","dex","settings"]` (verified allow-list — a security control, T-03-02). Recap renders from component state: EndShowDialog's confirm sets `recapSessionId` in ShowView (must render BEFORE the `!session.active → PreShowLauncher` early return); the Dex Shows segment opens the same `RecapView` for any finalized tracked show.
**Why:** UI-SPEC mandates no new hash routes; ShowView's early-return structure (verified) would otherwise swallow the recap the instant the show finalizes.

### Pattern 7: Build-time artifacts follow the matrix idiom
**What:** `archive.json` and `dex-albums.json` are derived by core CLIs, committed under `data/normalized/`, imported by the app as JSON modules via Vite aliases (the `@matrix` + ambient-declaration idiom, verified in STATE.md/matrix-artifact.d.ts), each with a `schemaVersion` guard returning a handled error sentinel.
**Why:** Same offline-complete guarantee, same refresh workflow (`npm run refresh` regenerates), no new caching machinery.

### Anti-Patterns to Avoid
- **Storing derived counts** (sighting tallies, completion %) in Dexie — derivation is the locked design (D-05/D-11/D-12); stored counts would break free unmark.
- **Keying anything by song name** — the matrix contains duplicate names: "Bit" ×3 (songIds 107/108/110), "Jam" ×2, "Ghost" ×2 (verified). songId is the only key.
- **Bundling `corpus.json`** — 4.86 MB (verified). The compact archive is 34× smaller.
- **`react-router` or new hash routes** for drill-ins/recap — view-state switching only (CLAUDE.md + verified ROUTES allow-list).
- **Auto-scheduled cover refresh or CI fetch** — manual one-command re-run only (CLAUDE.md etiquette).
- **html2canvas for the share card** — see Don't Hand-Roll.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize/WebP encode | Custom canvas-in-Node or ImageMagick shelling | sharp (devDep) | Battle-tested libvips bindings; the ≤10 KB/‑25 KB budget guards need reliable quality control |
| Cover art discovery | Scraping kglw.net album-page HTML | MusicBrainz WS/2 search → Cover Art Archive `/release-group/{mbid}/front-250` | CAA is a real API: no auth, 250/500/1200px thumbnails built in [CITED: musicbrainz.org/doc/Cover_Art_Archive/API]; MB requires 1 req/s + descriptive UA [CITED: musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting] — matches the project's existing paced-fetch etiquette |
| DOM-to-image share card | html2canvas / dom-to-image | Direct Canvas 2D draw of a fixed 1080×1350 layout | The card is ~8 text lines + fixed colors; direct draw is deterministic, offline, Safari-safe |
| Native share sheet | Custom share UI / social SDKs | `navigator.canShare({files})` + `navigator.share` + anchor-download fallback | Web Share hands off to the OS sheet; fallback idiom already exists in exportDownload.ts [CITED: MDN Navigator/share] |
| Fuzzy archive search | Custom tokenizer/matcher | fuse.js behind a pure `searchArchive` fn | Existing dep + existing `searchCatalog` wrapper pattern (04-02) |
| Import trust boundary | Ad-hoc field checks | zod `strictObject` envelope v2 | The prototype-pollution/strict-reject defense is already the established pattern (verified export-schema.ts) |
| Reactive recompute on mark/unmark | Manual cache invalidation | Dexie `useLiveQuery` | Established: "Dexie is the single source of truth, no useState mirror" (STATE.md) |

**Key insight:** Every "new" runtime behavior in this phase (search, validation, reactivity, sharing, download) already has a proven in-repo idiom or a native browser API — the only genuinely new machinery is build-time (sharp + two derivation CLIs).

## Common Pitfalls

### Pitfall 1: `islive=0` does NOT exclude live albums (locked D-04's stated filter is insufficient alone)
**What goes wrong:** The album shelf renders "Live in Athens '25" (50 tracks, `islive: 0` — verified), "Live In Chicago '23" (43), "Live in Minneapolis '24", "Live in Berlin '25" as cards, and songs map to them.
**Why it happens:** kglw.net's `islive` flag marks an older set of 76 live albums; newer official bootlegs carry `islive: 0`.
**How to avoid:** Card membership comes from a **config-resident allowlist keyed by `album_url`** (~27–29 canonical studio LPs/EPs — the owner's "discography shelf"); `islive=0` + earliest-release-date then operates *within* card albums for song mapping, honoring D-04's spirit. A drift-guard test asserts every allowlist `album_url` exists in albums.json.
**Warning signs:** Album grid ≫ 30 cards; "Live in …" titles on the shelf.

### Pitfall 2: Naive earliest-release-date maps songs to singles, not LPs
**What goes wrong:** "Ants & Bats" maps to "Hey There / Ants & Bats" (single, 2010-10-22) instead of "12 Bar Bruise" (2012) — verified; 100 of 147 `islive=0` "albums" have ≤3 tracks (singles/splits).
**How to avoid:** Same allowlist: map each song to the earliest-dated **card** album containing its slug; songs on no card album → Miscellaneous (originals) or Covers (`isoriginal: 0` via songs.json — verified 24 matrix covers).
**Warning signs:** Album cards for 2-track singles; song counts per LP lower than the LP's tracklist.

### Pitfall 3: albums.json joins are dirty — titles collide, dates carry suffixes, no song_id
**What goes wrong:** "Fishing For Fishies" exists twice (`/albums/fishing-for-fishies-video` 2019-03-11 AND `/albums/fishing-for-fishies` 2019-04-26); "Phantom Island " (trailing space) duplicates "Phantom Island"; `releasedate` values like `"2020-09-29 (1)"`; albums.json has NO song_id.
**How to avoid:** Key albums by `album_url`; trim titles; parse dates with a `/^\d{4}-\d{2}-\d{2}/` prefix match; join songs via `songs.json` slug ↔ `song_url.replace('/song/','')` (verified: 233/264 matrix nodes join this way; the 31 unmatched are exactly the covers + Misc originals). SCHEMA.md §11 documents all of this — cite it in the plan.
**Warning signs:** A song mapped to a "-video" URL; NaN dates; unmatched counts far from 31.

### Pitfall 4: Debut candidates are, by construction, NOT in the matrix catalog
**What goes wrong:** Treating the 264 matrix nodes as "all songs" makes STAT-04 unreachable — every matrix node has ≥1 corpus play (verified: corpus songIds ≡ matrix nodes + sentinel id 1).
**How to avoid:** Album song lists come from the album-mapping artifact (albums.json tracklists), which includes never-played songs. A song on a card album with no matrix node = **debut candidate**: dimmed row + "Debut candidate" badge, no tier, excluded from the completion denominator (keep the UI-SPEC's `87/264` — denominator = matrix catalog) and from per-album caught/total tallies. Sentinel songId 1 (`config.sentinelSongIds`) is excluded from sightings/catalog everywhere.
**Warning signs:** Completion % that can never reach 100%; a "0.0%" or tier badge on an unplayed song.

### Pitfall 5: Online-fallback marks that vanish
**What goes wrong:** User marks a July 2026 show via the kglw.net fallback (bundled archive ends 2025-12-13 — a real 7-month gap today); after reload or on a restored backup, the show contributes zero sightings because its setlist exists nowhere locally.
**How to avoid:** Pattern 3 (`archiveShows` cache table) + Pattern 4 (envelope v2 carries it). Mark-from-fallback writes BOTH `attendedShows` and the `archiveShows` cache row in one transaction.
**Warning signs:** A marked show in the Shows list with 0 songs; export→import round-trip test losing sightings.

### Pitfall 6: Double-counted attendance (tracked + retro-marked same night)
**What goes wrong:** The user live-tracks a show, later finds it in the archive browser and marks it too → 2 attendances, inflated personal-gap math.
**How to avoid:** Dedupe in `deriveDex` by `show_id` (bound trackedShows) or `date` (unbound). In the ArchiveBrowser, render already-attended shows (either source) as marked. Note the known edge: two shows share 2013-09-11 (verified, SCHEMA §11) — date-only matching can collide on double-header days; prefer `show_id` whenever the trackedShow is bound.
**Warning signs:** Show count higher than nights attended; a marked archive row for a night already tracked.

### Pitfall 7: `navigator.share` transient-activation loss on iOS
**What goes wrong:** Tap "Share card" → async `canvas.toBlob` → `navigator.share({files})` throws `NotAllowedError` because the user-activation window expired during the async gap.
**How to avoid:** Render the card + generate the `File` when the preview opens; the Share button tap calls `navigator.share` with the already-built file (MDN: requires transient activation) [CITED: MDN Navigator/share]. Feature-detect with `navigator.canShare({files: [file]})`; fallback = the exportDownload anchor idiom + "Card saved to your downloads."
**Warning signs:** Share works on Android but silently fails on iPhone.

### Pitfall 8: jsdom has no canvas — share-card drawing is untestable in the app project
**What goes wrong:** `canvas.getContext('2d')` returns null under jsdom; tests importing the draw path crash or silently no-op.
**How to avoid:** Keep ALL stat assembly in core (`buildShareStats`, node-tested); the app draw fn takes `(ctx, data)` so tests can pass a recorded mock; guard `getContext` null and surface the UI-SPEC "Couldn't build the card." copy.
**Warning signs:** App-project test failures mentioning `HTMLCanvasElement.prototype.getContext`.

### Pitfall 9: Browsers cannot set the `User-Agent` header
**What goes wrong:** Copying `fetchJson`'s `headers: {"User-Agent": …}` into client code and believing the etiquette requirement is met — browsers silently drop/forbid it (it's a forbidden header name; the existing `pollLatest` UA header is already inert in the browser).
**How to avoid:** Etiquette for the client-side fallback = **behavioral**: user-initiated only, one GET per archive-browser session (cache in memory), tolerant-never-retry (`pollLatest` failure policy), `artist_id === 1` filter + `assertFilterApplied`. The MB/CAA cover script runs in Node where the UA header (with contact email, per MB rules) DOES apply.
**Warning signs:** Console warnings about unsafe headers; retry loops on failure.

### Pitfall 10: FAB removal breaks the layout/gesture seams that ActionBar anchored
**What goes wrong:** Removing the in-flow ActionBar changes the ShowView flex column; the SuggestionStrip (fixed-height slot "directly above the ActionBar") and the gesture-suppression CSS scope (`.action-bar` class in styles.css — verified) lose their anchor; the fixed FAB can cover the SuggestionStrip dismiss X or drift under the home indicator.
**How to avoid:** Give the FAB + menu the same gesture-suppression class scope; compute its bottom offset from `env(safe-area-inset-bottom)` + BottomTabBar height + the 56px `SUGGESTION_STRIP_HEIGHT` slot + `sm` gap (per UI-SPEC); register overlay height via `useBottomOverlayHeightRegistration` if it can overlap scrollable content; re-verify AppShell `scroll=false` seam; expect `actionBar.test.tsx` to be replaced, not patched.
**Warning signs:** Orbit taps firing through the open menu (missing scrim); FAB overlapping the strip's X.

### Pitfall 11: Friend-compare path leaking writes through meta or the merge
**What goes wrong:** The compare flow reuses `pickAndImport` wholesale and a friend's file merges `meta` rows (or worse, attendance) into the local DB.
**How to avoid:** Fork BEFORE `parseAndMergeImport` (Pattern 5). The compare view consumes only the validated envelope in memory. Render the friend's name as escaped text, length-clamped (UI-SPEC cross-cutting rule).
**Warning signs:** Local completion % changing after viewing a friend's file.

### Pitfall 12: Tiny-sample "fake Legendary" rarity
**What goes wrong:** A song played once in 2011 lands in the bottom play-rate quantile and renders as gold Legendary — technically true, epistemically garbage (violates the "honest about sparse data" phase goal).
**How to avoid:** `RARITY_MIN_PLAYS` guard (UI-SPEC default 3): below it, cap at Rare. All thresholds in core config; a fixture test pins tier boundaries against a small synthetic corpus.
**Warning signs:** Legendary count ≫ 5% of catalog.

## Code Examples

### Verified song→album join (build-time derivation)
```ts
// Source: verified against data/raw/albums.json + songs.json in this session
// albums.json has NO song_id — join via slug (SCHEMA.md §11)
const slug = albumRow.song_url.replace("/song/", "");     // ↔ songs.json .slug
// Key albums by album_url, NEVER album_title (duplicates + trailing spaces verified)
// Parse releasedate defensively: "2020-09-29 (1)" → take /^\d{4}-\d{2}-\d{2}/ prefix
// Covers: songs.json isoriginal === 0 → Covers bucket (24 of 264 matrix nodes)
// Mapping result (verified): 233/264 slug-join to some artist_id=1 album;
// 31 unmatched = covers + Miscellaneous originals (Love For Me, Oh God, JOJAM, …)
```

### Compact archive artifact (measured shape)
```ts
// Source: derived + size-measured from data/normalized/corpus.json (738 shows)
interface ArchiveArtifact {
  schemaVersion: 1;
  latestShowDate: string;            // "2025-12-13" — the online-fallback boundary
  songs: Record<number, string>;     // songId → name (265 incl. sentinel 1; ~10 KB)
  shows: Array<{
    id: number; date: string;        // stable show_id + ISO date
    venue: string; city: string; state: string | null; country: string;
    sets: Array<{ n: "1" | "2" | "e"; songs: number[] }>;  // set structure for HIST-01
  }>;
}
// Measured: ~141 KB raw JSON (vs 4,858 KB corpus.json) — JSON-module import is fine.
```

### Dexie version(4) — additive only
```ts
// Source: db.ts version(3) idiom (verified in repo)
this.version(4).stores({
  archiveShows: "&show_id",   // online-fallback setlist cache ONLY; corpus-era
});                            // retro marks live in the EXISTING attendedShows table
```

### Envelope v2 migration slot (already wired)
```ts
// Source: packages/core/src/data-safety/merge.ts MIGRATIONS chain (verified)
const MIGRATIONS: Array<(e: ExportEnvelope) => ExportEnvelope> = [
  /* [0] unused (no v0) */ undefined as never,
  (e) => ({ ...e, owner: null, archiveShows: [] }),   // v1 → v2
];
// app config: dataSafety.SCHEMA_VERSION: 2
```

### Share flow that survives iOS transient activation
```ts
// Source: MDN Navigator/share — requires transient activation + canShare gate
// 1) On opening the share preview (NOT on the share tap): draw + encode
const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
const file = new File([blob], "guezzer-dex.png", { type: "image/png" });
// 2) On the Share button tap (synchronous access to the pre-built file):
if (navigator.canShare?.({ files: [file] })) {
  try { await navigator.share({ files: [file] }); } catch { /* user-cancel is normal */ }
} else {
  downloadFile(file); // exportDownload.ts anchor idiom; "Card saved to your downloads."
}
```

### Cover pipeline (one-time script, Node)
```ts
// Source: musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting + doc/Cover_Art_Archive/API
// MB search (1 req/s, descriptive UA REQUIRED — reuse config.userAgent):
//   GET https://musicbrainz.org/ws/2/release-group/?query=releasegroup:"K.G." AND artist:"King Gizzard"&fmt=json
// CAA thumbnail (no auth; sizes 250/500/1200):
//   GET https://coverartarchive.org/release-group/{mbid}/front-250   (follows redirects)
// Then: sharp(buf).resize(160, 160).webp({ quality: 70 }) → assets/covers/{slug}.webp
// Fail loudly if output > 25 KB (UI-SPEC budget guard); write covers-manifest.json (provenance)
```

### Online recent-show fallback (reuses everything)
```ts
// Source: fetch-corpus.ts endpoint pattern + poll-latest.ts tolerance policy (verified)
// Endpoint: `${config.apiBase}/setlists/showyear/${year}.json` — the SAME rows the
// census zod schemas already validate; filter artist_id === 1 THEN
// assertFilterApplied(rows, endpoint, { field: "showyear", expected: year }).
// Client policy = pollLatest's, not fetchJson's: soft-fail to [], never retry, never throw.
// Trigger: user taps "Search kglw.net for newer shows" (online only); cache rows in memory
// for the session so browsing never re-fetches.
```

### InstallBanner once-per-version flag (D-22)
```ts
// Source: EndShowDialog PERSIST_WARNING_SHOWN idiom + vite-env.d.ts globals (verified)
const INSTALL_BANNER_SEEN_VERSION = "installBannerSeenVersion";
const buildStamp = `${__APP_VERSION__}+${__GIT_SHA__}`;  // stable per release
// show only when getMeta(INSTALL_BANNER_SEEN_VERSION) !== buildStamp;
// setMeta on first render (at-most-once-per-version, matching the todo's ask).
// Note: supersedes useInstallState's deliberately session-only `dismissed` (Phase 3 D-05).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3: InstallBanner dismissal session-only by design | Persisted once-per-version meta flag | This phase (D-22, owner report) | Deliberate supersession — document in the plan so the Phase 3 decision isn't "restored" |
| Phase 4: in-flow two-row ActionBar (04-05 decision) | Fixed-position collapsed FAB | This phase (D-20, owner decision) | Supersedes 04 D-13..D-15 layout decisions; action semantics unchanged |
| `attendedShows` as a "thin-but-real stub" (Phase 3 D-08) | The retro-attendance record proper | This phase | The stub's schema (`&show_id, showDate`) needs zero changes — it was built for this |
| Export envelope v1 (no owner) | v2 with owner + archiveShows | This phase (D-17) | First real use of the MIGRATIONS chain |

**Deprecated/outdated:** nothing external — d3/canvas/Web Share APIs used here are stable platform features. TypeScript stays 6.0.3 (typescript-eslint ceiling, per CLAUDE.md — unchanged).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | kglw.net API serves `setlists/showyear/*` with CORS headers permitting browser fetch (latest.json demonstrably works cross-origin from the app — Phase 5 UAT passed — and it's the same API host) | Online fallback | Fallback row shows an error state; corpus-first path unaffected. Cheap to verify with one curl/manual test in Wave 0 [ASSUMED] |
| A2 | Cover Art Archive has front cover art for all ~27 card albums (KGLW is a heavily-documented band on MusicBrainz) | Cover pipeline | Missing covers fall back to the UI-SPEC initials placeholder — already designed for [ASSUMED] |
| A3 | `navigator.share({files})` works on the friend group's devices (iOS 15+/modern Android; owner's device is iPhone 16 Pro / iOS 26) | Share card | Download fallback is mandatory anyway (D-19); exact version floors are not load-bearing [ASSUMED] |
| A4 | The ~27-entry card-album allowlist (canonical studio LPs/EPs by `album_url`) matches the owner's mental "discography shelf" incl. edge picks (Willoughby's Beach EP, Teenage Gizzard, Made In Timeland, Demos exclusion) | Album mapping | Wrong shelf contents — cosmetic, config-editable; surface the final list at the phase's human-verify gate [ASSUMED] |
| A5 | Rarity quantile defaults (legendary 0.05 / rare 0.20 / uncommon 0.50, MIN_PLAYS 3) produce satisfying tier distributions on this corpus | Rarity tiers | Tiers feel off — pure config tuning; recommend the build prints the tier histogram [ASSUMED] |
| A6 | ~141 KB raw (~35–40 KB gzipped) archive JSON in the main bundle is acceptable for the venue-loading constraint | Archive artifact | Switch to the CLAUDE.md-documented `?url` + runtime-fetch + workbox `json` glob variant — a contained change [ASSUMED] |
| A7 | Marking a tracked show's night as ALSO retro-marked should dedupe attendance but union sightings | Dex derivation | Slight sighting over/under-credit on one night; fixture-test whichever rule the planner locks [ASSUMED] |

## Open Questions

1. **Completion denominator vs debut candidates**
   - What we know: UI-SPEC copy pins `87/264`; 264 = matrix catalog (all ≥1-play songs, verified); album tracklists include unplayed songs.
   - What's unclear: whether per-album tallies count debut candidates in `{total}`.
   - Recommendation: denominator = matrix-catalog songs only, at both the header and per-album levels (debut candidates listed, badged, uncounted) — otherwise 100% completion is unreachable and tallies don't sum to 264. Lock in the plan.
2. **Where the local owner name is set (D-17 needs one)**
   - What we know: the envelope gains `owner`; the import fork compares against a local identity; no UI for setting it is specced.
   - Recommendation: a small Settings field (meta row `ownerName`), prompted once on first export if unset. Needs a UI-SPEC-consistent copy string in config.
3. **Recap for retro-marked shows**
   - What we know: D-16/UI-SPEC route tracked shows → recap, retro-marked → plain setlist view (no tally/source data exists for them).
   - Recommendation: confirmed split — recap components should not assume `trackedEntries` exist for every Shows-list row.
4. **`Fishing For Fishies` duplicate URL** (`-video` vs real album, same title, both `islive=0`)
   - Recommendation: allowlist pins `/albums/fishing-for-fishies`; drift-guard test catches regressions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 24.12 (native TS) | core CLIs (build-archive, build-albums) | ✓ | v24.15.0 | — |
| npm workspaces | monorepo installs | ✓ | npm 11.x (package-lock.json present) | — |
| pnpm | (CLAUDE.md mentions pnpm) | ✗ | not installed | **npm workspaces is the actual repo reality** — package.json `workspaces` + package-lock.json (verified); plans must use npm, not pnpm |
| sharp | cover script | ✗ (not yet installed) | 0.35.3 on registry | install task in Wave 0/1 |
| Network (musicbrainz.org, coverartarchive.org, kglw.net) | one-time cover fetch; optional recent-show search dev-testing | ✓ (this session) | — | covers: initials placeholder; search: corpus-first path |
| fake-indexeddb, @testing-library/react, jsdom | app tests | ✓ | in root devDeps (verified) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** sharp (plain install), pnpm (use npm — this is a doc-vs-reality correction, not a gap).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10, `test.projects` (core=node, app=jsdom + fake-indexeddb) |
| Config file | `vitest.config.ts` (root — verified) |
| Quick run command | `npx vitest run --project @guezzer/core` (or `--project @guezzer/app`) |
| Full suite command | `npm test` (= `vitest run`, both projects) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEX-03/04, STAT-03 | deriveDex: sightings, completion, personal gap, never-seen, rarest, per-album tallies, tracked+retro dedupe | unit (core, fixtures) | `npx vitest run --project @guezzer/core test/dex/derive-dex.test.ts` | ❌ Wave 0 |
| STAT-01/02, D-15 | rarity tiers (quantiles, MIN_PLAYS guard), corpus gap, show rarity score | unit (core, fixtures) | `npx vitest run --project @guezzer/core test/dex/rarity.test.ts` | ❌ Wave 0 |
| STAT-04 | debut-candidate classification (album track w/o matrix node; sentinel excluded) | unit (core) | (same fixture suite) | ❌ Wave 0 |
| D-04 (mapping) | album derivation: allowlist keying by album_url, slug join, Covers/Misc buckets, dirty-date parse, drift guard | unit (core, real-data snapshot + synthetic fixtures) | `npx vitest run --project @guezzer/core test/dex/albums.test.ts` | ❌ Wave 0 |
| DEX-02 | archive search (year browse + fuzzy), mark/unmark write helpers, dedupe against tracked | unit core (search) + unit app (db helpers, fake-indexeddb) | core: `test/dex/search-archive.test.ts`; app: `test/retroMark.test.ts` | ❌ Wave 0 |
| DEX-02 fallback | recent-show fetch: zod row validation, artist filter, assertFilterApplied, soft-fail-to-[] | unit (core, injected fetch — fetch.test.ts idiom) | `test/dex/recent-shows.test.ts` | ❌ Wave 0 |
| SHOW-14, D-14 | recap assembly: tally %, manual/editor split (source tags), +N new catches, set-structured setlist | unit (core) | `test/dex/recap.test.ts` | ❌ Wave 0 |
| SHAR-01, D-17 | envelope v2 round-trip, MIGRATIONS[1] v1→v2, compare fork = zero writes, owner-name clamp | unit core (schema/merge) + unit app (import fork w/ fake-indexeddb) | extend `merge.test.ts`/`serialize.test.ts`; app `importFork.test.ts` | ❌ Wave 0 (extends existing files ✅) |
| SHAR-02 | buildShareStats (core); draw fn against mock ctx; canShare-gated share vs download fallback | unit core + unit app (mock ctx / mocked navigator) | `test/dex/share-stats.test.ts`; app `shareCard.test.tsx` | ❌ Wave 0 |
| HIST-01 | Shows list ordering (newest-first), tracked→recap vs retro→setlist routing | component (app) | `test/showsList.test.tsx` | ❌ Wave 0 |
| D-20 | FAB: collapsed default, scrim blocks stage, auto-collapse-then-act, all five actions fire | component (app) | replaces `actionBar.test.tsx` | ❌ (supersedes existing ✅) |
| D-21 | fitOrbLabel pure fn: wrap/scale/floor/ellipsis boundaries | unit (app or core-side pure helper) | `test/orbLabelFit.test.ts` | ❌ Wave 0 |
| D-22 | banner gate: unseen version shows once, same version suppressed, new version re-shows | component (app, fake-indexeddb meta) | `test/installBannerVersion.test.tsx` | ❌ Wave 0 |
| artifacts | archive.json + dex-albums.json schemaVersion guards; CLI derivation snapshot vs committed corpus | unit (core) | `test/dex/archive-artifact.test.ts` | ❌ Wave 0 |

Manual-only (end-of-phase device gate, `human_verify_mode: end-of-phase`): real `navigator.share` sheet on iPhone; FAB thumb-reach in the dark; cover rendering on device; recap auto-appear after a real End Show.

### Sampling Rate
- **Per task commit:** `npx vitest run --project @guezzer/core` (core-touching tasks) or `--project @guezzer/app`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `npx tsc --noEmit` (the envelope-type pinning contract) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/test/dex/` suite + `packages/core/test/fixtures/dex/*` (small synthetic archive/albums/snapshot fixtures with known expected outputs — EVAL-05)
- [ ] App tests: retroMark / importFork / shareCard / showsList / fabMenu / orbLabelFit / installBannerVersion
- [ ] Framework install: none (Vitest + fake-indexeddb already configured)

## Security Domain

### Applicable ASVS Categories (Level 1; `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts (project constraint) |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-user local data |
| V5 Input Validation | **yes** | Friend files: existing zod `strictObject` envelope (prototype-pollution defense verified) extended to v2 — `owner` gets `.max()` length clamp; live archive rows: existing census zod schemas + `assertFilterApplied`; hash routes: existing ROUTES allow-list untouched |
| V6 Cryptography | no | No secrets, no crypto (uuid.ts wrapper already handles insecure-context randomUUID) |
| V7 Error handling | yes | Tolerant-never-throw idiom (pollLatest/persist.ts) for share/fetch/draw failures; calm copy per UI-SPEC |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious friend backup file (crafted JSON, `__proto__`, oversized strings) | Tampering | zod strictObject whole-file rejection BEFORE any merge (exists); compare path performs zero DB writes by construction; owner name length-clamped + rendered as React text only |
| Untrusted kglw.net strings (venue/song names) in dex/archive/recap | Injection (XSS) | React text rendering only, never `dangerouslySetInnerHTML` (existing T-04-05 rule); `album_notes` HTML in albums.json is NEVER shipped into any artifact (build-time derivation drops it) |
| Silent-filter-ignore on the live archive search returning foreign-band rows | Spoofing/Tampering | `artist_id === 1` filter + `assertFilterApplied` (existing, mandatory per D-09) |
| Attendance inflation via friend file | Tampering | D-17 structural fork: friend files route to CompareView before `parseAndMergeImport` is ever called |
| Build-script supply chain (sharp) | Tampering | slopcheck [OK]; pinned exact version 0.35.3; devDependency only, never shipped |

## Sources

### Primary (HIGH confidence — verified in this session)
- Repo data files: `data/raw/albums.json` (2,750 rows; islive semantics, title collisions, date suffixes measured), `data/raw/songs.json` (slug/isoriginal joins), `data/normalized/corpus.json` (738 shows, 4.86 MB, latestShowDate 2025-12-13, sentinel id 1), `data/normalized/transition-matrix.json` (264 nodes, duplicate names, no lastPlayed field) — all claims measured with Node scripts
- Repo code: `packages/app/src/db/db.ts` (v1–v3 schema, attendedShows unused, write helpers), `packages/core/src/data-safety/*` (envelope, MIGRATIONS chain, merge semantics), `packages/core/src/cli/fetch-corpus.ts` + `live/poll-latest.ts` (endpoint patterns, failure policies), `packages/core/src/ingest/validate.ts`, app components (ShowView/ActionBar/EndShowDialog/InstallBanner/PredictionOrb/importPicker/exportDownload/useHashRoute), `vitest.config.ts`, `styles.css` gesture scope, `.planning/config.json`
- [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API) — release-group front-250/500/1200 thumbnails, no auth
- [MusicBrainz API Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) — ~1 req/s per IP, descriptive User-Agent with contact required
- [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) — file sharing via canShare gate, transient-activation requirement
- npm registry via `npm view` (2026-07-14): sharp 0.35.3 (published 2026-07-01, github.com/lovell/sharp)
- slopcheck 0.6.1: sharp → [OK]

### Secondary (MEDIUM confidence)
- kglw.net CORS behavior for `showyear` (inferred from working Phase-5 `latest.json` polling on the same host — flagged A1)

### Tertiary (LOW confidence)
- Exact iOS/Android version floors for Web Share file support (not load-bearing; fallback mandatory — flagged A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new runtime deps; the one devDep is registry- and slopcheck-verified
- Data derivation (albums/archive/dex): HIGH — every join, count, size, and edge case measured against the committed data files
- Architecture/integration seams: HIGH — read directly from the Phase 3–5 code
- External APIs (CAA/MB/Web Share): HIGH for API shapes (official docs), MEDIUM for A1–A3 environmental assumptions
- Rarity/UX tuning defaults: MEDIUM — config-resident by design, backstopped by fixture tests + human-verify gate

**Research date:** 2026-07-14
**Valid until:** ~2026-08-14 (stable domain; the corpus gap boundary of 2025-12-13 grows more relevant as summer 2026 shows occur — re-run `npm run refresh` before shipping shrinks the online-fallback surface)
