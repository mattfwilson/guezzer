# Architecture Research

**Domain:** Offline-first client-side prediction PWA (setlist prediction, no backend)
**Researched:** 2026-07-08
**Confidence:** HIGH (API schema verified empirically with live fetches; architecture patterns MEDIUM-HIGH)

---

## Part 1: Verified kglw.net API Schema (empirical)

All findings below come from actual fetches against `https://kglw.net/api/v2` on 2026-07-08 (11 total requests). This is the single most load-bearing section — transition extraction code should be written against these facts, not assumptions.

### 1.1 Response envelope

Every response is:

```json
{ "error": false, "error_message": "", "data": [ ... ] }
```

- `error` is a boolean in practice (docs say 0/1).
- **Empty result is NOT an error:** `/setlists/showdate/2025-11-21.json` (no show that day) returned `{"error":false, "error_message":"", "data":[]}`.
- **CRITICAL GOTCHA — invalid column filters are silently ignored:** `/songs/isoriginal/0.json` returned *unfiltered* rows (all songs, `isoriginal: 1` included), not an empty set and not an error. A typo'd filter path returns the entire table. Ingestion code must validate that returned rows actually match the requested filter.

### 1.2 URL patterns and query params (verified working)

```
/[method].json                          all rows
/[method]/[ID].json                     one row
/[method]/[column]/[value].json         filtered (works for setlists/showdate; NOT all columns)
?order_by=[col]&direction=asc|desc      verified working on shows.json, setlists.json
?limit=N                                verified working
?show_tag=[slug]                        documented, not tested
```

Methods: `setlists`, `latest`, `shows`, `songs`, `venues`, `jamcharts`, `albums`, plus `metadata`, `links`, `uploads`, `appearances`, `list` (not needed for this project).

### 1.3 CRITICAL: the API is multi-artist

The database covers KGLW **and side projects**: observed `artist_id` values include `1` = "King Gizzard & the Lizard Wizard", `4` = "Stu Mackenzie", `23` = "CAVS", `34` = "The Lexies", `17` = "Sambrose Automobile".

- `latest.json` returned a **Stu Mackenzie solo set** as the most recent show, not KGLW.
- `shows.json` and `setlists.json` interleave all artists.
- `songs.json` includes side-project songs.

**Every layer of ingestion AND the live poller must filter `artist_id === 1`.** The live poller must additionally verify the polled `latest` row belongs to the expected show (`show_id` match) before offering auto-fill — a side-project set the same night would otherwise corrupt the tracker.

### 1.4 `setlists` rows — one row per song performance, flat and denormalized

Full observed key set (from `/setlists/showdate/2025-12-13.json`):

```
uniqueid, show_id, showdate, showtime, showtitle, showyear, showorder,
artist, artist_id, permalink, tour_id, tourname,
venue_id, venuename, city, state, country, timezone,
song_id, songname, slug, isoriginal, original_artist,
settype, setnumber, position, transition_id, transition,
footnote, footnotes, isjamchart, jamchart_notes, isrecommended,
isreprise, isjam, tracktime, opener, soundcheck, shownotes,
isverified, css_class
```

Notes:
- Show/venue/tour info is repeated on every row (denormalized). Normalization at ingest is worthwhile.
- `latest.json` rows have the same shape minus a few fields (`css_class`, `isrecommended`, `tracktime`, `timezone`, `showtime` absent). Do not assume identical schemas between `setlists` and `latest` — normalize through one parser that treats extras as optional.
- `footnote` is a plain string (observed carrying guest-musician notes); `footnotes` is `null` or a JSON array. Teases/guest info live in footnotes, **not** as separate rows (MEDIUM confidence — no tease observed in samples, but no tease row type exists in the schema).
- `isjam: 1` marks improvised jams (observed: "Intermission Jam"). `songname: "Live Jam"` with a real `song_id` (439) also exists — jams are real catalog entries, decide explicitly whether to include them in the matrix (recommend: exclude from predictions, keep in trail).

### 1.5 Song ordering and set delimiting (verified)

- **`position` is GLOBAL across the entire show, including the encore.** Verified: CAVS 2026-05-22 has Set 1 positions 1–8, then encore (`setnumber: "e"`) position 9. Sort by `position` alone to reconstruct show order.
- **`setnumber` is a string:** observed values `"1"` and `"e"` (encore). Multi-set shows presumably use `"2"`, `"3"` (unverified — no multi-set show in the sample window; 2022 marathon shows will confirm during full corpus ingest). Treat as opaque string, group by it.
- **`settype` was `"Set"` on every observed row — including the encore row.** Do NOT use `settype` to detect encores; use `setnumber === "e"`.

### 1.6 Segue / transition notation (verified — the core model input)

`transition_id` (int) + `transition` (display string). **The transition describes the gap AFTER this row** (verified: 2025-12-13 opener "Field of Vision" has `transition_id: 2` and indeed segues into the next song).

| transition_id | transition string | Meaning | Observed count (60-row sample) |
|---|---|---|---|
| 1 | `", "` | Normal break (pause between songs) | 45 |
| 2 | `" > "` | Segue | 7 |
| 3 | `" ->"` | Seamless/jam transition (phish.net convention: deeper than `>`) | 4 |
| 4 | — | **Unobserved.** Reserve handling; log if encountered during full ingest | 0 |
| 5 | `""` | Terminal — last song of show | 2 |
| 6 | `"  "` (two spaces) | Terminal — end of set (observed before encore AND at end of a no-encore show) | 2 |

Rules for the matrix builder:
- Match on **`transition_id`, never string-parse `transition`** (strings contain trailing/leading whitespace inconsistencies).
- Treat ids **2 and 3 as "hard segue"** signal (Signal 3). Both observed in real segue chains ("Field of Vision > Altered Beast I > Alter Me I…", "Muddy Water ->").
- Treat ids **5 and 6 as "no successor"**: usage is not perfectly consistent (2025-12-12 show ends with id 5; 2025-12-13 show ends with id 6). Never create a transition edge out of a row whose next row is in a different `setnumber`, regardless of transition_id — set boundary wins.
- **Set-boundary transitions are a modeling choice:** set-closer → encore-opener is a real (weaker) statistical relationship; recommend recording it as a separate edge type (`crossesSetBreak: true`) rather than dropping or conflating it.

### 1.7 Repeats and sandwiches (verified)

2025-12-13: **"Motor Spirit" (pos 19) > "Gila Monster" (pos 20) > "Motor Spirit" (pos 21)** — a sandwich. The second occurrence is a normal row with the same `song_id` and **`isreprise: 0`** (the flag was not set even here — treat `isreprise` as unreliable/sparse). Implications:
- The same `song_id` can legitimately appear twice in one show → rotation suppression must not assume uniqueness, and "already played drops to near zero" needs a carve-out for sandwich/reprise patterns (or accept the miss; they're rare).
- Transition extraction handles this naturally if it just walks consecutive rows.

### 1.8 Covers, jams, originals

- Row-level `isoriginal` (0/1) + `original_artist` (string). On KGLW original rows, `original_artist` is `""`; on side-project rows it's that project's name. Covers (`isoriginal: 0`) exist per docs; none appeared in the sample window (KGLW covers are rare).
- `songs` table carries the same flags per song: `{ id, name, slug, isoriginal, original_artist, created_at, updated_at }`. That's the whole songs schema — **no tuning, key, or album data** on songs, confirming the hand-tagged tuning file plan.

### 1.9 Tours (answers open question #2)

**Tour boundaries are explicit — no date-gap inference needed.** `shows` and `setlists` rows both carry `tour_id` (int) + `tourname` (string). Observed: `tour_id: 66` = "2026 USA Tour" (the user's tour — already in the API with scheduled shows), `tour_id: 65`-ish era "2025 Phantom Island Australia Tour". **Sentinel: `tour_id: 1` = "Not Part of a Tour"** — one-off shows; era/recency logic must special-case it (fall back to date proximity, don't treat "Not Part of a Tour" as one giant tour).

### 1.10 Show IDs and the `shows` schema (answers open question #5)

`shows` row keys:

```
show_id, showdate, showtime, permalink, artist_id, artist, showtitle,
venue_id, venuename, location, city, state, country, timezone,
tour_id, tourname, showorder, show_year, show_day, show_dayname,
show_month, show_monthname, updated_at, created_at,
show_tags: [{ tag, tag_slug }]
```

- `show_id` is a 10-digit integer (e.g. `1747702565` — these look like creation unix timestamps, i.e. assigned once and immutable). The official embed docs treat `show_id` as a permanent identifier. **Verdict: suitable as the Pokédex attendance key (HIGH confidence).** Belt-and-suspenders: also store `showdate + showorder + artist_id` as a fallback natural key in exports.
- `showorder` disambiguates multiple shows on one date.
- **Future shows are included** (fetched: scheduled 2026-08-22 Forest Hills and 2026-08-23 "Rave Show" under tour 66). Ingestion must tolerate shows with zero setlist rows; this is also a feature — the app can list the user's upcoming tour dates from the same corpus.
- `updated_at` on shows enables cheap incremental refresh checks later (nice-to-have).
- `show_tags` (e.g. `{"tag":"Rave","tag_slug":"rave"}`, "Movie Score") could flag anomalous shows to exclude/downweight in training.

### 1.11 Other endpoints (sampled)

- **`jamcharts`**: per-performance rows: `uniqueid, setnumber, position, footnote, tracktime, jamchartnote, song_id, isrecommended, showid, songname, song_slug, showdate, artist_id, ...`. **Field-name inconsistency: `showid` here vs `show_id` everywhere else**, and `song_slug` vs `slug`. Normalize at ingest.
- **`albums`**: one row per *track*: `album_title, album_displayname, artist, artist_id, album_url, releasedate, album_notes (raw HTML), song_name, song_url, original_artist, position, islive, tracktime, disc_number, ...`. **No `song_id`** — join to songs via slug extracted from `song_url` (`"/song/ah-ah-ah"`) or by name. `releasedate` is a dirty string (observed `"2006-10-24 (1)"` with a disambiguator suffix) — parse defensively. Needed only for album/era backoff tier and tuning-tag prefill.
- **`venues`**: `{ venue_id, venuename, city, state, country, zip, capacity, slug }`. Rarely needed — venue fields are already embedded in setlists/shows rows.

### 1.12 Corpus size and fetch strategy

~900 shows × ~10–25 songs/show ≈ 12–20k setlist rows; each denormalized row is ~900 bytes of JSON → a full `/setlists.json` dump is roughly 10–20 MB. Recommendation: the build-time fetch script pulls **per-year** (`/setlists/showyear/2011.json` … verify this column filters correctly using the validation check from 1.1) with a 1–2 s courtesy delay between requests, writes raw snapshots to `data/raw/`, and commits them. The bundled artifact shipped to clients is the *normalized* output (est. 1–2 MB, gzips well), never the raw dump.

---

## Part 2: System Architecture

### System Overview

```
BUILD TIME (Node CLI, run by owner)                RUNTIME (browser PWA)
┌─────────────────────────────────┐   ┌──────────────────────────────────────┐
│ scripts/                        │   │ app/ (React + Vite, static export)   │
│  fetch-corpus ──► data/raw/*.json   │  ┌───────────┐ ┌───────────┐ ┌─────┐ │
│        │                        │   │  │ Show Mode │ │  Explore  │ │ Dex │ │
│        ▼                        │   │  │ orbit/trail│ │constellat.│ │ UI  │ │
│  build-artifacts                │   │  └─────┬─────┘ └─────┬─────┘ └──┬──┘ │
│   (calls core/ingest,           │   │        │  React state/hooks │      │ │
│    core/matrix)                 │   │  ┌─────┴───────────┴────────┴────┐ │
│        │                        │   │  │      services/ (browser-only)  │ │
│        ▼                        │   │  │ live-poll │ idb-store │ export │ │
│  public/data/                   │   │  └─────┬───────────┬─────────────┘ │
│   matrix.json ──────────────────┼──►│        │           │               │
│   catalog.json  (bundled,       │   └────────┼───────────┼───────────────┘
│   shows.json     precached      │            │           │
│   tuning-tags.json by SW)       │            ▼           ▼
│                                 │      kglw.net      IndexedDB
│  backtest ──► CLI report        │    latest.json    (attendance,
│   (trust gate)                  │     ≤1/60s        tracked shows)
└───────────────┬─────────────────┘
                │ both import
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ core/ — pure TypeScript, zero React/DOM/browser deps            │
│  ingest/    api-types, normalize (artist filter, transition     │
│             semantics, set grouping), validate                  │
│  matrix/    TransitionMatrix builder + JSON (de)serialization   │
│  predict/   scoring pipeline: signals 1–7, backoff tiers,       │
│             explanations                                        │
│  backtest/  holdout eval, per-signal ablation, report           │
│  dex/       Pokédex derivation (attendance × corpus)            │
│  graph/     matrix → constellation nodes/edges derivation       │
│  config.ts  ALL tunable constants                               │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `scripts/fetch-corpus` | Politely pull per-year setlists + shows + songs + jamcharts + albums; write raw snapshots; validate filters actually applied (see 1.1 gotcha) | Node CLI; the only code that hits bulk endpoints; never runs in browser |
| `core/ingest` | Raw API rows → normalized `Show`/`Performance` types; filter `artist_id===1`; map `transition_id` to semantic enum; group by `setnumber`; sort by `position`; reconcile `latest` vs `setlists` field differences | Owns ALL schema knowledge — no other module touches raw API field names |
| `core/matrix` | Normalized shows → `TransitionMatrix` plain-JSON artifact: per-pair counts, segue counts, per-show/tour/date occurrence lists, base rates, set-position stats | Serializable, versioned (`schemaVersion` field); consumed by predictor AND graph, no scoring logic inside |
| `core/predict` | `(matrix, tuningTags, config, liveShowState) → ranked predictions + explanation strings` | Pure function; deterministic; explanations generated alongside scores, not reverse-engineered |
| `core/backtest` | Train/holdout split by tour; top-1/5/10 hit rates split hard-segue vs free-choice; per-signal ablation | CLI entry point; the trust gate |
| `core/dex` | `(attendedShowIds, corpus) → sighting counts, completion %, rarest catch, never-seen` | Derived, never stored |
| `core/graph` | `matrix → {nodes, edges}` with thresholds from config | Same artifact feeds Show Mode and constellation — single pipeline guaranteed by construction |
| `app/services/live-poll` | Fetch `latest.json` on 60s interval only while tracking is active; filter artist; match `show_id`; diff against confirmed trail; offer auto-fill | Browser-only; must back off silently when offline |
| `app/services/idb-store` | IndexedDB wrapper for attendance list + tracked shows; JSON export/import | Only mutable state in the system |
| `app/` UI | Orbit view, comet trail, fuzzy search, tracker, constellation, dex screens | Imports core; never imported by core |

### Recommended Project Structure

```
guezzer/
├── core/                    # pure TS, tsconfig with "lib": ["ES2022"] only (no "dom")
│   ├── ingest/
│   │   ├── api-types.ts     # raw kglw.net row shapes (from Part 1, verbatim)
│   │   ├── normalize.ts     # raw → domain types; artist filter; transition enum
│   │   └── validate.ts      # filter-applied checks, schema drift detection
│   ├── matrix/
│   │   ├── build.ts
│   │   └── types.ts         # TransitionMatrix JSON schema (versioned)
│   ├── predict/
│   │   ├── score.ts         # pipeline orchestrator
│   │   ├── signals/         # one file per signal (ablation-friendly)
│   │   └── explain.ts
│   ├── backtest/
│   ├── dex/
│   ├── graph/
│   ├── config.ts            # every constant: half-life, penalties, thresholds
│   └── index.ts             # public API surface
├── scripts/                 # Node CLI entry points (tsx)
│   ├── fetch-corpus.ts
│   ├── build-artifacts.ts
│   └── backtest.ts
├── data/
│   ├── raw/                 # committed API snapshots (per-year)
│   └── tuning-tags.json     # hand-tagged; owner-editable
├── public/data/             # generated artifacts (matrix.json, catalog.json, shows.json)
├── app/ (or src/)           # React + Vite PWA
│   ├── show-mode/
│   ├── explore-mode/
│   ├── dex/
│   ├── services/            # live-poll, idb-store, export
│   └── pwa/                 # manifest, SW config (vite-plugin-pwa)
└── tests/                   # fixtures = tiny hand-built setlists w/ known outputs
```

**Enforce the core/UI boundary mechanically**, not by convention: give `core/` its own `tsconfig.json` without DOM libs so any `window`/`document` reference is a compile error, and (optionally) an ESLint `no-restricted-imports` rule banning `app/ → core/` reverse imports. Cheap insurance on a 6-week deadline.

### Key Data Flows

1. **Build-time ingestion (owner-run, occasional):** kglw.net → `fetch-corpus` → `data/raw/*.json` (committed) → `build-artifacts` → `core/ingest.normalize` → `core/matrix.build` → `public/data/matrix.json` + `catalog.json` + `shows.json` → Vite bundles → service worker precaches. One command (`npm run refresh-data`) chains fetch + build + backtest for pre-tour-leg rebuilds.
2. **Prediction (runtime, pure):** `matrix.json` + `tuning-tags.json` + `config` + live show state (confirmed trail, current tour recent-show list) → `core/predict.score(currentSongId)` → ranked `{songId, probability, explanation}[]` → orbit view.
3. **Live sync (runtime, network-optional):** interval(60s) → `latest.json` → filter `artist_id===1`, match expected `show_id` → diff rows against confirmed trail by `position` → "auto-fill?" prompt → user confirms → IndexedDB + recompute predictions. Manual tap remains the primary path; polling failure is silent.
4. **Constellation (runtime):** same `matrix.json` → `core/graph.derive(config thresholds, activeRotation window)` → d3-force in one component → freeze on settle. Pokédex overlay merges `core/dex` output onto the same nodes.
5. **Pokédex:** IndexedDB attendance (`show_id[]`) × bundled corpus → `core/dex.derive` → counts/completion; export = single JSON blob of IndexedDB contents (attendance + tracked shows), import = merge by `show_id`.

### Suggested Build Order (dependencies)

1. **Schema fixtures + `core/ingest`** — raw types from Part 1, normalizer, tests against committed sample fixtures. Everything depends on this.
2. **`scripts/fetch-corpus`** — full historical pull; validates Part 1 findings at scale (multi-set shows, transition_id 4, covers, `showyear` filter reliability). Expect small schema surprises here, not later.
3. **`core/matrix` + artifact serialization** — unblocks predictor, backtest, AND constellation simultaneously (the artifact is the contract).
4. **`core/predict` signals + `config.ts`** — behind the matrix contract.
5. **`core/backtest` CLI** — trust gate; drives signal tuning/deletion. Steps 4–5 iterate together.
6. **App shell + Show Mode** consuming static artifacts (can start in parallel with 4–5 once step 3's artifact schema is frozen).
7. **IndexedDB persistence + live poll + export/import.**
8. **PWA/offline hardening** (vite-plugin-pwa precache incl. `public/data/*`).
9. **Explore Mode constellation + Pokédex UI** — pure consumers of existing artifacts; safely post-show-#1.

## Architectural Patterns

### Pattern 1: Build-time ETL → static artifact ("bake, don't fetch")

**What:** All heavy data work happens in a Node script at build time; the client ships a precomputed, versioned JSON artifact.
**When to use:** Small corpus (here ~1–2 MB normalized), rarely-changing source, politeness constraints on the API.
**Trade-offs:** Data freshness = last rebuild (fine: setlists only change nightly on tour, and `latest` covers the live gap). Massive wins: offline-first for free, zero client API load, deterministic backtests, reviewable data diffs in git.

### Pattern 2: Artifact as contract between three consumers

**What:** `TransitionMatrix` JSON is the frozen interface; predictor, backtester, and constellation all consume it, none reach back to raw data.

```typescript
interface TransitionMatrix {
  schemaVersion: 1;
  generatedAt: string;
  songs: Record<SongId, { name: string; slug: string; playCount: number; lastPlayed: string }>;
  transitions: Array<{
    from: SongId; to: SongId;
    count: number;              // observed successions
    segueCount: number;         // subset with transition_id 2 or 3
    crossesSetBreak: boolean;
    lastObserved: string;       // ISO date, for recency decay
    tourIds: number[];
  }>;
  showIndex: Array<{ showId: number; date: string; tourId: number; songIds: SongId[] }>;
}
```

**When to use:** Always here — it's a project constraint. Freeze the schema early (step 3) so UI and model work proceed in parallel.
**Trade-offs:** Schema changes require regenerating the artifact; the `schemaVersion` field plus a loader check keeps stale-cache clients honest.

### Pattern 3: Anti-corruption layer at ingest

**What:** `core/ingest` is the only module that knows raw kglw.net field names (`showid` vs `show_id`, `transition_id` semantics, `setnumber:"e"`). Everything downstream uses clean domain types.
**When to use:** Any external API, but especially a volunteer-run one whose schema has observed inconsistencies (jamcharts field naming, `isreprise` unreliability, dirty `releasedate` strings).
**Trade-offs:** One extra mapping layer; trivial cost, and it localizes schema-drift breakage to one file with validation tests.

### Pattern 4: Signals as composable, ablatable units

**What:** Each prediction signal is a separate pure function `(context) → scoreAdjustment` registered in a pipeline; the backtest can toggle each off.
**When to use:** Required by the ablation requirement.
**Trade-offs:** Slight indirection; pays for itself the first time a signal gets deleted for not earning its place.

## Data Flow Direction (summary)

```
kglw.net ──(build-time, bulk)──► scripts ──► core/ingest ──► core/matrix ──► matrix.json
kglw.net ──(runtime, latest only)──► app/services/live-poll ──► show state
matrix.json ──► core/predict ──► Show Mode UI
matrix.json ──► core/graph ──► Explore Mode UI
IndexedDB ◄──► app/services/idb-store ◄── tracked shows / attendance
IndexedDB ──► core/dex ──► Pokédex UI + constellation overlay

core never imports from app. app never touches raw API rows. UI never computes counts.
```

## Scaling Considerations

Not a scaling project (<10 users, static hosting). The relevant "scale" axes:

| Axis | Reality | Adjustment |
|------|---------|------------|
| Corpus growth | ~900 → ~1000 shows over project life | None; artifact stays ~2 MB |
| Matrix density | ~250 active songs → ≤62k possible pairs, observed pairs far fewer | Sparse edge-list representation (as above), not a 2D array |
| Constellation nodes | 250 nodes / few thousand edges | Fine for d3-force with edge thresholding; default view filtered to active rotation |
| Poll load on kglw.net | ≤10 devices × 1 req/60s during shows only | Well within politeness; add jitter so friends' devices don't sync-stampede |

## Anti-Patterns

### Anti-Pattern 1: Parsing the `transition` display string

**What people do:** Regex on `">"` / `"->"` in the transition text.
**Why it's wrong:** The strings carry inconsistent whitespace (`" ->"`, `"  "`, `", "`) and are display formatting, not data.
**Do this instead:** Switch on `transition_id` (1=break, 2/3=segue, 5/6=terminal, 4=log-and-treat-as-break until observed).

### Anti-Pattern 2: Deriving transitions across set boundaries implicitly

**What people do:** Walk rows by `position` and emit an edge for every consecutive pair.
**Why it's wrong:** `position` is global across sets, so set-closer→encore-opener silently becomes a normal transition edge, polluting segue statistics.
**Do this instead:** Group by `setnumber` first; emit cross-boundary edges only as tagged `crossesSetBreak` edges.

### Anti-Pattern 3: Trusting `latest.json` to be a KGLW show

**What people do:** Poll `latest`, append whatever comes back.
**Why it's wrong:** Verified: `latest` returned a Stu Mackenzie street set. Side projects share the database.
**Do this instead:** Filter `artist_id === 1` AND match the expected `show_id` (selected by the user when starting tracking) before offering auto-fill.

### Anti-Pattern 4: A second data pipeline for the constellation

**What people do:** Constellation component fetches/derives its own graph from raw setlists.
**Why it's wrong:** Two pipelines drift; the "explanations" in Show Mode stop matching the edges in Explore Mode; violates a project constraint.
**Do this instead:** `core/graph.derive(matrix, config)` — the constellation is a projection of the same artifact.

### Anti-Pattern 5: Raw corpus in the client bundle

**What people do:** Bundle the 10–20 MB raw `setlists.json` dump and process it in the browser.
**Why it's wrong:** Slow first load on venue cell service; wasteful SW precache; pushes schema knowledge into the client.
**Do this instead:** Ship only the normalized artifacts (~1–2 MB, gzip ~a few hundred KB).

### Anti-Pattern 6: Hand-maintained Pokédex counts

**What people do:** Store per-song sighting counts and increment them.
**Why it's wrong:** Counts drift from the attendance list on import/merge/retroactive marking; violates the derived-data decision.
**Do this instead:** Store only `attendedShowIds` + locally tracked setlists; derive everything on read (250 songs × 900 shows derivation is microseconds).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| kglw.net API (bulk) | Build-time Node script, per-year fetches, 1–2 s delay, committed snapshots | Validate filters were applied (silent-ignore gotcha, 1.1); set a descriptive User-Agent with contact email as a courtesy |
| kglw.net API (`latest.json`) | Runtime poll, ≤1/60s, only while actively tracking, jittered, silent offline backoff | Filter artist + show_id (Anti-Pattern 3); response is small (single show's rows) |
| Static hosting (Vercel/Netlify/GH Pages) | Vite static export; artifacts in `public/data/` | Rebuild+redeploy = data refresh |

### Internal Boundaries

| Boundary | Communication | Enforcement |
|----------|---------------|-------------|
| core ↔ app | app imports core's public API (`core/index.ts`); never reverse | Separate tsconfig (no DOM lib in core) + lint rule |
| ingest ↔ everything | Only ingest knows raw API field names | Domain types exported; raw types not re-exported from `core/index.ts` |
| matrix ↔ predict/graph/backtest | Versioned JSON artifact (schema in `matrix/types.ts`) | `schemaVersion` check on load |
| app UI ↔ IndexedDB | Via `idb-store` service only | Keeps export/import able to serialize complete state |

## Open Items for Phase-Level Research

1. **Multi-set shows:** confirm `setnumber: "2"`/`"3"` representation during full corpus ingest (2022 Red Rocks marathons are the test case). MEDIUM confidence gap.
2. **`transition_id: 4`:** meaning unknown; instrument the ingest to log occurrences.
3. **Tease notation:** confirm teases live in `footnote`/`footnotes` once the full corpus is pulled; decide whether they feed any signal (recommend: no, v1).
4. **`/setlists/showyear/YYYY.json` filter:** verify this column is filterable (given the silent-ignore behavior) before relying on per-year fetching; fallback is date-range-free full pull done once.
5. **`soundcheck` field / settype variants:** observed only empty `soundcheck` strings and `settype:"Set"`; check for `settype:"Soundcheck"` rows in full corpus and exclude them from the matrix.

## Sources

- kglw.net API docs: https://kglw.net/api/docs.php (fetched 2026-07-08) — HIGH
- Live samples, 2026-07-08 (HIGH, empirical):
  - `GET /api/v2/latest.json` — envelope, latest schema, multi-artist gotcha
  - `GET /api/v2/shows.json?order_by=showdate&direction=desc&limit=3` — shows schema, tour fields, future shows, show_tags
  - `GET /api/v2/songs.json?limit=3` — songs schema
  - `GET /api/v2/setlists.json?order_by=showdate&direction=desc&limit=60` — transition vocabulary, set delimiting, encore, sandwich repeat
  - `GET /api/v2/setlists/showdate/2025-12-13.json` — full-show ordering, complete field list
  - `GET /api/v2/setlists/showdate/2025-11-21.json` — empty-result behavior
  - `GET /api/v2/songs/isoriginal/0.json?limit=5` — silent filter-ignore gotcha
  - `GET /api/v2/jamcharts.json?limit=2`, `GET /api/v2/albums.json?limit=3`, `GET /api/v2/venues.json?limit=2` — remaining schemas
- Architecture patterns (build-time ETL → static artifact, anti-corruption layer): standard practice for offline-first PWAs with small corpora — MEDIUM (training-data knowledge, low risk)

---
*Architecture research for: Guezzer — offline-first KGLW setlist prediction PWA*
*Researched: 2026-07-08*
